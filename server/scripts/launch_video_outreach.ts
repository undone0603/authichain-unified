import "dotenv/config";
import { createMission, enqueueTask, getLeadByEmail } from "../db";

async function launchMedtronicVideoBriefing() {
  console.log("🎬 Initializing High-Prestige Video Outreach for Medtronic...");

  try {
    const leadEmail = "michael.chen@medtronic.com";
    const lead = await getLeadByEmail(leadEmail);
    
    if (!lead) {
      console.error(`❌ Lead not found for ${leadEmail}. Ensure the initial outreach mission ran.`);
      return;
    }

    // 1. Create the Video Briefing Mission
    const missionId = await createMission("MEDTECH_VIDEO_BRIEFING" as any);
    console.log(`✅ Mission Created: ${missionId}`);

    // 2. Enqueue the HeyGen Video Generation Task
    // This will use the 'Guardian' AI character to record a personalized script.
    await enqueueTask(
      missionId, 
      "GENERATE_OUTREACH_VIDEO", 
      { 
        leadId: lead.id,
        firstName: "Michael",
        company: "Medtronic",
        segment: "MEDTECH",
        useCase: "ISO 13485 audit automation and $400K recall-risk mitigation"
      }
    );

    // 3. Enqueue the Outbound Email (Sequence 2) containing the video link
    await enqueueTask(
      missionId, 
      "DRAFT_OUTBOUND_EMAIL", 
      { 
        leadEmail: lead.email,
        segment: "MEDTECH", 
        sequence: 2,
        includeVideo: true
      }
    );

    console.log("\n✨ Medtronic Video Pipeline is now ACTIVE.");
    console.log("AgentZ is generating the 'Guardian' briefing via HeyGen.");
    console.log("Monitor the progress in your dashboard under 'Active Missions'.");

  } catch (err: any) {
    console.error("❌ Failed to launch video mission:", err.message);
  }
}

launchMedtronicVideoBriefing().catch(console.error);
