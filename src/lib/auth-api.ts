import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    '[auth-api] Missing required env vars: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY. ' +
    'Server cannot start without these credentials.'
  );
}

const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

/**
 * Verify an industrial API key.
 * Returns the user_id if valid, or null.
 */
export async function verifyApiKey(apiKey: string): Promise<string | null> {
  if (!apiKey || !apiKey.startsWith('qron_')) return null;

  // Use 16-char prefix for lower collision probability
  const prefix = apiKey.substring(0, 16);

  const { data: keys, error } = await admin
    .from('api_keys')
    .select('user_id, key_hash, is_active')
    .eq('key_prefix', prefix)
    .eq('is_active', true);

  if (error || !keys || keys.length === 0) return null;

  const msgUint8 = new TextEncoder().encode(apiKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const incomingHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Timing-safe comparison to prevent oracle attacks
  const incomingBuf = Buffer.from(incomingHash, 'hex');
  const match = keys.find(k => {
    try {
      const storedBuf = Buffer.from(k.key_hash, 'hex');
      if (storedBuf.length !== incomingBuf.length) return false;
      return require('node:crypto').timingSafeEqual(storedBuf, incomingBuf);
    } catch {
      return false;
    }
  });

  if (!match) return null;

  admin
    .from('api_keys')
    .update({ last_used_at: new Date().toISOString() })
    .eq('key_hash', incomingHash)
    .then(undefined, (err) => {
      console.error('[auth-api] Failed to update api_keys.last_used_at:', err);
    });

  return match.user_id;
}
