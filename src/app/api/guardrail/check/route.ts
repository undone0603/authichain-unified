import { NextRequest, NextResponse } from 'next/server';
import { requireInternalSecret } from '@/lib/require-internal-secret';
import { checkAndReserve } from '@/lib/guardrail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const denied = requireInternalSecret(req);
  if (denied) return denied;

  let body: { channel?: string; count?: number; recipient?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  if (!body.channel || typeof body.channel !== 'string') {
    return NextResponse.json({ error: 'channel is required' }, { status: 400 });
  }

  try {
    const result = await checkAndReserve(body.channel, body.count ?? 1, body.recipient);
    return NextResponse.json(result);
  } catch (err) {
    console.error('[guardrail/check] failed:', err);
    return NextResponse.json({ allowed: false, remaining: 0, reason: 'internal error' }, { status: 500 });
  }
}
