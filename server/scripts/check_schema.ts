import "dotenv/config";
import { getDb } from "../db.js";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function checkLeadsSchema() {
  console.log("🔍 Checking MySQL Schema for 'leads' table...");
  const d = await getDb();
  if (!d) {
    console.error("❌ Could not connect to DB.");
    return;
  }
  
  try {
    const result = await d.execute("DESCRIBE leads");
    const rows = (result as { rows?: unknown }).rows ?? result;
    console.log(JSON.stringify(rows, null, 2));
  } catch (err: unknown) {
    console.error("❌ Schema check failed:", getErrorMessage(err));
  }
  process.exit(0);
}

checkLeadsSchema().catch(console.error);
