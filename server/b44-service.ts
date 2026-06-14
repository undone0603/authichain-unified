/**
 * AuthiChain B44 Super Agent Integration
 * Connects the unified backend to the B44 ProductDNA engine.
 * URL: https://chain-pay-a81f7780.base44.app/
 */
import { ENV } from "./_core/env";
import * as db from "./db";

const B44_BASE_URL = "https://chain-pay-a81f7780.base44.app";
const FREE_TIER_MONTHLY_LIMIT = 50; // Assumed free tier cap for ProductDNA analysis

/**
 * Checks if B44 usage is within the free tier limit for the current month.
 */
async function isWithinB44FreeTier() {
  const now = new Date();
  const usageCount = await db.getAutopilotDecisionCountByMonth();
  return usageCount.data < FREE_TIER_MONTHLY_LIMIT;
}

/**
 * Analyzes a product image using B44 ProductDNA logic.
 * Respects the monthly free tier constraint.
 */
export async function analyzeProductDNA(imageUrl: string, productType: string) {
  if (!(await isWithinB44FreeTier())) {
    console.warn("🛑 B44 Free Tier limit reached. Skipping DNA analysis.");
    return { success: false, error: "Monthly free tier limit reached" };
  }

  console.log(`🧬 Invoking B44 Super Agent for ProductDNA Analysis [${productType}]...`);

  try {
    const response = await fetch(`${B44_BASE_URL}/api/dna/analyze`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        imageUrl,
        context: productType,
        timestamp: new Date().toISOString()
      })
    });

    if (!response.ok) throw new Error(`B44 Agent Error: ${response.statusText}`);

    const result = await response.json();

    // Log the DNA analysis in Autopilot Decisions for tracking
    await db.createAutopilotDecision({
      type: "dna_verification",
      action: "ProductDNA Snapshot",
      reasoning: "Utilized B44 Base44 Super Agent for high-fidelity image analysis.",
      confidence: result.confidence || 95,
      status: "executed",
      result
    });

    return result;

  } catch (error: any) {
    console.error("[B44 Integration] Analysis failed:", error.message);
    return { success: false, error: error.message };
  }
}

/**
 * Generates an Audio AI Story via B44 for a consumer scan.
 */
export async function generateAudioStory(productMetadata: any) {
  console.log(`🎙️ B44 Agent: Generating Audio AI Story for ${productMetadata.name}...`);

  try {
    const response = await fetch(`${B44_BASE_URL}/api/story/generate-audio`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(productMetadata)
    });

    const result = await response.json();
    return result.audioUrl;

  } catch (error: any) {
    console.warn("[B44 Integration] Audio story generation failed:", error.message);
    return null;
  }
}
