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
import { checkRateLimit } from '@/lib/rate-limit';
import {
  buildPaymentRequired, parsePaymentHeader, verifyPaymentProof,
  wouldExceedCap, usdToAtomic, dailyCapUsd,
} from '@/lib/x402';

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

  // 3. Verify the payment satisfies the requirement.
  const verification = verifyPaymentProof(proof, required.body.accepts[0]);
  if (!verification.valid) {
    return NextResponse.json({ ...required.body, error: verification.reason }, { status: 402 });
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

  // 6. Do the work. TODO: call the 5-agent authenticate pipeline; stubbed for now.
  const input = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  return NextResponse.json({
    verified: true,
    authenticityScore: 100,
    subject: input.productId ?? input.serial ?? null,
    settlement: {
      payer: proof.payer,
      amountAtomic: verification.amount.toString(),
      txHash: proof.txHash ?? null,
    },
    timestamp: new Date().toISOString(),
  });
}
