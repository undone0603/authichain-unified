import "dotenv/config";
import { runLiveSystemsCheck } from "./live-systems-check.js";
import * as db from "../db.js";

type IntegrationHealth = Awaited<ReturnType<typeof runLiveSystemsCheck>>;

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

async function runSmokeTest() {
  console.log("🔥 Starting AuthiChain Production Smoke Test...");
  console.log("----------------------------------------------");

  // 1. Database Connectivity
  console.log("📡 Testing Database Connectivity...");
  try {
    const clients = await db.getWhiteLabelClients();
    console.log(`✅ Database Connected. Found ${clients.length} white-label clients.`);
  } catch (err: unknown) {
    console.error("❌ Database Connection Failed:", getErrorMessage(err));
  }

  // 2. Integration Health (Stripe, HubSpot, etc.)
  console.log("\n🔗 Testing Third-Party Integrations...");
  let health: IntegrationHealth = {
    timestamp: new Date().toISOString(),
    integrations: {
      stripe: { configured: false, connected: false },
      hubspot: { configured: false, connected: false },
      gmail: { configured: false, connected: false },
      posthog: { configured: false, connected: false },
      ga4: { configured: false, connected: false },
    },
    blockers: [],
    ready: false,
  };
  try {
    health = await runLiveSystemsCheck();
  } catch (err: unknown) {
    console.warn("⚠️  Live Systems Check encountered an error:", getErrorMessage(err));
  }
  
  const statusIcon = (res: IntegrationHealth["integrations"][keyof IntegrationHealth["integrations"]]) => (res?.connected ? "✅" : res?.configured ? "⚠️ (Configured but not connected)" : "❌ (Not Configured)");
  
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
  } catch (err: unknown) {
    console.error("❌ QRON AI Engine Failed:", getErrorMessage(err));
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
  } catch (err: unknown) {
    console.error("❌ GovChain VC Service Failed:", getErrorMessage(err));
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
