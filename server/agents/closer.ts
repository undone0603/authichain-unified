/**
 * Autonomous closer agent — handles everything after the first email send:
 *   CHECK_REPLIES   → poll Gmail thread → classify intent → route
 *   SEND_DEMO_PACKET → personalized value demo email (no call needed)
 *   GENERATE_PROPOSAL → LLM proposal + Stripe checkout link
 *   SEND_CONTRACT    → LLM contract terms + payment link (formal acceptance)
 *   AUTO_REPLY       → objection / pricing question handled autonomously
 */
import { eq } from "drizzle-orm";
import type { MissionTask as Task } from "../../drizzle/schema.js";
import { leads } from "../../drizzle/schema.js";
import { invokeLLM, parseLLMContent } from "../_core/llm.js";
import {
  createProposal,
  enqueueTask,
  getDb,
  logActivity,
} from "../db.js";
import { checkThreadReplies } from "../email-service.js";
import {
  PLANS,
  PUBLIC_PLAN_IDS,
  gatedCheckoutUrl,
} from "../../src/lib/plans";

// ─── Shared helpers ───────────────────────────────────────────────────────────

/** A task payload is not an inbox the founder named this turn. */
const TASK_SEND_REFUSED = {
  status: "refused" as const,
  reason: "no inbox named this turn",
};

function publicOfferLines(): string {
  return PLANS.filter(
    plan =>
      (PUBLIC_PLAN_IDS as readonly string[]).includes(plan.id) &&
      plan.price > 0 &&
      Boolean(plan.stripe_price_id)
  )
    .map(
      plan =>
        `${plan.name}: $${plan.price}${plan.price_suffix ?? ""} ${gatedCheckoutUrl(plan.id)}`
    )
    .join("\n");
}

async function updateLeadStatus(email: string, status: string) {
  const db = await getDb();
  if (!db) return;
  await db
    .update(leads)
    .set({ status, updatedAt: new Date() })
    .where(eq(leads.email, email.toLowerCase()));
}

// ─── CHECK_REPLIES ─────────────────────────────────────────────────────────────

interface CheckRepliesPayload {
  threadId?: string;
  leadEmail: string;
  leadName?: string;
  leadOrg?: string;
  leadTitle?: string;
  segment: string;
  sequence?: number;
  maxSequence?: number;
}

type ReplyIntent =
  | "interested"
  | "wants_proposal"
  | "objection"
  | "pricing"
  | "not_interested"
  | "already_customer"
  | "unknown";

type ReplyIntentResult = { intent?: ReplyIntent };
type SubjectBodyResult = { subject?: string; body?: string };

async function classifyReplyIntent(
  replyText: string,
  segment: string
): Promise<ReplyIntent> {
  const prompt = `Classify this email reply from a B2B sales prospect for AuthiChain (blockchain product authentication).
Segment: ${segment}
Reply: """${replyText.slice(0, 800)}"""

Return JSON: { "intent": "<one of: interested | wants_proposal | objection | pricing | not_interested | already_customer | unknown>", "reasoning": "..." }`;

  try {
    const result = await invokeLLM({
      messages: [{ role: "user", content: prompt }],
      responseFormat: { type: "json_object" },
    });
    const parsed = parseLLMContent<ReplyIntentResult>(
      result.choices[0].message.content
    );
    return (parsed.intent as ReplyIntent) ?? "unknown";
  } catch {
    return "unknown";
  }
}

export async function runCheckReplies(task: Task): Promise<void> {
  const payload = task.payload as CheckRepliesPayload;
  const { threadId, leadEmail, leadName, leadOrg, leadTitle, segment } =
    payload;
  const sequence = payload.sequence ?? 1;
  const maxSequence = payload.maxSequence ?? 3;

  const replyCheck = await checkThreadReplies(threadId ?? "");

  if (replyCheck.hasReply && replyCheck.replyText) {
    const intent = await classifyReplyIntent(replyCheck.replyText, segment);

    await updateLeadStatus(leadEmail, "REPLIED");

    await logActivity({
      userId: null,
      action: "reply_received",
      entityType: "task",
      entityId: 0,
      details: {
        taskId: task.id,
        leadEmail,
        segment,
        intent,
        replyFrom: replyCheck.replyFrom,
      },
    });

    const nextBase = {
      leadEmail,
      leadName,
      leadOrg,
      leadTitle,
      segment,
      threadId,
      replyText: replyCheck.replyText,
    };
    const delay48h = new Date(Date.now() + 48 * 60 * 60 * 1000);

    switch (intent) {
      case "interested":
        await enqueueTask(task.missionId, "SEND_DEMO_PACKET", nextBase);
        break;

      case "wants_proposal":
        await enqueueTask(task.missionId, "GENERATE_PROPOSAL", nextBase);
        break;

      case "objection":
        await enqueueTask(task.missionId, "AUTO_REPLY", {
          ...nextBase,
          intent: "objection",
        });
        break;

      case "pricing":
        await enqueueTask(task.missionId, "AUTO_REPLY", {
          ...nextBase,
          intent: "pricing",
        });
        break;

      case "not_interested":
        await updateLeadStatus(leadEmail, "CLOSED_LOST");
        await logActivity({
          userId: null,
          action: "outcome_signal",
          entityType: "lead",
          entityId: 0,
          details: { signal: "no_response", segment },
        });
        break;

      case "already_customer":
        await updateLeadStatus(leadEmail, "CLOSED_WON");
        break;

      default:
        // Unknown intent — treat as soft interest, send demo in 48h
        await enqueueTask(
          task.missionId,
          "SEND_DEMO_PACKET",
          nextBase,
          delay48h
        );
    }

    // Record reply outcome signal for Bayesian learning
    await logActivity({
      userId: null,
      action: "outcome_signal",
      entityType: "lead",
      entityId: 0,
      details: { signal: "email_replied", segment },
    });
    return;
  }

  // No reply — advance follow-up sequence or close lost
  if (sequence < maxSequence) {
    const delay = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days
    await enqueueTask(
      task.missionId,
      "FOLLOWUP_SEQUENCE",
      {
        segment,
        leadEmail,
        leadName,
        leadOrg,
        leadTitle,
        sequence: sequence + 1,
        maxFollowups: maxSequence,
      },
      delay
    );
  } else {
    await updateLeadStatus(leadEmail, "CLOSED_LOST");
    await logActivity({
      userId: null,
      action: "outcome_signal",
      entityType: "lead",
      entityId: 0,
      details: { signal: "no_response", segment },
    });
  }
}

// ─── SEND_DEMO_PACKET ──────────────────────────────────────────────────────────

interface DemoPacketPayload {
  leadEmail: string;
  leadName?: string;
  leadOrg?: string;
  leadTitle?: string;
  segment: string;
  replyText?: string;
  threadId?: string;
}

const SEGMENT_ROI_CONTEXT: Record<string, string> = {
  GOV: "Government agencies lose billions annually to counterfeit goods in procurement. AuthiChain provides instant blockchain verification at point-of-receipt.",
  RETAIL:
    "Retail brands lose 20–40% of premium revenue to counterfeit products. AuthiChain gives every SKU a tamper-evident QR code customers can scan to verify authenticity.",
  PARTNER:
    "Embed AuthiChain's authentication API in 30 minutes. White-label the dashboard. Add a new revenue stream without building the infra.",
  PRESS:
    "AuthiChain is the first platform to combine AI confidence scoring with NFT provenance tracking for physical product authentication.",
  DEFAULT:
    "AuthiChain enables brands to verify product authenticity via blockchain-backed QR codes and AI confidence scoring.",
};

export async function runSendDemoPacket(task: Task): Promise<void> {
  const payload = task.payload as DemoPacketPayload;
  const {
    leadEmail,
    leadName,
    leadOrg,
    leadTitle,
    segment,
    replyText,
  } = payload;

  const roiContext =
    SEGMENT_ROI_CONTEXT[segment] ?? SEGMENT_ROI_CONTEXT.DEFAULT;

  const prompt = `You are writing a personalized demo/value email for AuthiChain — NO sales call required.
Recipient: ${leadName ?? "there"} at ${leadOrg ?? "your organization"}${leadTitle ? ` (${leadTitle})` : ""}
Segment: ${segment}
${replyText ? `Their previous reply: "${replyText.slice(0, 300)}"` : ""}

ROI context for this segment:
${roiContext}

Write a 4–6 sentence email that:
1. Opens with their specific pain (tailored to their industry/role)
2. Shows how AuthiChain solves it with a concrete metric or example
3. Includes a short product walk-through summary (3 bullet points max)
4. Closes with two options: (a) self-serve onboarding link, (b) reply to this email with questions
5. No calendly link, no "schedule a call" — the goal is autonomous close via email

Return JSON: { "subject": "...", "body": "..." }`;

  const result = await invokeLLM({
    messages: [{ role: "user", content: prompt }],
    responseFormat: { type: "json_object" },
  });

  const parsed_demo = parseLLMContent<SubjectBodyResult>(
    result.choices[0].message.content
  );
  const subject =
    parsed_demo.subject ?? `AuthiChain for ${leadOrg ?? segment}: How It Works`;
  const body = parsed_demo.body ?? "";

  if (!body) throw new Error("Demo packet LLM returned empty body");

  await logActivity({
    userId: null,
    action: "demo_packet_drafted",
    entityType: "task",
    entityId: 0,
    details: {
      taskId: task.id,
      leadEmail,
      segment,
      subject,
      sendStatus: TASK_SEND_REFUSED.status,
      reason: TASK_SEND_REFUSED.reason,
    },
  });
}

// ─── GENERATE_PROPOSAL ────────────────────────────────────────────────────────

interface ProposalPayload {
  leadEmail: string;
  leadName?: string;
  leadOrg?: string;
  leadTitle?: string;
  segment: string;
  replyText?: string;
  threadId?: string;
}

export async function runGenerateProposal(task: Task): Promise<void> {
  const payload = task.payload as ProposalPayload;
  const { leadEmail, leadName, leadOrg, leadTitle, segment, replyText } =
    payload;
  const offers = publicOfferLines();

  // ── LLM proposal generation ───────────────────────────────────────────────
  const prompt = `Write a professional B2B proposal for AuthiChain (authichain.com), a blockchain product authentication platform.

Client: ${leadName ?? "Decision-Maker"} at ${leadOrg ?? "your organization"}${leadTitle ? `, ${leadTitle}` : ""}
Segment: ${segment}
${replyText ? `Context from their last email: "${replyText.slice(0, 400)}"` : ""}

Public offers, and the only amounts you may quote:
${offers}

Write a 400–600 word proposal covering:
1. Executive Summary (2–3 sentences, specific to their industry)
2. Problem Statement (their specific pain points)
3. Our Solution (how AuthiChain addresses it — QR authentication, AI confidence scoring, NFT provenance)
4. ROI Analysis (3 bullet points with realistic numbers for their segment)
5. Pilot Scope (what's included in the 6-month pilot: onboarding, integrations, support)
6. Investment: one of the public offers above. Do not invent a pilot price.
7. Next Steps (one sentence pointing at that offer's checkout URL)

Tone: authoritative, specific, zero fluff.
Return JSON: { "subject": "Proposal: AuthiChain Pilot for [Org]", "body": "..." }`;

  const result = await invokeLLM({
    messages: [{ role: "user", content: prompt }],
    responseFormat: { type: "json_object" },
  });

  const parsed_proposal = parseLLMContent<SubjectBodyResult>(
    result.choices[0].message.content
  );
  const subject =
    parsed_proposal.subject ??
    `AuthiChain Pilot Proposal — ${leadOrg ?? segment}`;
  const proposalContent = parsed_proposal.body ?? "";

  if (!proposalContent) throw new Error("Proposal LLM returned empty content");

  const proposalId = await createProposal({
    leadEmail,
    missionId: task.missionId,
    taskId: task.id,
    segment,
    content: proposalContent,
  });

  await logActivity({
    userId: null,
    action: "proposal_drafted",
    entityType: "task",
    entityId: 0,
    details: {
      taskId: task.id,
      leadEmail,
      segment,
      proposalId,
      hasPaymentLink: false,
      sendStatus: TASK_SEND_REFUSED.status,
      reason: TASK_SEND_REFUSED.reason,
    },
  });
}

// ─── SEND_CONTRACT ────────────────────────────────────────────────────────────

interface ContractPayload {
  leadEmail: string;
  leadName?: string;
  leadOrg?: string;
  segment: string;
  proposalId?: string;
  paymentLink?: string;
  threadId?: string;
}

export async function runSendContract(task: Task): Promise<void> {
  const payload = task.payload as ContractPayload;
  const { leadEmail, leadName, leadOrg, segment } = payload;
  const prompt = `Draft a simple, professional Service Agreement between AuthiChain Inc. and ${leadOrg ?? "Client"}.

Terms to include:
1. Parties: AuthiChain Inc. (Provider) and ${leadOrg ?? "Client"} (Client), represented by ${leadName ?? "authorized signatory"}
2. Services: 6-month AuthiChain pilot — product authentication platform including QR code generation, blockchain provenance tracking, AI confidence scoring, dashboard access, and onboarding support
3. Payment: one public offer from this list, and no other amount:
${publicOfferLines()}
4. IP: AuthiChain retains all platform IP. Client retains rights to their product data.
5. Data: AuthiChain stores no personally identifiable consumer data beyond scan metadata.
6. Termination: Either party may terminate with 30 days written notice after the pilot period.
7. Acceptance: Payment of a public offer constitutes acceptance of these terms.
8. Governing law: State of Delaware, United States.

Keep it to 250–350 words. Professional but readable — this is a pilot agreement, not a 50-page enterprise contract.
Return JSON: { "subject": "AuthiChain Service Agreement — [Org]", "body": "..." }`;

  const result = await invokeLLM({
    messages: [{ role: "user", content: prompt }],
    responseFormat: { type: "json_object" },
  });

  const parsed_contract = parseLLMContent<SubjectBodyResult>(
    result.choices[0].message.content
  );
  const subject =
    parsed_contract.subject ??
    `AuthiChain Service Agreement — ${leadOrg ?? segment}`;
  const contractBody = parsed_contract.body ?? "";

  await logActivity({
    userId: null,
    action: "contract_drafted",
    entityType: "task",
    entityId: 0,
    details: {
      taskId: task.id,
      leadEmail,
      segment,
      sendStatus: TASK_SEND_REFUSED.status,
      reason: TASK_SEND_REFUSED.reason,
      hasPaymentLink: false,
      subject,
      drafted: contractBody.length > 0,
    },
  });
}

// ─── AUTO_REPLY ───────────────────────────────────────────────────────────────

interface AutoReplyPayload {
  leadEmail: string;
  leadName?: string;
  leadOrg?: string;
  segment: string;
  replyText: string;
  intent: "objection" | "pricing" | "general";
  threadId?: string;
}

function pricingContext(): string {
  return `Public offers only:\n${publicOfferLines()}\nDo not quote any other price. Do not offer a custom pilot checkout.`;
}

export async function runAutoReply(task: Task): Promise<void> {
  const payload = task.payload as AutoReplyPayload;
  const { leadEmail, leadName, leadOrg, segment, replyText, intent } = payload;

  const intentGuidance =
    intent === "pricing"
      ? `${pricingContext()}\nProvide clear pricing from that list and point at one checkout URL.`
      : `This is an objection. Address it directly, confidently, and with evidence. Do NOT be defensive.`;

  const prompt = `You are responding to a prospect on behalf of AuthiChain. No hedging — be direct and close.

Prospect: ${leadName ?? "there"} at ${leadOrg ?? "your org"}
Their message: """${replyText.slice(0, 600)}"""
Intent category: ${intent}
${intentGuidance}

Write a 3–5 sentence reply that:
1. Acknowledges their specific point (one sentence)
2. Addresses it with facts/ROI (2–3 sentences)
3. Closes with a clear next step: "Reply to confirm and I'll send the agreement" or direct payment link offer

Return JSON: { "subject": "Re: [keep thread subject]", "body": "..." }`;

  const result = await invokeLLM({
    messages: [{ role: "user", content: prompt }],
    responseFormat: { type: "json_object" },
  });

  const parsed_reply = parseLLMContent<SubjectBodyResult>(
    result.choices[0].message.content
  );
  const subject = parsed_reply.subject ?? `Re: AuthiChain`;
  const body = parsed_reply.body ?? "";

  await logActivity({
    userId: null,
    action: "auto_reply_drafted",
    entityType: "task",
    entityId: 0,
    details: {
      taskId: task.id,
      leadEmail,
      segment,
      intent,
      subject,
      drafted: body.length > 0,
      sendStatus: TASK_SEND_REFUSED.status,
      reason: TASK_SEND_REFUSED.reason,
    },
  });
}
