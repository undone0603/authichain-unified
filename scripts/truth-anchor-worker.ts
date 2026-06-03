import dotenv from "dotenv";
dotenv.config({ path: ".env.local" });
dotenv.config();

import { getDb } from "../server/db";
import { products, activityLog } from "../src/db/schema";
import { eq, isNull, and, gte } from "drizzle-orm";
import { anchorToPolygon } from "../src/actions/anchor";
import { linkOrdinalToProduct } from "../server/ordinals-service";

/**
 * TRUTH ANCHOR WORKER
 * Autonomously batches high-fidelity product proofs and anchors them to L1/L2.
 */
async function main() {
  console.log("🛠 [Truth Anchor] Starting Daily Batched Anchoring...");
  
  const db = await getDb();
  if (!db) {
    console.error("❌ Database not available.");
    return;
  }

  // 1. Identify Candidates
  // High-value products (score > 90) that haven't been anchored yet
  const candidates = await db.select()
    .from(products)
    .where(and(
      isNull(products.blockchainTxHash),
      gte(products.authenticityScore, 90)
    ))
    .limit(10); // Batch size

  if (candidates.length === 0) {
    console.log("✅ No pending high-value products for anchoring.");
    return;
  }

  console.log(`🔍 Found ${candidates.length} candidates for anchoring.`);

  for (const p of candidates) {
    try {
      console.log(`\n--- 📦 Anchoring Product: ${p.name} (ID: ${p.id}) ---`);
      
      // A. Polygon L2 Anchor
      // Using a mock tag or serial for the anchor
      const tag = p.truemarkId || `AC-BATCH-${p.id}`;
      const edgeHash = p.blockchainHash || `0x${Buffer.from(p.name).toString('hex').padEnd(64, '0')}`;
      
      console.log(`[L2] Anchoring to Polygon...`);
      const polyRes = await anchorToPolygon(tag, edgeHash, p.id);
      
      if (polyRes.success) {
        console.log(`✅ Polygon Success: ${polyRes.txHash}`);
        
        // Update product state
        await db.update(products)
          .set({ 
            blockchainTxHash: polyRes.txHash,
            updatedAt: new Date()
          })
          .where(eq(products.id, p.id));

        // B. Flag for Bitcoin L1 Inscription (Simulation)
        // High-prestige brands or VIP products get Bitcoin L1 "Absolute Truth"
        if (p.isRegistered || p.category === 'Luxury') {
          console.log(`[L1] High-prestige item. Scheduling Bitcoin Inscription...`);
          // In this implementation, we link a simulated inscription ID
          const mockInscriptionId = `${polyRes.txHash.slice(2, 66)}i0`;
          await linkOrdinalToProduct(p.id, mockInscriptionId);
        }

        // C. Log to Activity Ledger
        await db.insert(activityLog).values({
          userId: p.userId,
          action: "truth_anchored",
          entityType: "product",
          entityId: p.id,
          details: { 
            l2_tx: polyRes.txHash, 
            l1_target: "scheduled",
            score: p.authenticityScore 
          }
        });

      } else {
        console.error(`❌ Polygon Anchoring failed: ${polyRes.error}`);
      }

    } catch (err) {
      console.error(`❌ Unexpected error anchoring product ${p.id}:`, err);
    }
  }

  console.log("\n🏁 [Truth Anchor] Batch processing complete.");
}

main().catch(console.error);
