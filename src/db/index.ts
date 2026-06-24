import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

type DB = PostgresJsDatabase<typeof schema>;

let _db: DB | null = null;

// Lazy singleton. Instantiating Postgres at module load crashed `next build`
// (and any import) whenever DATABASE_URL was absent at that moment. Defer the
// connection until first use so missing env never breaks the build.
export function getDb(): DB {
  if (_db) return _db;
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL is not set');
  }
  // `prepare: false` makes postgres-js compatible with Supabase's transaction
  // pooler (pgbouncer, port 6543) — the serverless-safe endpoint that avoids
  // exhausting connections from short-lived Vercel functions.
  const client = postgres(connectionString, { prepare: false });
  _db = drizzle(client, { schema });
  return _db;
}

// Back-compat: existing `import { db }` call sites keep working. The Proxy
// defers connection to first property access via getDb().
export const db: DB = new Proxy({} as DB, {
  get(_target, prop) {
    const real = getDb() as unknown as Record<string | symbol, unknown>;
    return real[prop];
  },
});
