import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq, desc } from "drizzle-orm";
import { qrCodes } from "./schema.js";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
const db = drizzle(pool);

export async function getQronById(qronId: string) {
  const rows = await db
    .select()
    .from(qrCodes)
    .where(eq(qrCodes.shortCode, qronId))
    .limit(1);
  return rows[0] ?? null;
}

export async function getQronList() {
  return await db
    .select()
    .from(qrCodes)
    .orderBy(desc(qrCodes.createdAt))
    .limit(50);
}
