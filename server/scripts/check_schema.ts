import "dotenv/config";
// Standalone Node CLI diagnostic script (run via tsx) — not a request
// handler, so there is no per-request db to thread in. Calling getDb()
// directly here is a documented bridge to the legacy server/db.ts singleton.
import { getDb } from "../db.js";

async function checkLeadsSchema() {
  console.log("🔍 Checking MySQL Schema for 'leads' table...");
  const d = await getDb();
  if (!d) {
    console.error("❌ Could not connect to DB.");
    return;
  }
  
  try {
    const result = await d.execute("DESCRIBE leads");
    const rows = (result as any).rows ?? result;
    console.log(JSON.stringify(rows, null, 2));
  } catch (err: any) {
    console.error("❌ Schema check failed:", err.message);
  }
  process.exit(0);
}

checkLeadsSchema().catch(console.error);
