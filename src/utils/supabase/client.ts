import { createBrowserClient } from '@supabase/ssr';

// Public-by-design Supabase config. The anon URL and anon key are meant to be
// shipped in the browser bundle (access is gated by Row Level Security, not by
// hiding these). They are inlined here as a BUILD-TIME FALLBACK so the browser
// client always constructs successfully — even if NEXT_PUBLIC_SUPABASE_* was
// not present at build time. Previously a missing env var made
// createBrowserClient throw "Your project's URL and API key are required",
// which crashed React hydration and took down every interactive element on the
// page (including the pricing checkout button). Env vars still take precedence
// when set, so rotating keys via the dashboard works without a code change.
const FALLBACK_SUPABASE_URL = 'https://nhdnkzhtadfkkluiulhs.supabase.co';
const FALLBACK_SUPABASE_ANON_KEY =
  '***REMOVED***';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || FALLBACK_SUPABASE_URL;
  const anonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || FALLBACK_SUPABASE_ANON_KEY;
  return createBrowserClient(url, anonKey);
}
