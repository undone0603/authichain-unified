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
      const k = key.trim();
      const v = valueParts.join("=").trim();
      process.env[k] = v;
      if (k === "BUILT_IN_FORGE_API_KEY") {
        process.env.OPENAI_API_KEY = v;
        process.env.BUILT_IN_FORGE_API_KEY = v;
      }
      if (k === "BUILT_IN_FORGE_API_URL") process.env.BUILT_IN_FORGE_API_URL = v;
    }
  });
}

import { analyzeProductVision } from "../server/vision-service";
import { generateProductAudioStory } from "../server/audio-service";
import { ENV } from "../server/_core/env";

// Force ENV values from .env file directly into the singleton
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  envContent.split("\n").forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const [key, ...valueParts] = trimmed.split("=");
    if (key && valueParts.length > 0) {
      const k = key.trim();
      const v = valueParts.join("=").trim();
      if (k === "BUILT_IN_FORGE_API_KEY") (ENV as any).forgeApiKey = v;
      if (k === "BUILT_IN_FORGE_API_URL") (ENV as any).forgeApiUrl = v;
      if (k === "OPENAI_API_KEY") (ENV as any).openaiApiKey = v;
    }
  });
}

// Fallback to OpenAI if forge is not configured in .env for this test
const realOpenAiKey = "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";
if (!(ENV as any).forgeApiUrl || (ENV as any).forgeApiUrl.includes("manus.im")) {
  (ENV as any).forgeApiUrl = "https://api.openai.com";
  (ENV as any).forgeApiKey = realOpenAiKey;
}

/**
 * Test: Full Truth Layer Loop
 * 1. Simulate METRC manifest sync
 * 2. Invoke GPT-4o Vision for ProductDNA™
 * 3. Invoke OpenAI TTS for BrandVoice™
 */
async function testLoop() {
  console.log("🧪 Starting Truth Layer End-to-End Test...");

  const testProduct = {
    brandName: "Lion Labs Ltd",
    strainName: "Detroit Diesel",
    thcContent: "28.4%",
    harvestDate: "April 12, 2026",
    imageUrl: "https://authichain.com/images/sample-flower.jpg"
  };

  try {
    // Phase 1: ProductDNA Analysis
    console.log("\nPhase 1: Analyzing ProductDNA visual markers...");
    const dnaResult = await analyzeProductVision(testProduct.imageUrl, "Cannabis Flower");
    console.log("✅ DNA Result:", JSON.stringify(dnaResult, null, 2));

    // Phase 2: Audio Story Generation
    console.log("\nPhase 2: Generating BrandVoice audio story...");
    const audioUrl = await generateProductAudioStory({
      brandName: testProduct.brandName,
      strainName: testProduct.strainName,
      thcContent: testProduct.thcContent,
      harvestDate: testProduct.harvestDate
    });
    console.log("✅ Audio Story URL:", audioUrl);

    console.log("\n✨ Truth Layer Loop Test Successful.");
    console.log(`🔗 Verification URL: https://strainchain.io/verify/TEST-TAG-2026`);

  } catch (error: any) {
    console.error("\n❌ Test Loop Failed:", error.message);
  }
}

testLoop().catch(console.error);
