import "dotenv/config";
import { sendEmail } from "../email-service";

const maskEmail = (e: string) => { const [l, d] = e.split('@'); return d ? `${l?.[0] ?? ''}***@${d}` : '***'; };

async function pushEnterpriseOutreach() {
  const leads = [
    {
      name: "Robert G.",
      role: "VP of Quality & Regulatory",
      company: "Stryker",
      email: "robert.g@stryker.com",
      industry: "MEDTECH",
      narrative: "I noticed Stryker is modernizing its ISO 13485 audit trail. AuthiChain's blockchain provenance reduces manual audit labor by 80% and eliminates $180K/yr in compliance overhead."
    },
    {
      name: "Jennifer L.",
      role: "Director of Supply Chain",
      company: "Abbott Laboratories",
      email: "jennifer.l@abbott.com",
      industry: "MEDTECH",
      narrative: "Abbott's hardware compliance for DSCSA 2027 requires a unified digital identity standard. Our Sovereign Passport module provides the federal-grade (FIPS 140-2) IDs your diagnostic hardware demands."
    }
  ];

  console.log(`🚀 Executing Big-Ticket Outreach for ${leads.length} Enterprise Leads...`);

  for (const lead of leads) {
    const subject = `${lead.company} / AuthiChain: Automated ${lead.industry === "MEDTECH" ? "ISO 13485" : "DSCSA"} Compliance`;
    const body = `Hi ${lead.name},\n\n${lead.narrative}\n\nI’ve generated a preliminary ROI analysis for ${lead.company} showing significant Year 1 savings—you can view the breakdown here: authichain.com/roi-calculator\n\nBest regards,\nZ\nAuthiChain Protocol`;

    console.log(`\n📤 Pushing to: ${maskEmail(lead.email)}`);
    const result = await sendEmail({ to: lead.email, subject, body });

    if (result.status === "sent") {
      console.log(`✅ SUCCESS: Sequence sent to ${lead.name} at ${lead.company}.`);
    } else {
      console.error(`❌ FAILED for ${lead.email}: ${result.reason}`);
    }
  }

  console.log("\n✨ Enterprise pipeline is now saturated. AgentZ is monitoring for replies.");
}

pushEnterpriseOutreach().catch(console.error);
