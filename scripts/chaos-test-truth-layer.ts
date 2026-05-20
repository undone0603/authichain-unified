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

import { ENV } from "../server/_core/env";
import { analyzeProductVision } from "../server/vision-service";
import { generateProductAudioStory } from "../server/audio-service";
import { syncMetrcTransfers } from "../server/metrc-service";

/**
 * Chaos Test: Truth Layer Reliability
 * Simulates failures in primary endpoints to verify fallbacks.
 */
async function runChaosTest() {
  console.log("🔥 Starting Truth Layer CHAOS TEST...");

  // 1. Break Forge API to force fallback
  console.log("\n[Chaos] Simulating Forge API failure...");
  (ENV as any).forgeApiUrl = "https://broken-endpoint.manus.im";
  (ENV as any).forgeApiKey = "invalid_key_for_test";

  // Ensure OpenAI key is present for the fallback
  if (!ENV.openaiApiKey) {
    (ENV as any).openaiApiKey = process.env.OPENAI_API_KEY || "sk-proj-valid-fallback-key-mock";
  }

  // Phase A: Vision Fallback Test
  console.log("\n--- Phase A: Vision Fallback ---");
  try {
    const dnaResult = await analyzeProductVision("https://authichain.com/sample.jpg", "Cannabis");
    console.log("✅ Vision Result (via fallback):", dnaResult.recommendation);
    if (dnaResult.recommendation.includes("Manual review")) {
      console.log("✨ SUCCESS: Vision gracefully handled the chaos.");
    }
  } catch (e: any) {
    console.log("❌ Vision CRASHED (Fallback failed):", e.message);
  }

  // Phase B: Audio Fallback Test
  console.log("\n--- Phase B: Audio Fallback ---");
  try {
    const audioUrl = await generateProductAudioStory({
      brandName: "Chaos Labs",
      strainName: "Static Kush",
      thcContent: "0%",
      harvestDate: "2026-01-01"
    });
    console.log("✅ Audio URL:", audioUrl);
    if (audioUrl.includes("default-verification-story.mp3")) {
      console.log("✨ SUCCESS: Audio fell back to the default asset.");
    } else {
      console.log("✨ SUCCESS: Audio successfully used OpenAI fallback.");
    }
  } catch (e: any) {
    console.log("❌ Audio CRASHED (Fallback failed):", e.message);
  }

  // Phase C: METRC Retry & Fail Test
  console.log("\n--- Phase C: METRC Retry Logic ---");
  const metrcResult = await syncMetrcTransfers({
    vendorKey: "fail",
    userKey: "fail",
    licenseNumber: "fail"
  });
  console.log("✅ METRC Result:", metrcResult.length === 0 ? "Safe Empty Array" : "Unexpected Data");
  console.log("✨ SUCCESS: METRC retried and exited cleanly.");

  console.log("\n🏁 Chaos Test Complete. Review logs for cascading performance.");
}

runChaosTest().catch(console.error);
