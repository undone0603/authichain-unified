import "dotenv/config";
import { getDb } from "../db.js";
import { sql } from "drizzle-orm";

async function checkLeadsSchema() {
  console.log("🔍 Checking Schema for 'leads' table...");
  const d = await getDb();
  if (!d) {
    console.error("❌ Could not connect to DB.");
    return;
  }

  try {
    const rows = await d.execute(sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'leads' ORDER BY ordinal_position`);
    console.log(JSON.stringify(rows, null, 2));
  } catch (err: any) {
    console.error("❌ Schema check failed:", err.message);
  }
  process.exit(0);
}

checkLeadsSchema().catch(console.error);
