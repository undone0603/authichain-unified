import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
export function getHyperdriveDb(env: { HYPERDRIVE: { connectionString: string } }): ReturnType<typeof drizzle> {
  const workersPool = new Pool({ connectionString: env.HYPERDRIVE.connectionString });
  return drizzle(workersPool);
}
