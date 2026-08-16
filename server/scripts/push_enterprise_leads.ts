import "dotenv/config";
import { sendEmail } from "../email-service.js";

const maskEmail = (e: string) => { const [l, d] = e.split('@'); return d ? `${l?.[0] ?? ''}***@${d}` : '***'; };

/**
 * Sends only when CONFIRM_SEND=1. This script previously sent on invocation
 * with no confirmation, which is how the same defect the AgentZ CLI had
 * (`--mode auto` by default) reached outbound email.
 */
const CONFIRM_SEND = process.env.CONFIRM_SEND === "1";

async function pushEnterpriseOutreach() {
  // WARNING: these addresses are guessed from a first.last@company pattern, not
  // opted in and not verified. Guessed addresses at named companies bounce hard,
  // and bounces are what destroy a sending domain's reputation — the one asset
  // that cannot be repaired quickly. Replace with confirmed opt-in contacts
  // before setting CONFIRM_SEND=1.
  const leads = [
    {
      name: "Robert G.",
      role: "VP of Quality & Regulatory",
      company: "Stryker",
      email: "robert.g@stryker.com",
      industry: "MEDTECH",
      narrative: "I noticed Stryker is modernizing its ISO 13485 audit trail. AuthiChain anchors each audit record on-chain and signs it with Ed25519, so an auditor can verify the trail independently rather than taking your word or ours."
    },
    {
      name: "Jennifer L.",
      role: "Director of Supply Chain",
      company: "Abbott Laboratories",
      email: "jennifer.l@abbott.com",
      industry: "MEDTECH",
      narrative: "Abbott's hardware compliance for DSCSA 2027 requires a unified digital identity standard. Our Sovereign Passport module issues W3C Verifiable Credentials for diagnostic hardware that verify offline, against the issuer's published key."
    }
  ];

  console.log(`🚀 Executing Big-Ticket Outreach for ${leads.length} Enterprise Leads...`);
  if (!CONFIRM_SEND) {
    console.log("🔍 DRY RUN — set CONFIRM_SEND=1 to actually send. Printing what would go out:\n");
  }

  for (const lead of leads) {
    const subject = `${lead.company} / AuthiChain: Automated ${lead.industry === "MEDTECH" ? "ISO 13485" : "DSCSA"} Compliance`;
    // Links to authichain.com/protocol, which exists. The previous CTA pointed
    // at authichain.com/roi-calculator: that route lives only in the legacy
    // wouter SPA, and the worker serving authichain.com has no handler for it,
    // so recipients clicking "view the breakdown" landed on the homepage.
    const body = `Hi ${lead.name},\n\n${lead.narrative}\n\nThe specification and reference verifier are open source under Apache-2.0, so you can evaluate the cryptography before talking to us: authichain.com/protocol\n\nBest regards,\nZ\nAuthiChain Protocol`;

    console.log(`\n📤 Pushing to: ${maskEmail(lead.email)}`);
    if (!CONFIRM_SEND) {
      console.log(`   Subject: ${subject}\n   Body:\n${body.split("\n").map((l) => `   | ${l}`).join("\n")}`);
      continue;
    }
    const result = await sendEmail({ to: lead.email, subject, body });

    if (result.status === "sent") {
      console.log(`✅ SUCCESS: Sequence sent to ${lead.name} at ${lead.company}.`);
    } else {
      console.error(`❌ FAILED for ${lead.email}: ${result.reason}`);
    }
  }

  console.log(
    CONFIRM_SEND
      ? "\n✨ Enterprise pipeline is now saturated. AgentZ is monitoring for replies."
      : "\n✨ Dry run complete. Nothing was sent.",
  );
}

pushEnterpriseOutreach().catch(console.error);
