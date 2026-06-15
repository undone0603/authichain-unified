export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth-middleware';
import { createClient } from '@supabase/supabase-js';
import { assertSafeUrl } from '@/lib/ssrf-guard';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const AVAILABLE_EVENTS = [
  'qr.created', 'qr.updated', 'qr.deleted',
  'qr.scanned', 'qr.scanned.unique',
  'campaign.created', 'campaign.completed', 'campaign.milestone',
  'subscription.created', 'subscription.cancelled',
];

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const event_type = searchParams.get('event_type');
  const status = searchParams.get('status');

  let q = admin
    .from('webhook_subscriptions')
    .select('id, name, url, event_types, status, created_at, last_triggered, success_count, failure_count')
    .eq('user_id', auth.userId); // always scoped to caller

  if (event_type) q = q.contains('event_types', [event_type]);
  if (status) q = q.eq('status', status);

  const { data, error } = await q.order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'Failed to list webhooks' }, { status: 500 });

  return NextResponse.json({
    success: true,
    webhooks: data,
    total: data?.length ?? 0,
    available_events: AVAILABLE_EVENTS,
    generated_at: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { name, url, event_types } = body as Record<string, unknown>;

  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (typeof url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 400 });
  }
  if (!Array.isArray(event_types) || event_types.length === 0) {
    return NextResponse.json({ error: 'event_types array is required' }, { status: 400 });
  }

  const invalidEvents = event_types.filter((e: unknown) => !AVAILABLE_EVENTS.includes(e as string));
  if (invalidEvents.length > 0) {
    return NextResponse.json({ error: `Invalid event types: ${invalidEvents.join(', ')}` }, { status: 400 });
  }

  // SSRF guard — block private/internal webhook targets
  try {
    await assertSafeUrl(url);
  } catch (err: unknown) {
    return NextResponse.json({ error: (err as Error).message }, { status: 400 });
  }

  const secret = Array.from(crypto.getRandomValues(new Uint8Array(32)))
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');

  const { data: webhook, error: insertErr } = await admin
    .from('webhook_subscriptions')
    .insert({
      user_id: auth.userId, // always derived from auth, never from request body
      name: name.trim().slice(0, 128),
      url,
      event_types,
      status: 'active',
      secret_hash: require('node:crypto').createHash('sha256').update(secret).digest('hex'),
      retry_count: 3,
      timeout_ms: 5000,
    })
    .select('id, name, url, event_types, status, created_at')
    .single();

  if (insertErr) {
    console.error('[webhook] insert failed:', insertErr);
    return NextResponse.json({ error: 'Failed to register webhook' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    webhook: {
      ...webhook,
      secret: `whsec_${secret}`, // shown once — not stored in plaintext
    },
    warning: 'Save this secret securely. It will not be shown again.',
  }, { status: 201 });
}
