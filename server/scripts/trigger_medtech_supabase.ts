import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

async function triggerMedTechSupabase() {
  const url = process.env.SUPABASE_URL || "https://dbwoikpflfruikspdnfc.supabase.co";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!key) {
    console.error("SUPABASE_SERVICE_ROLE_KEY not found.");
    return;
  }

  const supabase = createClient(url, key);

  console.log("🚀 Triggering MedTech Outreach via Supabase SDK...");

  try {
    // 1. Create Mission
    const { data: mission, error: mErr } = await supabase
      .from("missions")
      .insert({
        type: "MEDTECH_OUTREACH",
        status: "PLANNED",
        priority: 10,
        title: "MedTech Outreach – Device Manufacturers (Supabase Launch)",
      })
      .select()
      .single();

    if (mErr) throw mErr;
    console.log(`✅ Mission Created: ${mission.id}`);

    // 2. Create Tasks
    const { error: tErr } = await supabase
      .from("mission_tasks")
      .insert([
        {
          mission_id: mission.id,
          kind: "FIND_MEDTECH_LEADS",
          status: "PENDING",
          priority: 1,
          payload: { count: 10, icp: "Compliance Director at medical device manufacturer" }
        },
        {
          mission_id: mission.id,
          kind: "DRAFT_OUTBOUND_EMAIL",
          status: "PENDING",
          priority: 2,
          payload: { segment: "MEDTECH", sequence: 1 }
        }
      ]);

    if (tErr) throw tErr;
    
    console.log("\n✨ MedTech pipeline initialized.");
    console.log("AgentZ is processing leads. Review drafts at: /email-campaigns");

  } catch (err: any) {
    console.error("❌ Supabase Error:", err.message);
  }
}

triggerMedTechSupabase().catch(console.error);
