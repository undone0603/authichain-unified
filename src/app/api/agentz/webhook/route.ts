import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(req: NextRequest): boolean {
  const secret = process.env.AGENTZ_WEBHOOK_SECRET;
  if (!secret) return false;
  return req.headers.get('x-agentz-secret') === secret;
}

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

export async function POST(req: NextRequest) {
  if (!authorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { event: string; payload: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { event, payload } = body;
  if (!event) return NextResponse.json({ error: 'Missing event' }, { status: 400 });

  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const admin = getAdmin();

  if (event === 'lead.qualified') {
    const email = payload.email as string | undefined;
    if (email) {
      await admin.from('lead_captures').upsert({
        email,
        name: payload.name as string | undefined,
        source: 'agentz',
        product_interest: (payload.product as string) || 'authichain',
        metadata: JSON.stringify(payload),
        status: 'qualified',
      }, { onConflict: 'email', ignoreDuplicates: false });
    }
  }

  await admin.from('automation_logs').insert({
    workflow_name: `agentz_${event.replace('.', '_')}`,
    trigger_type: 'webhook',
    status: 'success',
    payload: JSON.stringify({ event, ...payload }),
  });

  return NextResponse.json({ ok: true, event });
}
