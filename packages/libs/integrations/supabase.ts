// Supabase clients for AuthiChain Unified.
// Two projects are supported:
//   - QRON (primary): SUPABASE_URL / SUPABASE_ANON_KEY / SUPABASE_SERVICE_KEY (project ref: nhdnkzhtadfkkluiulhs)
//   - AuthiChain (MI):  SUPABASE_MI_URL / SUPABASE_MI_SERVICE_KEY (+ optional SUPABASE_MI_ANON_KEY)
// Secrets must come from environment variables, never hardcoded.
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

// ----- QRON project -----
const QRON_URL =
  process.env.SUPABASE_URL ||
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  process.env.VITE_SUPABASE_URL ||
  'https://nhdnkzhtadfkkluiulhs.supabase.co';

const QRON_ANON =
  process.env.SUPABASE_ANON_KEY ||
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  process.env.VITE_SUPABASE_ANON_KEY ||
  '';

const QRON_SERVICE_ROLE =
  process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || '';

let _qronBrowser: SupabaseClient | null = null;
let _qronAdmin: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (_qronBrowser) return _qronBrowser;
  if (!QRON_URL || !QRON_ANON) {
    throw new Error('[supabase:qron] Missing SUPABASE_URL or SUPABASE_ANON_KEY');
  }
  _qronBrowser = createClient(QRON_URL, QRON_ANON, { auth: { persistSession: true } });
  return _qronBrowser;
}

export function getSupabaseAdmin(): SupabaseClient {
  if (_qronAdmin) return _qronAdmin;
  if (!QRON_URL || !QRON_SERVICE_ROLE) {
    throw new Error('[supabase:qron] Missing SUPABASE_URL or SUPABASE_SERVICE_KEY (server-only)');
  }
  _qronAdmin = createClient(QRON_URL, QRON_SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _qronAdmin;
}

export const SUPABASE_PROJECT_REF = 'nhdnkzhtadfkkluiulhs';

// ----- AuthiChain (MI) project -----
const MI_URL = process.env.SUPABASE_MI_URL || '';
const MI_ANON = process.env.SUPABASE_MI_ANON_KEY || '';
const MI_SERVICE_ROLE = process.env.SUPABASE_MI_SERVICE_KEY || '';

let _miBrowser: SupabaseClient | null = null;
let _miAdmin: SupabaseClient | null = null;

export function getSupabaseAuthiChain(): SupabaseClient {
  if (_miBrowser) return _miBrowser;
  if (!MI_URL || !MI_ANON) {
    throw new Error('[supabase:mi] Missing SUPABASE_MI_URL or SUPABASE_MI_ANON_KEY');
  }
  _miBrowser = createClient(MI_URL, MI_ANON, { auth: { persistSession: true } });
  return _miBrowser;
}

export function getSupabaseAuthiChainAdmin(): SupabaseClient {
  if (_miAdmin) return _miAdmin;
  if (!MI_URL || !MI_SERVICE_ROLE) {
    throw new Error('[supabase:mi] Missing SUPABASE_MI_URL or SUPABASE_MI_SERVICE_KEY (server-only)');
  }
  _miAdmin = createClient(MI_URL, MI_SERVICE_ROLE, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _miAdmin;
}

export function hasAuthiChainSupabase(): boolean {
  return Boolean(MI_URL && (MI_SERVICE_ROLE || MI_ANON));
}
