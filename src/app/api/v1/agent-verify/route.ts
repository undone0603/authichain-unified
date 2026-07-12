/**
 * POST /api/v1/agent-verify
 *
 * Pay-per-call verification endpoint for autonomous agents (x402).
 * No payment -> HTTP 402 + requirements. Paid (X-PAYMENT proof) -> verify the
 * payment, enforce a per-payer daily spend cap + rate limit, then return a
 * verification result. Price is fixed, so daily spend = call-count x price,
 * tracked in automation_logs (same ledger the rate-limiter uses).
 */
import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { checkRateLimit } from '@/lib/rate-limit';
import {
  buildPaymentRequired, parsePaymentHeader, verifyPaymentProof,
  wouldExceedCap, usdToAtomic, dailyCapUsd, settlePayment,
} from '@/lib/x402';
import { onVerificationEvent } from '../../../../../server/revenue-engine/loop';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PRICE_USD = Number(process.env.X402_PRICE_USD) > 0 ? Number(process.env.X402_PRICE_USD) : 0.05;

async function dailySpentAtomic(payer: string, priceAtomic: bigint): Promise<bigint> {
  const supabase = await createClient();
  const windowStart = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('automation_logs')
    .select('*', { count: 'exact', head: true })
    .eq('workflow_name', 'x402_spend')
    .eq('payload', payer)
    .gt('created_at', windowStart);
  if (error) return 0n; // fail-open on ledger read; rate limit still applies
  return BigInt(count || 0) * priceAtomic;
}

export async function POST(request: Request) {
  const resource = new URL(request.url).toString();
  const payTo = process.env.X402_PAY_TO;
  if (!payTo) {
    return NextResponse.json({ error: 'payments_not_configured' }, { status: 503 });
  }

  const required = buildPaymentRequired({
    resource, priceUsd: PRICE_USD, payTo,
    description: 'AuthiChain agent verification',
  });

  // 1. Require a payment proof.
  const proof = parsePaymentHeader(request.headers.get('x-payment'));
  if (!proof) {
    return NextResponse.json(required.body, { status: 402 });
  }

  // 2. Rate-limit the payer (cheap guard before any DB sum / settlement work).
  const rl = await checkRateLimit(`x402:${proof.payer}`, 120, 1);
  if (!rl.ok) {
    return NextResponse.json({ error: 'rate_limited' }, { status: 429 });
  }

  // 3. Verify the payment satisfies the requirement (structural pre-check).
  const verification = verifyPaymentProof(proof, required.body.accepts[0]);
  if (!verification.valid) {
    return NextResponse.json({ ...required.body, error: verification.reason }, { status: 402 });
  }

  // 3b. Trustless settlement via the x402 facilitator (on-chain EIP-3009).
  // In production a facilitator MUST confirm settlement; dev-mode (no facilitator
  // configured) is refused in production so a fake proof can never pass.
  const settlement = await settlePayment(request.headers.get('x-payment') ?? '', required.body.accepts[0]);
  if (!settlement.settled || (!settlement.trustless && process.env.NODE_ENV === 'production')) {
    return NextResponse.json(
      { ...required.body, error: settlement.reason ?? 'payment_not_settled' },
      { status: 402 },
    );
  }

  // 4. Enforce the per-payer daily spend cap.
  const priceAtomic = BigInt(usdToAtomic(PRICE_USD));
  const capAtomic = BigInt(usdToAtomic(dailyCapUsd()));
  const spent = await dailySpentAtomic(proof.payer, priceAtomic);
  if (wouldExceedCap(spent, priceAtomic, capAtomic)) {
    return NextResponse.json(
      { error: 'daily_spend_cap_exceeded', capUsd: dailyCapUsd() },
      { status: 402 },
    );
  }

  // 5. Record the spend (one row == one priced call).
  const supabase = await createClient();
  await supabase.from('automation_logs').insert({
    workflow_name: 'x402_spend', trigger_type: 'event', status: 'success', payload: proof.payer,
  });

  // 6. Do the work: look the seal up against the same registry the free
  // consumer-facing /api/verify endpoint checks (auth_seals), so a paid
  // agent call can never return "verified" for a seal that doesn't exist.
  const input = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const sealId = (input.sealId ?? input.seal_id ?? input.productId ?? input.serial) as string | undefined;

  let verified = false;
  let details: Record<string, unknown> = {};
  if (sealId) {
    const admin = createAdminClient(process.env.SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
    const { data: seal } = await admin.from('auth_seals').select('*').eq('id', sealId).single();
    verified = !!seal;
    if (seal) {
      details = { productId: seal.product_id, batchId: seal.batch_id, brand: seal.brand, createdAt: seal.created_at };
    }
    await onVerificationEvent({
      seal_id: sealId,
      brand: (seal?.brand as string | undefined) ?? 'authichain.com',
      scan_context: { source: 'agent-verify', payer: proof.payer },
      status: verified ? 'valid' : 'invalid',
    });
  }

  return NextResponse.json({
    verified,
    authenticityScore: verified ? 100 : 0,
    subject: sealId ?? null,
    details,
    settlement: {
      payer: proof.payer,
      amountAtomic: verification.amount.toString(),
      txHash: settlement.txHash ?? proof.txHash ?? null,
      trustless: settlement.trustless,
    },
    timestamp: new Date().toISOString(),
  });
}
