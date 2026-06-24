// Lazy service-role Supabase client.
//
// Route modules used to do `const admin = createClient(URL!, SERVICE_KEY!)` at
// module scope. Next.js imports every route module during `next build` ("collect
// page data"), so that eager call threw "supabaseUrl is required" whenever the
// build env lacked the vars (e.g. Vercel *preview* deployments) — failing the
// whole build. This proxy defers `createClient` to the first property access at
// request time, so importing the module never touches the network or env, while
// existing call sites (`admin.from(...)`, `admin.auth.admin...`) keep working.

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let _admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;
  const url =
    process.env.SUPABASE_URL ??
    process.env.NEXT_PUBLIC_SUPABASE_URL ??
    '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  if (!url || !key) {
    throw new Error(
      'Supabase admin credentials are not set (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)',
    );
  }
  _admin = createClient(url, key, { auth: { persistSession: false } });
  return _admin;
}

/**
 * Drop-in replacement for an eagerly-constructed service-role client. Real
 * instantiation happens on first property access (runtime), not at import.
 */
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const real = getSupabaseAdmin() as unknown as Record<string | symbol, unknown>;
    const value = real[prop];
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(real) : value;
  },
});
