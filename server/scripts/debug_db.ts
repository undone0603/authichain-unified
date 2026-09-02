import "dotenv/config";
import { getDb } from "../db.js";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function debugDb() {
  console.log("🔍 Debugging Database Connection...");
  console.log(`DATABASE_URL starts with: ${process.env.DATABASE_URL?.substring(0, 15)}...`);
  
  try {
    const db = await getDb();
    if (!db) {
      console.log("❌ getDb() returned null.");
      return;
    }
    
    // Attempt a simple query
    console.log("📡 Attempting simple query...");
    const result = await db.execute("SELECT 1+1 as result");
    console.log("✅ Query Success!", result);
    
  } catch (err: unknown) {
    console.error("❌ Database Error:", getErrorMessage(err));
  }
}

debugDb().catch(console.error);
