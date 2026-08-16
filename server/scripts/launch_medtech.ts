import "dotenv/config";
import { createMission, enqueueTask } from "../db.js";

async function launchMedTech() {
  console.log("🚀 Launching MedTech Outreach Mission via Native DB Bridge...");

  try {
    // 1. Create the mission
    const missionId = await createMission("MEDTECH_OUTREACH" as any);
    console.log(`✅ Mission Created: ${missionId}`);

    // 2. Enqueue the sequence tasks
    await enqueueTask(
      missionId, 
      "FIND_MEDTECH_LEADS", 
      { count: 10, icp: "Compliance Director at medical device manufacturer" }
    );
    
    await enqueueTask(
      missionId, 
      "DRAFT_OUTBOUND_EMAIL", 
      { segment: "MEDTECH", sequence: 1 }
    );

    console.log("\n✨ MedTech pipeline is now LIVE.");
    console.log("AgentZ has been notified and is beginning lead discovery.");
    console.log("Review drafts at: /email-campaigns");

  } catch (err: any) {
    console.error("❌ Failed to launch mission:", err.message);
    if (err.message.includes("Database not available")) {
      console.log("HINT: Ensure DATABASE_URL is set in your environment.");
    }
  }
}

launchMedTech().catch(console.error);
