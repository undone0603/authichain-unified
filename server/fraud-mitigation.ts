import { getDb } from "./db";
import { fraudAlerts, products, certificates } from "../src/db/schema";
import { eq, sql } from "drizzle-orm";
import { ConsensusResult } from "./_core/consensus";

/**
 * AuthiChain Autonomous Fraud Mitigation
 * 
 * Automatically responds to high-confidence counterfeit verdicts
 * by locking artifacts and notifying protocol guardians.
 */
export class FraudMitigation {
  
  static async triggerResponse(productId: number, consensus: ConsensusResult) {
    if (consensus.status !== 'counterfeit') return;

    console.log(`[FRAUD] Counterfeit detected for Product ${productId}. Executing response...`);
    const db = await getDb();

    // 1. Record the alert
    await db.insert(fraudAlerts).values({
      productId,
      alertType: "autonomous_mitigation",
      severity: consensus.finalScore < 30 ? "critical" : "high",
      status: "active",
      metadata: {
         consensusScore: consensus.finalScore,
         agentVerdicts: consensus.verdicts,
         timestamp: consensus.timestamp
      }
    });

    // 2. Lock the artifact (Set status to suspect in metadata)
    const [product] = await db.select().from(products).where(eq(products.id, productId)).limit(1);
    if (product) {
       const metadata = (product.metadata as any) || {};
       metadata.locked = true;
       metadata.lock_reason = "Autonomous Fraud Mitigation: High-Confidence Counterfeit Verdict";
       
       await db.update(products)
         .set({ 
            metadata,
            updatedAt: new Date()
         })
         .where(eq(products.id, productId));
    }

    // 3. Increment counterfeit reports
    await db.update(products)
      .set({ 
        counterfeitReports: sql`${products.counterfeitReports} + 1` 
      })
      .where(eq(products.id, productId));

    return { 
       action: "locked", 
       severity: consensus.finalScore < 30 ? "critical" : "high",
       timestamp: new Date().toISOString()
    };
  }
}
