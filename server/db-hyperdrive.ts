import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

/**
 * Creates a Drizzle instance backed by Cloudflare Hyperdrive.
 * Hyperdrive provides a connection string compatible with postgres.js,
 * so we use postgres.js (matching the rest of the codebase) instead of pg.
 * `prepare: false` is not needed here — Hyperdrive manages pooling.
 */
export function getHyperdriveDb(env: { HYPERDRIVE: { connectionString: string } }): ReturnType<typeof drizzle> {
  const client = postgres(env.HYPERDRIVE.connectionString);
  return drizzle(client);
}
