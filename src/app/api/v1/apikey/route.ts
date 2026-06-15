export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/api-auth-middleware';
import { createClient } from '@supabase/supabase-js';
import { randomBytes, createHash } from 'node:crypto';

const admin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Must match the prefix length used in verifyApiKey
const PREFIX_LENGTH = 16;

export async function GET(req: NextRequest) {
  // Session-only: API key management requires a browser session
  const session = await requireSession(req);
  if (session instanceof NextResponse) return session;

  const { data: keys, error } = await admin
    .from('api_keys')
    .select('id, name, key_prefix, scopes, environment, status, rate_limit, total_requests, last_used_at, expires_at, created_at, revoked_at')
    .eq('user_id', session.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Failed to retrieve API keys' }, { status: 500 });

  const AVAILABLE_SCOPES = [
    'qr:read', 'qr:write', 'qr:delete',
    'scan:read', 'analytics:read',
    'campaign:read', 'campaign:write',
    'webhook:read', 'webhook:write',
    'billing:read', 'user:read',
  ];

  return NextResponse.json({
    success: true,
    api_keys: keys,
    total: keys?.length ?? 0,
    active_count: keys?.filter(k => k.status === 'active').length ?? 0,
    available_scopes: AVAILABLE_SCOPES,
    generated_at: new Date().toISOString(),
  });
}

export async function POST(req: NextRequest) {
  const session = await requireSession(req);
  if (session instanceof NextResponse) return session;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { name, scopes, environment, expires_at } = body as Record<string, unknown>;

  if (typeof name !== 'string' || !name.trim()) {
    return NextResponse.json({ error: 'name is required' }, { status: 400 });
  }
  if (!Array.isArray(scopes) || scopes.length === 0) {
    return NextResponse.json({ error: 'scopes array is required' }, { status: 400 });
  }

  const prefix_type = environment === 'test' ? 'qron_test_sk_' : 'qron_live_sk_';
  const raw_key = prefix_type + randomBytes(24).toString('hex');
  const key_prefix = raw_key.substring(0, PREFIX_LENGTH);
  const key_hash = createHash('sha256').update(raw_key).digest('hex');

  const { data: newKey, error: insertErr } = await admin
    .from('api_keys')
    .insert({
      user_id: session.id,
      name: (name as string).trim().slice(0, 128),
      key_prefix,
      key_hash,
      scopes,
      environment: environment === 'test' ? 'test' : 'production',
      status: 'active',
      rate_limit: 1000,
      rate_limit_window: '1h',
      total_requests: 0,
      expires_at: expires_at ?? null,
      is_active: true,
    })
    .select('id, name, key_prefix, scopes, environment, status, created_at')
    .single();

  if (insertErr) {
    console.error('[apikey] insert failed:', insertErr);
    return NextResponse.json({ error: 'Failed to create API key' }, { status: 500 });
  }

  return NextResponse.json({
    success: true,
    api_key: {
      ...newKey,
      key: raw_key, // shown once only
      key_preview: `${key_prefix}...${raw_key.slice(-4)}`,
    },
    warning: 'Save this key securely. It will not be shown again.',
    created_at: new Date().toISOString(),
  }, { status: 201 });
}

export async function DELETE(req: NextRequest) {
  const session = await requireSession(req);
  if (session instanceof NextResponse) return session;

  const { searchParams } = new URL(req.url);
  const key_id = searchParams.get('id');

  if (!key_id) {
    return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 });
  }

  // Verify ownership before revoking
  const { data: existing, error: fetchErr } = await admin
    .from('api_keys')
    .select('id, user_id, status')
    .eq('id', key_id)
    .eq('user_id', session.id) // ownership check
    .single();

  if (fetchErr || !existing) {
    return NextResponse.json({ error: 'API key not found' }, { status: 404 });
  }

  const { error: updateErr } = await admin
    .from('api_keys')
    .update({ status: 'revoked', is_active: false, revoked_at: new Date().toISOString() })
    .eq('id', key_id);

  if (updateErr) return NextResponse.json({ error: 'Failed to revoke key' }, { status: 500 });

  return NextResponse.json({ success: true, message: 'API key revoked' });
}
