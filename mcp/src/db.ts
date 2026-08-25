import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { eq, desc } from "drizzle-orm";
import { qrCodes } from "../../drizzle/schema.js";

const client = postgres(process.env.DATABASE_URL || "", { prepare: false });
const db = drizzle(client);

export async function getQronById(qronId: string) {
  const rows = await db.select().from(qrCodes).where(eq(qrCodes.shortCode, qronId)).limit(1);
  return rows[0] ?? null;
}

export async function getQronList() {
  return await db.select().from(qrCodes).orderBy(desc(qrCodes.createdAt)).limit(50);
}
