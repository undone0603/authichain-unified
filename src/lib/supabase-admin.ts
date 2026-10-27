// Lazy service-role Supabase client.
//
// Route modules used to do `const admin = createClient(URL!, SERVICE_KEY!)` at
// module scope. Next.js imports every route module during `next build` ("collect
// page data"), so that eager call threw "supabaseUrl is required" whenever the
// build env lacked the vars (e.g. Vercel *preview* deployments) — failing the
// whole build. This proxy defers `createClient` to the first property access at
// request time, so importing the module never touches the network or env, while
// existing call sites (`admin.from(...)`, `admin.auth.admin...`) keep working.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { getCloudflareContext } from "@opennextjs/cloudflare";

let _admin: SupabaseClient | null = null;

// Runtime env resolution (CFA-443 / CFA-444). On Cloudflare (OpenNext) the
// secrets live on the Worker bindings; read them from getCloudflareContext().env
// first, then process.env. next.config.js inlines process.env.NEXT_PUBLIC_* at
// build time (as '' in our builds), so the runtime binding is the only reliable
// source for NEXT_PUBLIC_SUPABASE_URL. Empty/whitespace values count as missing.
function cfEnv(name: string): string {
  try {
    const env = getCloudflareContext().env as unknown as Record<
      string,
      unknown
    >;
    const v = env?.[name];
    return v == null ? "" : String(v).trim();
  } catch {
    // Outside a Cloudflare request (build, tests, Node): no context.
    return "";
  }
}

function procEnv(name: string): string {
  const v = process.env[name];
  return v == null ? "" : String(v).trim();
}

/** Cloudflare binding first, then process.env; trimmed, '' when missing. */
function readEnv(name: string): string {
  return cfEnv(name) || procEnv(name);
}

export function getSupabaseAdmin(): SupabaseClient {
  if (_admin) return _admin;
  const url =
    cfEnv("SUPABASE_URL") ||
    cfEnv("NEXT_PUBLIC_SUPABASE_URL") ||
    procEnv("SUPABASE_URL") ||
    procEnv("NEXT_PUBLIC_SUPABASE_URL");
  const key = readEnv("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) {
    // Names only. Never log values, partial values or lengths.
    const missing: string[] = [];
    if (!url) missing.push("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL");
    if (!key) missing.push("SUPABASE_SERVICE_ROLE_KEY");
    console.error("supabase-admin: missing or empty env", missing);
    throw new Error(
      "Supabase admin credentials are not set (SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY)"
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
    const real = getSupabaseAdmin() as unknown as Record<
      string | symbol,
      unknown
    >;
    const value = real[prop];
    return typeof value === "function"
      ? (value as (...args: unknown[]) => unknown).bind(real)
      : value;
  },
});
