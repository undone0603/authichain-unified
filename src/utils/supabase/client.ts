import { createBrowserClient } from '@supabase/ssr';

// Env vars are the source of truth. URL + anon key are public-by-design
// (access is gated by Row Level Security in the database).
// If either is missing at build time, return a graceful no-throw stub so
// React hydration never crashes. Supabase-dependent features degrade instead.
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    console.error(
      'Supabase credentials not found. Set NEXT_PUBLIC_SUPABASE_URL and ' +
      'NEXT_PUBLIC_SUPABASE_ANON_KEY in your build environment. ' +
      'Features requiring Supabase will be unavailable.'
    );
    // Return a no-throw Proxy that only errors if a method is actually invoked
    return new Proxy(
      {},
      {
        get: () => {
          throw new Error(
            'Supabase client not initialized. ' +
            'Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.'
          );
        },
      }
    ) as any;
  }

  return createBrowserClient(url, anonKey);
}
