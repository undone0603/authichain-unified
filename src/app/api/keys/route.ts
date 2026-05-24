import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { logAutomation } from '@/lib/automation';

export const dynamic = 'force-dynamic';

/**
 * POST /api/keys
 * 
 * Generates a new industrial API key for the authenticated user.
 * Returns the plain-text key (only once) and stores the hash.
 */
export async function POST() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // 1. Generate a random 32-byte key
    const randomBytes = new Uint8Array(32);
    globalThis.crypto.getRandomValues(randomBytes);
    const rawKey = Array.from(randomBytes).map(b => b.toString(16).padStart(2, '0')).join('');
    const apiKey = `qron_${rawKey}`;
    
    const keyPrefix = apiKey.substring(0, 10); // 'qron_' + 5 chars

    // 2. Hash the key for storage
    const msgUint8 = new TextEncoder().encode(apiKey);
    const hashBuffer = await globalThis.crypto.subtle.digest('SHA-256', msgUint8);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

    // 3. Store in DB
    const { error } = await supabase
      .from('api_keys')
      .insert({
        user_id: user.id,
        name: 'Industrial Access Key',
        key_prefix: keyPrefix,
        key_hash: keyHash,
        scopes: ['read', 'write', 'generate'],
        is_active: true
      });

    if (error) throw error;

    return NextResponse.json({ apiKey });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/keys] Error:', err);
    await logAutomation('api_keys.create', 'event', 'failure', null, msg);
    return NextResponse.json({ error: 'Failed to generate key' }, { status: 500 });
  }
}

/**
 * GET /api/keys
 * 
 * Returns the list of active key metadata (prefix, created_at, etc.)
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data, error } = await supabase
      .from('api_keys')
      .select('id, name, key_prefix, scopes, last_used_at, created_at')
      .eq('user_id', user.id)
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error) throw error;

    return NextResponse.json({ keys: data });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[api/keys GET] Error:', err);
    await logAutomation('api_keys.list', 'event', 'failure', null, msg);
    return NextResponse.json({ error: 'Failed to fetch keys' }, { status: 500 });
  }
}
