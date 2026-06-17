import { createClient } from '@supabase/supabase-js';

// Lazily create the admin client at REQUEST time. Creating it (or throwing on
// missing env) at module scope crashed the Cloudflare Workers build during
// Next.js page-data collection for every route that transitively imports this.
let _admin: ReturnType<typeof createClient> | null = null;
function getAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error(
      '[auth-api] Missing required env vars: NEXT_PUBLIC_SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY. ' +
      'Server cannot serve authenticated requests without these credentials.'
    );
  }
  if (!_admin) _admin = createClient(url, key);
  return _admin;
}

/**
 * Verify an industrial API key.
 * Returns the user_id if valid, or null.
 */
export async function verifyApiKey(apiKey: string): Promise<string | null> {
  if (!apiKey || !apiKey.startsWith('qron_')) return null;

  const admin = getAdmin();

  // Use 16-char prefix for lower collision probability
  const prefix = apiKey.substring(0, 16);

  // The admin client is created without DB generics, so the query builder
  // infers row types as `never`. Type the selected columns explicitly.
  const { data: keysData, error } = await admin
    .from('api_keys')
    .select('user_id, key_hash, is_active')
    .eq('key_prefix', prefix)
    .eq('is_active', true);

  const keys = keysData as Array<{ user_id: string; key_hash: string; is_active: boolean }> | null;

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
    // Update payload typed as `never` without DB generics; cast to the row shape.
    .update({ last_used_at: new Date().toISOString() } as never)
    .eq('key_hash', incomingHash)
    .then(undefined, (err) => {
      console.error('[auth-api] Failed to update api_keys.last_used_at:', err);
    });

  return match.user_id;
}
