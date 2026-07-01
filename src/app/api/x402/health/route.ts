/**
 * GET /api/x402/health
 *
 * One-request go-live check for the x402 paid endpoint: receiving address,
 * network/asset, price + spend cap, and live facilitator reachability. Exposes
 * only public config (no secrets). `ready` is true only when the address is set
 * and — in production — a facilitator is reachable (trustless settlement).
 */
import { NextResponse } from 'next/server';
import { usdToAtomic, dailyCapUsd } from '@/lib/x402';

export const dynamic = 'force-dynamic';
// export const runtime = 'nodejs';

const PRICE_USD = Number(process.env.X402_PRICE_USD) > 0 ? Number(process.env.X402_PRICE_USD) : 0.05;

async function facilitatorStatus(url: string | undefined) {
  if (!url) return { configured: false, reachable: false };
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/supported`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
    });
    let supported: unknown;
    try { supported = await res.json(); } catch { /* non-JSON is fine */ }
    return { configured: true, reachable: res.ok, httpStatus: res.status, supported };
  } catch (err) {
    return { configured: true, reachable: false, error: err instanceof Error ? err.message : 'unreachable' };
  }
}

export async function GET() {
  const payTo = process.env.X402_PAY_TO ?? null;
  const facilitator = await facilitatorStatus(process.env.X402_FACILITATOR_URL);
  const isProd = process.env.NODE_ENV === 'production';
  const trustless = facilitator.configured && facilitator.reachable;
  const ready = Boolean(payTo) && (!isProd || trustless);

  const warnings: string[] = [];
  if (!payTo) warnings.push('X402_PAY_TO not set — no receiving address configured.');
  if (!facilitator.configured) warnings.push('X402_FACILITATOR_URL not set — settlement is NOT trustless; production refuses paid calls.');
  if (facilitator.configured && !facilitator.reachable) warnings.push('Facilitator configured but unreachable.');

  return NextResponse.json({
    ok: ready,
    ready,
    mode: facilitator.configured ? 'trustless' : 'dev',
    payTo,
    network: process.env.X402_NETWORK ?? 'base',
    chainId: process.env.X402_CHAIN_ID ?? '8453',
    asset: process.env.X402_USDC_ASSET ?? 'USDC',
    pricePerCall: { usd: PRICE_USD, atomic: usdToAtomic(PRICE_USD) },
    dailyCapUsd: dailyCapUsd(),
    endpoint: '/api/v1/agent-verify',
    facilitator,
    warnings,
    timestamp: new Date().toISOString(),
  });
}
