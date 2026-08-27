import { invokeLLM } from "../server/_core/llm";
import { getDb, createLead, createAutopilotDecision, logActivity } from "../server/db";
import fs from "fs";
import path from "path";

/**
 * SBA Disaster Loan Lead-Gen & Dossier Generator
 * 
 * This script identifies high-impact businesses in disaster zones and
 * generates pre-filled application dossiers using AI.
 */

async function runSbaLeadGen() {
  console.log("🚀 Starting SBA Disaster Loan Lead-Gen Engine...");

  // Simulated target: Businesses affected by recent Florida hurricanes
  const targets = [
    { name: "Sunshine Citrus Co.", industry: "Agriculture", location: "Fort Myers, FL", disaster: "Hurricane Ian" },
    { name: "Gulf Breeze Marina", industry: "Maritime/Tourism", location: "Naples, FL", disaster: "Hurricane Ian" },
    { name: "Everglade Logistics", industry: "Transportation", location: "Miami, FL", disaster: "Flood Damage" }
  ];

  for (const target of targets) {
    console.log(`\n🔍 Processing target: ${target.name}...`);

    // 1. Create Lead in CRM
    const lead = await createLead({
      email: `contact@${target.name.toLowerCase().replace(/\s+/g, '')}.com`,
      name: "Business Owner",
      company: target.name,
      source: "SBA_DISASTER_ENGINE",
      status: "qualified"
    });

    // 2. Generate Application Dossier using AI
    const prompt = `You are an SBA Disaster Loan Specialist. Generate a clinical, professional application dossier for:
    Business: ${target.name}
    Industry: ${target.industry}
    Location: ${target.location}
    Disaster: ${target.disaster}
    
    Format: Professional Markdown Dossier.
    Include economic injury estimates and operational restoration plan.`;

    const response = await invokeLLM({
      messages: [{ role: "system", content: prompt }]
    });

    const dossierContent = response.choices[0].message.content as string;

    // 3. Save Dossier to 'docs/sba-dossiers/'
    const dossierDir = path.join(process.cwd(), "docs", "sba-dossiers");
    if (!fs.existsSync(dossierDir)) fs.mkdirSync(dossierDir, { recursive: true });
    
    const fileName = `${target.name.replace(/\s+/g, '_')}_SBA_Dossier.md`;
    fs.writeFileSync(path.join(dossierDir, fileName), dossierContent);
    console.log(`✅ Dossier saved to docs/sba-dossiers/${fileName}`);

    // 4. Log Autopilot Decision
    await createAutopilotDecision({
      type: "lead_generation",
      action: `Generate SBA Disaster Dossier for ${target.name}`,
      reasoning: `High economic injury probability due to ${target.disaster} in ${target.location}.`,
      confidence: 95,
      status: "executed",
      result: { fileName, leadId: lead.id }
    });

    await logActivity({
      userId: 1, // System/Admin
      action: "sba_dossier_generated",
      entityType: "lead",
      entityId: lead.id,
      details: { target, fileName }
    });
  }

  console.log("\n✨ SBA Disaster Loan Lead-Gen Complete.");
}

runSbaLeadGen().catch(console.error);
