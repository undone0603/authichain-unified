/**
 * POST /api/v1/agent-verify
 *
 * Pay-per-call verification endpoint for autonomous agents (x402).
 * No payment -> HTTP 402 + requirements. Paid (X-PAYMENT proof) -> verify the
 * payment, enforce a per-payer daily spend cap + rate limit and look the seal
 * up, and only then settle and return the verification result. Every refusal
 * happens before settlement. Price is fixed, so daily spend = call-count x price,
 * tracked in automation_logs (same ledger the rate-limiter uses).
 */
import { NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";
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
  X402_REGISTRY_NOT_BOUND,
} from "@/lib/x402";
import { onVerificationEvent } from "../../../../../server/revenue-engine/loop";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PRICE_USD =
  Number(process.env.X402_PRICE_USD) > 0
    ? Number(process.env.X402_PRICE_USD)
    : 0.05;

async function dailySpentAtomic(
  payer: string,
  priceAtomic: bigint
): Promise<bigint> {
  const supabase = await createClient();
  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from("automation_logs")
    .select("*", { count: "exact", head: true })
    .eq("workflow_name", "x402_spend")
    .eq("payload", payer)
    .gt("created_at", windowStart);
  if (error) return 0n; // fail-open on ledger read; rate limit still applies
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

  // 1. Require a payment proof (v1 X-PAYMENT or v2 PAYMENT-SIGNATURE).
  const paymentHeader = readPaymentProofHeader(name =>
    request.headers.get(name)
  );
  const proof = parsePaymentHeader(paymentHeader);
  if (!proof) {
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

  // 4. Everything that can refuse runs before settlement, so a refused call
  // never costs the agent the $0.05: missing subject, spend cap, registry
  // outage. Only a call that will get a real registry answer is settled.
  const input = (await request.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const rawSealId =
    input.sealId ?? input.seal_id ?? input.productId ?? input.serial;
  const sealId =
    typeof rawSealId === "string" && rawSealId.trim() ? rawSealId.trim() : null;
  if (!sealId) {
    return NextResponse.json(
      { error: "seal_id_required", settled: false },
      { status: 400 }
    );
  }

  const priceAtomic = BigInt(usdToAtomic(PRICE_USD));
  const capAtomic = BigInt(usdToAtomic(dailyCapUsd()));
  const spent = await dailySpentAtomic(proof.payer, priceAtomic);
  if (wouldExceedCap(spent, priceAtomic, capAtomic)) {
    return NextResponse.json(
      { error: "daily_spend_cap_exceeded", capUsd: dailyCapUsd() },
      { status: 402 }
    );
  }

  // Look the seal up against the same registry the free consumer-facing
  // /api/verify endpoint checks (auth_seals), so a paid agent call can never
  // return "verified" for a seal that doesn't exist. A lookup error is an
  // outage, not a "not found", and is refused unpaid.
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ ...X402_REGISTRY_NOT_BOUND }, { status: 503 });
  }
  const admin = createAdminClient(supabaseUrl, serviceKey);
  const { data: seal, error: sealError } = await admin
    .from("auth_seals")
    .select("*")
    .eq("id", sealId)
    .maybeSingle();
  if (sealError) {
    return NextResponse.json(
      { error: "registry_unavailable", settled: false },
      { status: 503 }
    );
  }

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

  // 6. Record the spend (one row == one priced call).
  const supabase = await createClient();
  await supabase.from("automation_logs").insert({
    workflow_name: "x402_spend",
    trigger_type: "event",
    status: "success",
    payload: proof.payer,
  });

  const verified = !!seal;
  const details: Record<string, unknown> = seal
    ? {
        productId: seal.product_id,
        batchId: seal.batch_id,
        brand: seal.brand,
        createdAt: seal.created_at,
      }
    : {};
  await onVerificationEvent({
    seal_id: sealId,
    brand: (seal?.brand as string | undefined) ?? "authichain.com",
    scan_context: { source: "agent-verify", payer: proof.payer },
    status: verified ? "valid" : "invalid",
  });

  return NextResponse.json(
    {
      verified,
      authenticityScore: verified ? 100 : 0,
      subject: sealId,
      details,
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
