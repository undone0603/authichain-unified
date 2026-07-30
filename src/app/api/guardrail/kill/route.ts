import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { requireAdmin } from '@/lib/require-admin';
import { toggleKillSwitch, recordEvent } from '@/lib/guardrail';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const authResult = await requireAdmin(supabase);
  if (authResult instanceof NextResponse) return authResult;

  let body: { scope?: string; enabled?: boolean; reason?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid JSON body' }, { status: 400 });
  }

  if (!body.scope || typeof body.enabled !== 'boolean' || !body.reason) {
    return NextResponse.json({ error: 'scope, enabled, and reason are required' }, { status: 400 });
  }

  await toggleKillSwitch(body.scope, body.enabled, body.reason, authResult.user.email ?? authResult.user.id);
  await recordEvent({ channel: body.scope, action: 'kill_toggle', allowed: !body.enabled, reason: body.reason });

  return NextResponse.json({ ok: true });
}
