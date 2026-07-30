import { NextRequest, NextResponse } from 'next/server';
import { requireInternalSecret } from '@/lib/require-internal-secret';
import { recordEvent } from '@/lib/guardrail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const denied = requireInternalSecret(req);
  if (denied) return denied;

  let body: { channel?: string; action?: string; allowed?: boolean; reason?: string; metadata?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  if (!body.channel || !body.action) {
    return NextResponse.json({ error: 'channel and action are required' }, { status: 400 });
  }

  const validActions = ['check', 'record', 'suppress', 'kill_toggle'] as const;
  if (!validActions.includes(body.action as any)) {
    return NextResponse.json({ error: 'action must be one of: check, record, suppress, kill_toggle' }, { status: 400 });
  }

  try {
    await recordEvent({
      channel: body.channel,
      action: body.action as 'check' | 'record' | 'suppress' | 'kill_toggle',
      allowed: body.allowed,
      reason: body.reason,
      metadata: body.metadata,
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[guardrail/record] failed:', err);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
