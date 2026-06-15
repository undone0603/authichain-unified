import "dotenv/config";
import { runLiveSystemsCheck } from "./live-systems-check";
import * as db from "../db";

async function runSmokeTest() {
  console.log("🔥 Starting AuthiChain Production Smoke Test...");
  console.log("----------------------------------------------");

  // 1. Database Connectivity
  console.log("📡 Testing Database Connectivity...");
  try {
    const clients = await db.getWhiteLabelClients();
    console.log(`✅ Database Connected. Found ${clients.length} white-label clients.`);
  } catch (err: any) {
    console.error("❌ Database Connection Failed:", err.message);
  }

  // 2. Integration Health (Stripe, HubSpot, etc.)
  console.log("\n🔗 Testing Third-Party Integrations...");
  let health: any = { integrations: {}, blockers: [] };
  try {
    health = await runLiveSystemsCheck();
  } catch (err: any) {
    console.warn("⚠️  Live Systems Check encountered an error:", err.message);
  }
  
  const statusIcon = (res: any) => (res?.connected ? "✅" : res?.configured ? "⚠️ (Configured but not connected)" : "❌ (Not Configured)");
  
  console.log(`${statusIcon(health.integrations.stripe)} Stripe (Production)`);
  console.log(`${statusIcon(health.integrations.hubspot)} HubSpot`);
  console.log(`${statusIcon(health.integrations.gmail)} Gmail Outreach`);
  console.log(`${statusIcon(health.integrations.posthog)} PostHog Analytics`);

  // 3. Vertical Readiness (StrainChain, GovChain, QRON)
  console.log("\n🏢 Testing Vertical Readiness...");

  // QRON Storymode
  console.log("🎨 Testing QRON AI Engine...");
  try {
    const { invokeLLM } = await import("../_core/llm.js");
    const testAi = await invokeLLM({
      messages: [{ role: "user", content: "Say 'LLM_OK'" }],
    });
    if ((testAi.choices[0].message.content as string)?.includes("LLM_OK")) {
      console.log("✅ QRON AI Engine (Forge) is responding.");
    }
  } catch (err: any) {
    console.error("❌ QRON AI Engine Failed:", err.message);
  }

  // GovChain
  console.log("🏛️  Testing GovChain VC Service...");
  try {
    const { issueSovereignPassport } = await import("../govchain/vc-service.js");
    const testVc = await issueSovereignPassport({
      documentId: "SMOKE-TEST-001",
      issuerDid: "did:authichain:smoke",
      subjectDid: "did:authichain:test",
      claims: { purpose: "Smoke Test" }
    });
    if (testVc.proof) {
      console.log("✅ GovChain W3C VC generation is operational.");
    }
  } catch (err: any) {
    console.error("❌ GovChain VC Service Failed:", err.message);
  }

  console.log("\n----------------------------------------------");
  if (health.ready) {
    console.log("🚀 SYSTEM STATUS: MISSION READY.");
  } else {
    console.log("⚠️ SYSTEM STATUS: PARTIAL READINESS.");
    console.log("Blockers identified:", health.blockers?.join(", ") || "None");
  }
}

runSmokeTest().catch(console.error);

