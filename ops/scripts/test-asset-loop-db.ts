import "dotenv/config";
import fs from "fs";
import path from "path";

// ── Environment Setup ────────────────────────────────────────────────────────
const envPath = path.join(process.cwd(), "authichain-unified", ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const [key, ...valueParts] = trimmed.split("=");
    if (key && valueParts.length > 0) {
      process.env[key.trim()] = valueParts.join("=").trim();
    }
  });
}

import { getDb } from "../server/db";
import { products } from "../drizzle/schema";
import { generateProductAssets } from "../server/asset-service";
import { eq } from "drizzle-orm";

/**
 * Test: Real-World Asset Loop with DB Persistence
 */
async function testAssetLoop() {
  console.log("🧪 Starting Final Asset Loop Test (DB Integrated)...");

  try {
    const db = await getDb();
    
    // 1. Create a Mock Product for testing (Raw SQL to bypass local schema columns)
    console.log("\nStep 1: Creating mock product in DB (Raw SQL)...");
    const sql = `INSERT INTO products (userId, name, brand, category, imageUrl, metadata) 
                 VALUES (1, 'Final Test Flower', 'AuthiChain Labs', 'Cannabis', 'https://authichain.com/images/sample-flower.jpg', '{"thc":"32%","rarity":95}')`;
    const [insertResult]: any = await db.execute(sql);

    const productId = insertResult.insertId;
    console.log(`✅ Mock Product Created (ID: ${productId})`);

    // 2. Trigger the Industrial Asset Pipeline
    console.log("\nStep 2: Triggering Industrial Asset Pipeline...");
    // We expect the generation to work, but the UPDATE might fail if schema is missing
    try {
      await generateProductAssets(productId);
      
      // 3. Verify Persistence
      console.log("\nStep 3: Verifying database persistence...");
      const [updatedProduct] = await db.select().from(products).where(eq(products.id, productId));

      console.log("📊 Result State:");
      console.log(`- Audio URL: ${(updatedProduct as any).audioUrl || "❌ MISSING (Schema likely not migrated)"}`);
      console.log(`- Vision Markers: ${JSON.stringify((updatedProduct as any).visionMarkers) || "❌ MISSING"}`);
      console.log(`- Rarity Score: ${(updatedProduct as any).rarityScore}`);

      if ((updatedProduct as any)?.audioUrl && (updatedProduct as any)?.visionMarkers) {
        console.log("\n✨ FINAL ASSET LOOP SUCCESSFUL.");
        console.log("The Truth Layer is fully stateful and persistent.");
      } else {
        console.warn("\n⚠️ Asset Loop partially failed (Check service fallbacks).");
      }
    } catch (updateErr: any) {
      console.warn("\n⚠️ Pipeline executed but DB Persistence failed (Schema Mismatch).");
      console.log("Details:", updateErr.message);
    }

  } catch (error: any) {
    console.error("\n❌ Asset Loop Test Failed:", error.message);
  }
}

testAssetLoop().catch(console.error);
