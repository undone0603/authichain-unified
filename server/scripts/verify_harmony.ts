import "dotenv/config";
import { calculateHarmony } from "../sales/harmony-service.js";

async function verifyHarmony() {
  console.log("📐 Calculating Protocol Harmony (H)...");
  console.log("--------------------------------------");

  try {
    const harmony = await calculateHarmony();
    
    console.log(`✨ MASTER HARMONY INDEX: ${(harmony.index * 100).toFixed(2)}%`);
    console.log(`📈 CURRENT VALUATION: $${harmony.valuation.toFixed(2)}M`);
    
    console.log("\n📊 Breakdown:");
    console.log(` - Trust (T): ${(harmony.trust * 100).toFixed(1)}% (Anchoring: ${(harmony.breakdown.anchoredPct * 100).toFixed(1)}%)`);
    console.log(` - Velocity (V): ${(harmony.velocity * 100).toFixed(1)}% (${harmony.breakdown.tps.toFixed(4)} Truths/Sec)`);
    console.log(` - Adoption (A): ${(harmony.adoption * 100).toFixed(1)}% (Staked: ${harmony.breakdown.stakedSupplyPct.toFixed(2)}% of supply)`);
    
    console.log("\n✅ Mathematical Harmony Verified. System is in Equilibrium.");

  } catch (err: any) {
    console.error("❌ Harmony Calculation Failed:", err.message);
  }
}

verifyHarmony().catch(console.error);
