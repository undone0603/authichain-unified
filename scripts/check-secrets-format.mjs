/**
 * Validates the format of critical repository secrets to catch misconfigurations early in CI.
 */
function validateSupabaseUrl(url) {
  if (!url) return true; // Optional secrets handled by workflow logic
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return false;
    if (!parsed.hostname.endsWith('.supabase.co')) return false;
    return true;
  } catch {
    return false;
  }
}

function validateDatabaseUrl(url) {
  if (!url) return true;
  try {
    const parsed = new URL(url);
    const host = parsed.hostname;
    const port = parsed.port;

    // Supabase Pooler usually uses port 6543
    if (port === '5432') {
      console.warn('::warning::DATABASE_URL uses port 5432 (Direct connection). Supabase direct hosts are IPv6-only and will fail on GitHub runners. Use the Pooler (port 6543).');
    }
    
    if (host.includes('.pooler.supabase.com')) return true;
    if (host.startsWith('db.')) {
      console.error(`::error::DATABASE_URL host "${host}" appears to be a direct Supabase host. These are IPv6-only and will fail.`);
      return false;
    }
    return true;
  } catch {
    return false;
  }
}

const secrets = {
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  DATABASE_URL: process.env.DATABASE_URL,
};

let failed = false;

if (secrets.NEXT_PUBLIC_SUPABASE_URL && !validateSupabaseUrl(secrets.NEXT_PUBLIC_SUPABASE_URL)) {
  console.error(`::error::NEXT_PUBLIC_SUPABASE_URL "${secrets.NEXT_PUBLIC_SUPABASE_URL}" is not a valid Supabase URL.`);
  failed = true;
}

if (secrets.DATABASE_URL && !validateDatabaseUrl(secrets.DATABASE_URL)) {
  failed = true;
}

if (failed) {
  process.exit(1);
}

console.log('Secrets format validation passed.');
