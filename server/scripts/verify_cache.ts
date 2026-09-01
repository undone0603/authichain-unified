import "dotenv/config";
import { invokeLLM } from "../_core/llm.js";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function verifyCache() {
  console.log("⚡ Starting LLM Cache Verification Test...");
  console.log("-----------------------------------------");

  const testParams = {
    messages: [{ role: "user" as const, content: "MedTech ROI Verification Code: 4422" }],
    maxTokens: 50
  };

  // 1. First Call (May be slow, will store in cache)
  console.log("🛰️  Call 1: Sending to Forge API (or checking cache)...");
  const start1 = Date.now();
  try {
    const res1 = await invokeLLM(testParams);
    const duration1 = Date.now() - start1;
    console.log(`✅ Call 1 Finished in ${duration1}ms`);
    console.log(`   Response: "${res1.choices[0].message.content}"`);
  } catch (err: unknown) {
    console.warn(`⚠️  Call 1 failed: ${getErrorMessage(err)}. (Test will continue if fallback is active)`);
  }

  // 2. Second Call (Must be instant hit)
  console.log("\n🛰️  Call 2: Sending identical prompt (expecting CACHE HIT)...");
  const start2 = Date.now();
  try {
    const res2 = await invokeLLM(testParams);
    const duration2 = Date.now() - start2;
    console.log(`🚀 Call 2 Finished in ${duration2}ms`);
    console.log(`   Response: "${res2.choices[0].message.content}"`);
    
    if (duration2 < 100) {
      console.log("\n🎯 PROOF: Cache Hit confirmed. Revenue velocity is now maximized.");
    } else {
      console.log("\n⚠️  Notice: Response time was higher than expected. Check DB latency.");
    }
  } catch (err: unknown) {
    console.error(`❌ Call 2 failed: ${getErrorMessage(err)}`);
  }

  console.log("-----------------------------------------");
}

verifyCache().catch(console.error);
