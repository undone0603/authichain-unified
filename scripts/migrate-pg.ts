/**
 * @deprecated Use `pnpm db:migrate` (drizzle-kit migrate) instead.
 *
 * This wrapper is retained for callers that still invoke the historical script,
 * but it deliberately delegates to the same migration directory used by
 * drizzle.config.ts so there is only one migration source of truth.
 */
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error('DATABASE_URL is not set');
}

const migrationClient = postgres(databaseUrl, { max: 1 });
const db = drizzle(migrationClient);

async function main() {
  console.warn('DEPRECATED: use `pnpm db:migrate`; running the canonical drizzle/migrations directory.');
  await migrate(db, { migrationsFolder: './drizzle/migrations' });
  await migrationClient.end();
}

main().catch(async (err) => {
  console.error('Migration failed:', err);
  await migrationClient.end({ timeout: 1 }).catch(() => undefined);
  process.exit(1);
});
