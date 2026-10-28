/**
 * POST /api/v1/agent-verify
 *
 * Pay-per-call verification endpoint for autonomous agents (x402).
 * No payment and an empty body -> HTTP 402 + requirements. Listing samples
 * (`demo`, bazaar example UUID) also 402 when unpaid. A body that names a
 * non-UUID seal other than those samples, or uses productId/serial as the
 * key, is HTTP 400 before that challenge. Paid (X-PAYMENT proof) -> verify the
 * payment, enforce a per-payer daily spend cap + rate limit and look the seal
 * up, and only then settle and return the verification result. Every refusal
 * happens before settlement. Price is fixed, so daily spend = call-count x price,
 * tracked in automation_logs (same ledger the rate-limiter uses).
 */
import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { checkRateLimit } from "@/lib/rate-limit";
import {
  buildPaymentRequired,
  parsePaymentHeader,
  paymentResponseHeaders,
  readPaymentProofHeader,
  verifyPaymentProof,
  wouldExceedCap,
  usdToAtomic,
  dailyCapUsd,
  settlePayment,
  isDiscoveryExampleSealId,
  X402_REGISTRY_NOT_BOUND,
} from "@/lib/x402";
import { sealBaseline } from "../../../../lib/seal-baseline";
// Relative, not "@/lib/…": tsconfig.worker.json maps "@/*" to client/src only.
import {
  coerceSealBody,
  listedSealId,
  parseSealRequest,
  unpaidSealRefusal,
} from "../../../../lib/agent-verify";
import { onVerificationEvent } from "../../../../../server/revenue-engine/loop";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PRICE_USD =
  Number(process.env.X402_PRICE_USD) > 0
    ? Number(process.env.X402_PRICE_USD)
    : 0.05;

async function dailySpentAtomic(
  payer: string,
  priceAtomic: bigint,
  supabaseUrl: string,
  serviceKey: string
): Promise<bigint | null> {
  const supabase = createAdminClient(supabaseUrl, serviceKey);
  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("automation_logs")
    .select("*", { count: "exact", head: true })
    .eq("workflow_name", "x402_spend")
    .eq("payload", payer)
    .gt("created_at", windowStart);
  if (error) return null;
  return BigInt(count || 0) * priceAtomic;
}

export async function POST(request: Request) {
  const resource = new URL(request.url).toString();
  const payTo = process.env.X402_PAY_TO;
  if (!payTo) {
    return NextResponse.json(
      { error: "payments_not_configured" },
      { status: 503 }
    );
  }

  const required = buildPaymentRequired({
    resource,
    priceUsd: PRICE_USD,
    payTo,
    description: "AuthiChain agent verification",
  });

  // Read once. A later request.json() would see an empty body.
  const raw = await request.json().catch(() => ({}));
  const input = coerceSealBody(
    raw && typeof raw === "object" && !Array.isArray(raw)
      ? (raw as Record<string, unknown>)
      : {}
  );

  // 1. Require a payment proof (v1 X-PAYMENT or v2 PAYMENT-SIGNATURE).
  const paymentHeader = readPaymentProofHeader(name =>
    request.headers.get(name)
  );
  const proof = parsePaymentHeader(paymentHeader);
  if (!proof) {
    const early = unpaidSealRefusal(input);
    if (early) {
      return NextResponse.json(early.body, { status: early.status });
    }
    return NextResponse.json(required.v2, {
      status: 402,
      headers: required.headers,
    });
  }

  // 2. Rate-limit the payer (cheap guard before any DB sum / settlement work).
  const rl = await checkRateLimit(`x402:${proof.payer}`, 120, 1);
  if (!rl.ok) {
    return NextResponse.json({ error: "rate_limited" }, { status: 429 });
  }

  // 3. Verify the payment satisfies the requirement (structural pre-check).
  const verification = verifyPaymentProof(proof, required.body.accepts[0]);
  if (!verification.valid) {
    return NextResponse.json(
      { ...required.v2, error: verification.reason },
      { status: 402, headers: required.headers }
    );
  }

  // 4. Named-but-invalid bodies, spend cap, and registry outage refuse
  // before settlement. An empty body is the x402 402 challenge; a valid
  // payment on that same body settles and returns missing-seal evidence.
  const emptyBody = Object.keys(input).length === 0;
  const listed = listedSealId(input);
  const discoveryAlias = Boolean(listed) && isDiscoveryExampleSealId(listed);
  const parsed = parseSealRequest(input);
  if (!parsed.ok && !emptyBody && !discoveryAlias) {
    return NextResponse.json(parsed.body, { status: parsed.status });
  }
  const sealId = parsed.ok ? parsed.sealId : null;

  // A row in auth_seals is not an attestation. This path checks signature
  // and validity only; it does not query an anchor or authenticate an issuer.
  // The paid ledger also requires the service role: if we cannot read it,
  // fail closed before settlement rather than treating the spend as zero.
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ ...X402_REGISTRY_NOT_BOUND }, { status: 503 });
  }
  const admin = createAdminClient(supabaseUrl, serviceKey);

  const priceAtomic = BigInt(usdToAtomic(PRICE_USD));
  const capAtomic = BigInt(usdToAtomic(dailyCapUsd()));
  const spent = await dailySpentAtomic(
    proof.payer,
    priceAtomic,
    supabaseUrl,
    serviceKey
  );
  if (spent === null) {
    return NextResponse.json(
      { error: "spend_ledger_unavailable", settled: false },
      { status: 503 }
    );
  }
  if (wouldExceedCap(spent, priceAtomic, capAtomic)) {
    return NextResponse.json(
      { error: "daily_spend_cap_exceeded", capUsd: dailyCapUsd() },
      { status: 402 }
    );
  }
  let seal: Record<string, unknown> | null = null;
  if (sealId) {
    const { data, error: sealError } = await admin
      .from("auth_seals")
      .select("id,product_id,batch_id,brand,created_at,qr_payload")
      .eq("id", sealId)
      .maybeSingle();
    if (sealError) {
      return NextResponse.json(
        { error: "registry_unavailable", settled: false },
        { status: 503 }
      );
    }
    seal = (data as Record<string, unknown> | null) ?? null;
  }

  const answer = sealBaseline(seal);

  // 5. Trustless settlement via the x402 facilitator (on-chain EIP-3009).
  // In production a facilitator MUST confirm settlement; dev-mode (no facilitator
  // configured) is refused in production so a fake proof can never pass.
  const settlement = await settlePayment(
    paymentHeader ?? "",
    required.body.accepts[0]
  );
  if (
    !settlement.settled ||
    (!settlement.trustless && process.env.NODE_ENV === "production")
  ) {
    return NextResponse.json(
      { ...required.v2, error: settlement.reason ?? "payment_not_settled" },
      { status: 402, headers: required.headers }
    );
  }

  // 6. Record the spend (one row == one priced call). Use the same privileged
  // client as the cap read so RLS cannot silently drop the ledger entry.
  await admin.from("automation_logs").insert({
    workflow_name: "x402_spend",
    trigger_type: "event",
    status: "success",
    payload: proof.payer,
  });

  if (sealId) {
    await onVerificationEvent({
      seal_id: sealId,
      brand: (seal?.brand as string | undefined) ?? "authichain.com",
      scan_context: { source: "agent-verify", payer: proof.payer },
      status: answer.verified ? "valid" : "invalid",
    });
  }

  return NextResponse.json(
    {
      ...answer,
      subject: sealId ?? (discoveryAlias ? listed : null),
      settlement: {
        payer: proof.payer,
        amountAtomic: verification.amount.toString(),
        txHash: settlement.txHash ?? proof.txHash ?? null,
        trustless: settlement.trustless,
      },
      timestamp: new Date().toISOString(),
    },
    {
      headers: paymentResponseHeaders({
        success: true,
        transaction: settlement.txHash ?? proof.txHash,
        network: required.body.accepts[0].network,
        payer: proof.payer,
      }),
    }
  );
}

/** Unpaid GET is the 402 quote. Paid GET settles like an empty POST. */
export async function GET(request: Request) {
  const paymentHeader = readPaymentProofHeader(name =>
    request.headers.get(name)
  );
  if (paymentHeader && parsePaymentHeader(paymentHeader)) {
    const headers = new Headers(request.headers);
    headers.set("content-type", "application/json");
    headers.delete("content-length");
    return POST(
      new Request(request.url, {
        method: "POST",
        headers,
        body: "{}",
      })
    );
  }
  const payTo = process.env.X402_PAY_TO;
  if (!payTo) {
    return NextResponse.json(
      { error: "payments_not_configured" },
      { status: 503 }
    );
  }
  const required = buildPaymentRequired({
    resource: new URL(request.url).toString(),
    priceUsd: PRICE_USD,
    payTo,
    description: "AuthiChain agent verification",
  });
  return NextResponse.json(required.v2, {
    status: 402,
    headers: required.headers,
  });
}
