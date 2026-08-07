import "dotenv/config";
import { invokeLLM, parseLLMContent } from "../_core/llm.js";
import { sendEmail } from "../email-service.js";
import { bayesianPreamble, betaMean, betaCI, SEGMENT_PRIORS } from "../_core/bayesian.js";

// server/scripts/ is excluded from `pnpm check` (see tsconfig.json), so this
// was never caught: maskEmail is used on the success path below but was never
// defined or imported here. The script sent the email, then crashed with a
// ReferenceError before it could log the result.
const maskEmail = (e: string) => { const [l, d] = e.split('@'); return d ? `${l?.[0] ?? ''}***@${d}` : '***'; };

/** Sends only when CONFIRM_SEND=1; otherwise prints what would be sent. */
const CONFIRM_SEND = process.env.CONFIRM_SEND === "1";

async function pushMedtronicSequence() {
  console.log("🚀 Executing Medtronic High-Ticket Outreach...");

  const lead = {
    name: "Michael Chen",
    role: "Director of Quality Assurance",
    company: "Medtronic",
    // WARNING: guessed from a first.last@company pattern — not a confirmed
    // address and not opted in. Verify before setting CONFIRM_SEND=1.
    email: "michael.chen@medtronic.com",
    segment: "MEDTECH"
  };

  // 1. Generate Bayesian Reasoning
  const prior = SEGMENT_PRIORS.MEDTECH;
  const reasoning = bayesianPreamble({
    segment: lead.segment,
    tone: "direct",
    conversionEstimate: betaMean(prior),
    ci: betaCI(prior),
    evidence: [`lead_title: ${lead.role}`, `company: ${lead.company}`]
  });

  // 2. Generate Content via LLM
  const prompt = `${reasoning}You are writing a cold outreach email on behalf of AuthiChain (authichain.com).

Recipient: ${lead.name}
Role: ${lead.role}
Company: ${lead.company}
Segment: MEDTECH (Enterprise $150K+)
Tone: DIRECT (Specs + ROI focus)

Key Value Prop for Medtronic:
- SKU identification using QRON, signed with Ed25519 and verifiable offline.
- ISO 13485 audit records anchored on-chain so an auditor can check them independently.
- The specification, reference verifier and conformance suite are Apache-2.0, so the cryptography can be evaluated before any commercial conversation.

Do not invent statistics, savings figures or timings — state only what is listed above.
Write a 3-sentence high-impact email. End with a CTA to read the open specification at authichain.com/protocol.

Return JSON: { "subject": "...", "body": "..." }`;

  let content;
  try {
    const result = await invokeLLM({
      messages: [{ role: "user", content: prompt }],
      responseFormat: { type: "json_object" },
    });
    content = parseLLMContent<any>(result.choices[0].message.content);
  } catch (err: any) {
    console.warn("⚠️ LLM Generation failed. Using high-fidelity hardcoded fallback sequence.");
    content = {
      subject: `Medtronic / AuthiChain: Eliminating ISO 13485 Audit Overhead`,
      body: `Michael,\n\nI noticed Medtronic is scaling its ISO 13485 audit cycles. AuthiChain anchors each audit record on-chain and signs it with Ed25519, so an auditor can verify the trail independently rather than trusting a vendor's dashboard.\n\nThe specification and reference verifier are Apache-2.0 — you can evaluate the cryptography before talking to us: authichain.com/protocol\n\nBest,\nZ\nAuthiChain Protocol`
    };
  }
  console.log("\n--- GENERATED OUTREACH ---");
  console.log(`Subject: ${content.subject}`);
  console.log(`Body:\n${content.body}\n`);

  // 3. Push to Outbox (Send)
  if (!CONFIRM_SEND) {
    console.log(`🔍 DRY RUN — nothing sent. Set CONFIRM_SEND=1 to send to ${maskEmail(lead.email)}.`);
    return;
  }

  console.log("📤 Pushing to Gmail Outbox...");
  const sendResult = await sendEmail({
    to: lead.email,
    subject: content.subject,
    body: content.body
  });

  if (sendResult.status === "sent") {
    console.log(`\n✅ SUCCESS: First MedTech sequence sent to ${maskEmail(lead.email)}.`);
    console.log("AgentZ is now monitoring for replies.");
  } else {
    console.error(`\n❌ FAILED: ${sendResult.reason}`);
  }
}

pushMedtronicSequence().catch(console.error);
