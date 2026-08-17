import { drizzle } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';
import { env } from '@server/config';
let _db = null;
// Lazy singleton. Instantiating Postgres at module load crashed `next build`
// (and any import) whenever DATABASE_URL was absent at that moment. Defer the
// connection until first use so missing env never breaks the build.
export function getDb() {
    if (_db)
        return _db;
    // `prepare: false` makes postgres-js compatible with Supabase's transaction
    // pooler (pgbouncer, port 6543) — the serverless-safe endpoint that avoids
    // exhausting connections from short-lived Vercel functions.
    const client = postgres(env.DATABASE_URL, { prepare: false });
    _db = drizzle(client, { schema });
    return _db;
}
// Back-compat: existing `import { db }` call sites keep working. The Proxy
// defers connection to first property access via getDb().
export const db = new Proxy({}, {
    get(_target, prop) {
        const real = getDb();
        return real[prop];
    },
});
