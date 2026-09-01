import "dotenv/config";
import { startGovernmentEngine } from "../../src/agents/government-lead-gen-v2.js";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function runGovEngine() {
  console.log("🏛️  Launching GovChain Federal Discovery Engine...");
  console.log("-----------------------------------------------");

  try {
    const result = await startGovernmentEngine();
    console.log("\n-----------------------------------------------");
    console.log(`✅ Discovery Run Complete.`);
    console.log(`📊 Leads Found: ${result.total}`);
    console.log(`🎯 Leads Processed: ${result.processed}`);
    console.log(`🛡️  Dry Run: ${result.dryRun}`);
    
    if (result.processed > 0) {
      console.log("\n✨ Potential high-value government leads identified.");
      console.log("Check the logs above for specific agencies and opportunities.");
    }
  } catch (err: unknown) {
    console.error("❌ Gov Engine Failed:", getErrorMessage(err));
  }
}

runGovEngine().catch(console.error);
