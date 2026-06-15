import "dotenv/config";
<<<<<<< HEAD
import { getDb } from "../db.js";
import { sql } from "drizzle-orm";
=======
import { getDb } from "../db";
>>>>>>> origin/add-agentz-editable

async function checkLeadsSchema() {
  console.log("🔍 Checking Schema for 'leads' table...");
  const d = await getDb();
  if (!d) {
    console.error("❌ Could not connect to DB.");
    return;
  }

  try {
<<<<<<< HEAD
    const rows = await d.execute(sql`SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'leads' ORDER BY ordinal_position`);
    console.log(JSON.stringify(rows.rows, null, 2));
=======
    const result = await d.execute("DESCRIBE leads");
    const rows = (result as any).rows ?? result;
    console.log(JSON.stringify(rows, null, 2));
>>>>>>> origin/add-agentz-editable
  } catch (err: any) {
    console.error("❌ Schema check failed:", err.message);
  }
  process.exit(0);
}

checkLeadsSchema().catch(console.error);
