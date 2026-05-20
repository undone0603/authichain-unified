import "dotenv/config";
import { getDb } from "../db.js";

async function checkLeadsSchema() {
  console.log("🔍 Checking MySQL Schema for 'leads' table...");
  const d = await getDb();
  if (!d) {
    console.error("❌ Could not connect to DB.");
    return;
  }
  
  try {
    const [rows] = await d.execute("DESCRIBE leads");
    console.log(JSON.stringify(rows, null, 2));
  } catch (err: any) {
    console.error("❌ Schema check failed:", err.message);
  }
  process.exit(0);
}

checkLeadsSchema().catch(console.error);
