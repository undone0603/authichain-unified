import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

type DrizzleInstance = ReturnType<typeof drizzle>;
let _db: DrizzleInstance | null = null;

export async function getDb() {
  if (_db) return _db;

  if (!process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL environment variable is not set");
  }

  try {
    const pool = new Pool({
      connectionString: process.env.DATABASE_URL,
    });
    _db = drizzle(pool);
    return _db;
  } catch (error) {
    console.error("[Database] Failed to connect:", error);
    throw error;
  }
}

// Synchronous proxy for feature modules - throws if DB not initialised
export const db: DrizzleInstance = new Proxy({} as DrizzleInstance, {
  get(_target, prop: string | symbol) {
    if (!_db) throw new Error("Database not available");
    return Reflect.get(_db as object, prop as string);
  },
});
