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
  usdToAtomic,
  dailyCapUsd,
  settlePayment,
  X402_REGISTRY_NOT_BOUND,
} from "@/lib/x402";
import { attestSeal } from "@/lib/seal-attestation";
import {
  releaseX402Spend,
  reserveX402Spend,
  sealLookupCredentials,
} from "@/lib/paid-seal-verify";
// Relative, not "@/lib/…": tsconfig.worker.json maps "@/*" to client/src only.
import { parseSealRequest, registryAnswer } from "../../../../lib/agent-verify";
import { onVerificationEvent } from "../../../../../server/revenue-engine/loop";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const PRICE_USD =
  Number(process.env.X402_PRICE_USD) > 0
    ? Number(process.env.X402_PRICE_USD)
    : 0.05;

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
  const parsed = parseSealRequest(input);
  if (!parsed.ok) {
    return NextResponse.json(parsed.body, { status: parsed.status });
  }
  const { sealId } = parsed;

  // A row in auth_seals is not an attestation. verified is true only when
  // protocol/verifier.mjs returns verdict "verified" (Ed25519 + mainnet anchor).
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
  const credentials = sealLookupCredentials({
    SUPABASE_URL: supabaseUrl,
    SUPABASE_SERVICE_ROLE_KEY: serviceKey,
  });
  if (!credentials) {
    return NextResponse.json(
      { ...X402_REGISTRY_NOT_BOUND },
      { status: 503 }
    );
  }
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
  const reservation = await reserveX402Spend(
    fetch,
    credentials,
    proof.payer,
    priceAtomic,
    capAtomic
  );
  if (!reservation.ok) {
    return NextResponse.json(
      { error: "spend_reservation_unavailable", settled: false },
      { status: 503 }
    );
  }
  if (!reservation.id) {
    return NextResponse.json(
      { error: "daily_spend_cap_exceeded", capUsd: dailyCapUsd() },
      { status: 402 }
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
    const released = await releaseX402Spend(
      fetch,
      credentials,
      reservation.id
    );
    if (!released) {
      console.error(
        "[agent-verify] failed payment left its spend reservation in place"
      );
    }
    return NextResponse.json(
      { ...required.v2, error: settlement.reason ?? "payment_not_settled" },
      { status: 402, headers: required.headers }
    );
  }

  const attestation = attestSeal(
    seal ? (seal as Record<string, unknown>) : null
  );
  const answer = registryAnswer(seal as Record<string, unknown> | null);
  if (attestation.verdict) {
    answer.details.verdict = attestation.verdict;
    answer.details.reasons = attestation.reasons;
    if (attestation.verified) answer.checks.signature = "checked";
  }
  await onVerificationEvent({
    seal_id: sealId,
    brand: (seal?.brand as string | undefined) ?? "authichain.com",
    scan_context: { source: "agent-verify", payer: proof.payer },
    status: attestation.verified ? "valid" : "invalid",
  });

  return NextResponse.json(
    {
      verified: attestation.verified,
      registered: answer.registered,
      status: answer.status,
      checks: answer.checks,
      subject: sealId,
      details: answer.details,
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
