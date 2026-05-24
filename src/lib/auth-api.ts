import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const admin = createClient(supabaseUrl, serviceKey);

/**
 * Verify an industrial API key.
 * Returns the user_id if valid, or null.
 */
export async function verifyApiKey(apiKey: string): Promise<string | null> {
  if (!apiKey || !apiKey.startsWith('qron_')) return null;

  const prefix = apiKey.substring(0, 10);

  // 1. Find keys by prefix
  const { data: keys, error } = await admin
    .from('api_keys')
    .select('user_id, key_hash, is_active')
    .eq('key_prefix', prefix)
    .eq('is_active', true);

  if (error || !keys || keys.length === 0) return null;

  // 2. Hash the incoming key to compare
  const msgUint8 = new TextEncoder().encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const incomingHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // 3. Find match
  const match = keys.find(k => k.key_hash === incomingHash);
  if (!match) return null;

  // 4. Update last used (fire and forget)
  admin
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('key_hash', incomingHash)
    .then(undefined, (err) => {
      console.error('[auth-api] Failed to update api_keys.last_used_at:', err);
    });

  return match.user_id;
}
