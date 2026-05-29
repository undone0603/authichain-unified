import "dotenv/config";
import { getDb } from "../db";

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
    const result = await (db as any).execute("SELECT 1+1 as result");
    console.log("✅ Query Success!", result);
    
  } catch (err: any) {
    console.error("❌ Database Error:", err.message);
  }
}

debugDb().catch(console.error);
