import { NextRequest, NextResponse } from 'next/server';
import { requireInternalSecret } from '@/lib/require-internal-secret';
import { addSuppression, recordEvent } from '@/lib/guardrail';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const denied = requireInternalSecret(req);
  if (denied) return denied;

  let body: { email?: string; reason?: string; source?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  if (!body.email || !body.reason || !body.source) {
    return NextResponse.json({ error: 'email, reason, and source are required' }, { status: 400 });
  }

  try {
    await addSuppression(body.email, body.reason, body.source);
    await recordEvent({ channel: body.source, action: 'suppress', reason: body.reason, metadata: { email: body.email } });
    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error('[guardrail/suppress] failed:', err);
    return NextResponse.json({ ok: false, error: 'internal error' }, { status: 500 });
  }
}
