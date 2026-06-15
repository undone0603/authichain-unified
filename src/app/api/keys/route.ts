export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { randomBytes, createHash } from 'node:crypto';

// Must match the PREFIX_LENGTH used in verifyApiKey (auth-api.ts)
const PREFIX_LENGTH = 16;

/**
 * POST /api/keys
 * Generates a new API key for the authenticated user.
 * Returns the plain-text key once — stores only the hash.
 */
export async function POST() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rawKey = `qron_${randomBytes(32).toString('hex')}`;
  const keyPrefix = rawKey.substring(0, PREFIX_LENGTH);
  const keyHash = createHash('sha256').update(rawKey).digest('hex');

  const { error } = await supabase
    .from('api_keys')
    .insert({
      user_id: user.id,
      name: 'Industrial Access Key',
      key_prefix: keyPrefix,
      key_hash: keyHash,
      scopes: ['read', 'write', 'generate'],
      is_active: true,
    });

  if (error) {
    console.error('[api/keys] insert error:', error);
    return NextResponse.json({ error: 'Failed to generate key' }, { status: 500 });
  }

  return NextResponse.json({
    apiKey: rawKey,
    warning: 'Save this key securely. It will not be shown again.',
  });
}

/**
 * GET /api/keys
 * Returns key metadata (never the raw key or hash) for the authenticated user.
 */
export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { data, error } = await supabase
    .from('api_keys')
    .select('id, name, key_prefix, scopes, last_used_at, created_at, is_active')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[api/keys] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch keys' }, { status: 500 });
  }

  return NextResponse.json({ keys: data });
}

/**
 * DELETE /api/keys?id=<key_id>
 * Revokes an API key belonging to the authenticated user.
 */
export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(req.url);
  const keyId = searchParams.get('id');

  if (!keyId) {
    return NextResponse.json({ error: 'id query parameter is required' }, { status: 400 });
  }

  // Verify ownership before revoking
  const { data: existing } = await supabase
    .from('api_keys')
    .select('id, user_id')
    .eq('id', keyId)
    .eq('user_id', user.id) // ownership enforced by DB query, not app logic
    .maybeSingle();

  if (!existing) {
    return NextResponse.json({ error: 'Key not found' }, { status: 404 });
  }

  const { error } = await supabase
    .from('api_keys')
    .update({ is_active: false, revoked_at: new Date().toISOString() })
    .eq('id', keyId);

  if (error) {
    return NextResponse.json({ error: 'Failed to revoke key' }, { status: 500 });
  }

  return NextResponse.json({ success: true, message: 'API key revoked' });
}
