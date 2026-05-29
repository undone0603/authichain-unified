/**
 * Autonomous closer agent — handles everything after the first email send:
 *   CHECK_REPLIES   → poll Gmail thread → classify intent → route
 *   SEND_DEMO_PACKET → personalized value demo email (no call needed)
 *   GENERATE_PROPOSAL → LLM proposal + Stripe checkout link
 *   SEND_CONTRACT    → LLM contract terms + payment link (formal acceptance)
 *   AUTO_REPLY       → objection / pricing question handled autonomously
 */
import { invokeLLM, parseLLMContent } from '../_core/llm';
import { sendEmail, checkThreadReplies } from '../email-service';
import { logActivity, enqueueTask, getDb, createProposal } from '../db';
import { leads } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import { getStripe } from '../stripe-service';
import type { MissionTask as Task } from '../../drizzle/schema';

// ─── Shared helpers ───────────────────────────────────────────────────────────

const PILOT_PRICE_USD: Record<string, number> = {
  GOV:     25_000,
  RETAIL:   5_000,
  PARTNER: 10_000,
  PRESS:        0, // press is comp
  DEFAULT: 10_000,
};

async function updateLeadStatus(email: string, status: string) {
  const db = await getDb();
  if (!db) return;
  await db.update(leads)
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
  | 'interested'
  | 'wants_proposal'
  | 'objection'
  | 'pricing'
  | 'not_interested'
  | 'already_customer'
  | 'unknown';

async function classifyReplyIntent(replyText: string, segment: string): Promise<ReplyIntent> {
  const prompt = `Classify this email reply from a B2B sales prospect for AuthiChain (blockchain product authentication).
Segment: ${segment}
Reply: """${replyText.slice(0, 800)}"""

Return JSON: { "intent": "<one of: interested | wants_proposal | objection | pricing | not_interested | already_customer | unknown>", "reasoning": "..." }`;

  try {
    const result = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      responseFormat: { type: 'json_object' },
    });
    const parsed = parseLLMContent<any>(result.choices[0].message.content);
    return (parsed.intent as ReplyIntent) ?? 'unknown';
  } catch {
    return 'unknown';
  }
}

export async function runCheckReplies(task: Task): Promise<void> {
  const payload = task.payload as CheckRepliesPayload;
  const { threadId, leadEmail, leadName, leadOrg, leadTitle, segment } = payload;
  const sequence = payload.sequence ?? 1;
  const maxSequence = payload.maxSequence ?? 3;

  const replyCheck = await checkThreadReplies(threadId ?? '');

  if (replyCheck.hasReply && replyCheck.replyText) {
    const intent = await classifyReplyIntent(replyCheck.replyText, segment);

    await updateLeadStatus(leadEmail, 'REPLIED');

    await logActivity({
      userId: null, action: 'reply_received', entityType: 'task', entityId: 0,
      details: { taskId: task.id, leadEmail, segment, intent, replyFrom: replyCheck.replyFrom },
    });

    const nextBase = { leadEmail, leadName, leadOrg, leadTitle, segment, threadId, replyText: replyCheck.replyText };
    const delay48h = new Date(Date.now() + 48 * 60 * 60 * 1000);

    switch (intent) {
      case 'interested':
        await enqueueTask(task.missionId, 'SEND_DEMO_PACKET', nextBase);
        break;

      case 'wants_proposal':
        await enqueueTask(task.missionId, 'GENERATE_PROPOSAL', nextBase);
        break;

      case 'objection':
        await enqueueTask(task.missionId, 'AUTO_REPLY', { ...nextBase, intent: 'objection' });
        break;

      case 'pricing':
        await enqueueTask(task.missionId, 'AUTO_REPLY', { ...nextBase, intent: 'pricing' });
        break;

      case 'not_interested':
        await updateLeadStatus(leadEmail, 'CLOSED_LOST');
        await logActivity({
          userId: null, action: 'outcome_signal', entityType: 'lead', entityId: 0,
          details: { signal: 'no_response', segment },
        });
        break;

      case 'already_customer':
        await updateLeadStatus(leadEmail, 'CLOSED_WON');
        break;

      default:
        // Unknown intent — treat as soft interest, send demo in 48h
        await enqueueTask(task.missionId, 'SEND_DEMO_PACKET', nextBase, delay48h);
    }

    // Record reply outcome signal for Bayesian learning
    await logActivity({
      userId: null, action: 'outcome_signal', entityType: 'lead', entityId: 0,
      details: { signal: 'email_replied', segment },
    });
    return;
  }

  // No reply — advance follow-up sequence or close lost
  if (sequence < maxSequence) {
    const delay = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000); // 3 days
    await enqueueTask(task.missionId, 'FOLLOWUP_SEQUENCE', {
      segment, leadEmail, leadName, leadOrg, leadTitle, sequence: sequence + 1, maxFollowups: maxSequence,
    }, delay);
  } else {
    await updateLeadStatus(leadEmail, 'CLOSED_LOST');
    await logActivity({
      userId: null, action: 'outcome_signal', entityType: 'lead', entityId: 0,
      details: { signal: 'no_response', segment },
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
  GOV:     'Government agencies lose billions annually to counterfeit goods in procurement. AuthiChain provides instant blockchain verification at point-of-receipt.',
  RETAIL:  'Retail brands lose 20–40% of premium revenue to counterfeit products. AuthiChain gives every SKU a tamper-evident QR code customers can scan to verify authenticity.',
  PARTNER: 'Embed AuthiChain\'s authentication API in 30 minutes. White-label the dashboard. Add a new revenue stream without building the infra.',
  PRESS:   'AuthiChain is the first platform to combine AI confidence scoring with NFT provenance tracking for physical product authentication.',
  DEFAULT: 'AuthiChain enables brands to verify product authenticity via blockchain-backed QR codes and AI confidence scoring.',
};

export async function runSendDemoPacket(task: Task): Promise<void> {
  const payload = task.payload as DemoPacketPayload;
  const { leadEmail, leadName, leadOrg, leadTitle, segment, replyText, threadId } = payload;

  const roiContext = SEGMENT_ROI_CONTEXT[segment] ?? SEGMENT_ROI_CONTEXT.DEFAULT;

  const prompt = `You are writing a personalized demo/value email for AuthiChain — NO sales call required.
Recipient: ${leadName ?? 'there'} at ${leadOrg ?? 'your organization'}${leadTitle ? ` (${leadTitle})` : ''}
Segment: ${segment}
${replyText ? `Their previous reply: "${replyText.slice(0, 300)}"` : ''}

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
    messages: [{ role: 'user', content: prompt }],
    responseFormat: { type: 'json_object' },
  });

  const parsed_demo = parseLLMContent<any>(result.choices[0].message.content);
  const subject = parsed_demo.subject ?? `AuthiChain for ${leadOrg ?? segment}: How It Works`;
  const body = parsed_demo.body ?? '';

  if (!body) throw new Error('Demo packet LLM returned empty body');

  const sendResult = await sendEmail({ to: leadEmail, subject, body });

  if (sendResult.status === 'sent') {
    await updateLeadStatus(leadEmail, 'DEMO_SENT');
    // Enqueue reply check in 72h
    const check72h = new Date(Date.now() + 72 * 60 * 60 * 1000);
    await enqueueTask(task.missionId, 'CHECK_REPLIES', {
      threadId: sendResult.threadId ?? threadId,
      leadEmail, leadName, leadOrg, leadTitle, segment, sequence: 0, maxSequence: 1,
    }, check72h);
  }

  await logActivity({
    userId: null, action: 'demo_packet_sent', entityType: 'task', entityId: 0,
    details: { taskId: task.id, leadEmail, segment, sendStatus: sendResult.status },
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
  const { leadEmail, leadName, leadOrg, leadTitle, segment, replyText, threadId } = payload;
  const priceUsd = PILOT_PRICE_USD[segment] ?? PILOT_PRICE_USD.DEFAULT;

  // ── LLM proposal generation ───────────────────────────────────────────────
  const prompt = `Write a professional B2B proposal for AuthiChain (authichain.com), a blockchain product authentication platform.

Client: ${leadName ?? 'Decision-Maker'} at ${leadOrg ?? 'your organization'}${leadTitle ? `, ${leadTitle}` : ''}
Segment: ${segment}
Pilot price: $${priceUsd.toLocaleString()} USD (6-month pilot program)
${replyText ? `Context from their last email: "${replyText.slice(0, 400)}"` : ''}

Write a 400–600 word proposal covering:
1. Executive Summary (2–3 sentences, specific to their industry)
2. Problem Statement (their specific pain points)
3. Our Solution (how AuthiChain addresses it — QR authentication, AI confidence scoring, NFT provenance)
4. ROI Analysis (3 bullet points with realistic numbers for their segment)
5. Pilot Scope (what's included in the 6-month pilot: onboarding, integrations, support)
6. Investment: $${priceUsd.toLocaleString()} for 6-month pilot (then [quote renewal])
7. Next Steps (one sentence directing them to the payment link to get started immediately)

Tone: authoritative, specific, zero fluff.
Return JSON: { "subject": "Proposal: AuthiChain Pilot for [Org]", "body": "..." }`;

  const result = await invokeLLM({
    messages: [{ role: 'user', content: prompt }],
    responseFormat: { type: 'json_object' },
  });

  const parsed_proposal = parseLLMContent<any>(result.choices[0].message.content);
  const subject = parsed_proposal.subject ?? `AuthiChain Pilot Proposal — ${leadOrg ?? segment}`;
  const proposalContent = parsed_proposal.body ?? '';

  if (!proposalContent) throw new Error('Proposal LLM returned empty content');

  // ── Stripe checkout session (payment link) ─────────────────────────────────
  let paymentLink: string | undefined;
  let checkoutSessionId: string | undefined;

  if (priceUsd > 0) {
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            unit_amount: priceUsd * 100,
            product_data: {
              name: `AuthiChain ${segment} Pilot Program`,
              description: `6-month pilot program for ${leadOrg ?? 'your organization'}`,
            },
          },
          quantity: 1,
        }],
        metadata: { leadEmail, segment, missionId: task.missionId, taskId: task.id },
        success_url: 'https://authichain.com/welcome?session_id={CHECKOUT_SESSION_ID}',
        cancel_url:  'https://authichain.com/pricing',
        customer_email: leadEmail,
        expires_at: Math.floor(Date.now() / 1000) + 86400 * 30, // 30 days
      });
      paymentLink = session.url ?? undefined;
      checkoutSessionId = session.id;
    } catch {
      // Non-fatal — send proposal without link, follow up manually
    }
  }

  // ── Store proposal ────────────────────────────────────────────────────────
  const proposalId = await createProposal({
    leadEmail,
    missionId: task.missionId,
    taskId: task.id,
    segment,
    content: proposalContent,
    paymentLink,
    checkoutSessionId,
    pilotPriceUsd: priceUsd,
  });

  // ── Send email ────────────────────────────────────────────────────────────
  const paymentSection = paymentLink
    ? `\n\n---\n🔒 Ready to proceed? Secure your pilot today:\n${paymentLink}\n(This link is valid for 30 days)`
    : '';

  const sendResult = await sendEmail({
    to: leadEmail,
    subject,
    body: `${proposalContent}${paymentSection}`,
  });

  await updateLeadStatus(leadEmail, 'PILOT_PROPOSED');

  await logActivity({
    userId: null, action: 'proposal_sent', entityType: 'task', entityId: 0,
    details: {
      taskId: task.id, leadEmail, segment, proposalId,
      hasPaymentLink: !!paymentLink, sendStatus: sendResult.status, priceUsd,
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
  const priceUsd = PILOT_PRICE_USD[segment] ?? PILOT_PRICE_USD.DEFAULT;

  const prompt = `Draft a simple, professional Service Agreement between AuthiChain Inc. and ${leadOrg ?? 'Client'}.

Terms to include:
1. Parties: AuthiChain Inc. (Provider) and ${leadOrg ?? 'Client'} (Client), represented by ${leadName ?? 'authorized signatory'}
2. Services: 6-month AuthiChain pilot — product authentication platform including QR code generation, blockchain provenance tracking, AI confidence scoring, dashboard access, and onboarding support
3. Payment: $${priceUsd.toLocaleString()} USD, due upon execution
4. IP: AuthiChain retains all platform IP. Client retains rights to their product data.
5. Data: AuthiChain stores no personally identifiable consumer data beyond scan metadata. Compliant with SOC 2 principles.
6. Termination: Either party may terminate with 30 days written notice after the pilot period.
7. Acceptance: Execution of payment constitutes acceptance of these terms.
8. Governing law: State of Delaware, United States.

Keep it to 250–350 words. Professional but readable — this is a pilot agreement, not a 50-page enterprise contract.
Return JSON: { "subject": "AuthiChain Service Agreement — [Org]", "body": "..." }`;

  const result = await invokeLLM({
    messages: [{ role: 'user', content: prompt }],
    responseFormat: { type: 'json_object' },
  });

  const parsed_contract = parseLLMContent<any>(result.choices[0].message.content);
  const subject = parsed_contract.subject ?? `AuthiChain Service Agreement — ${leadOrg ?? segment}`;
  const contractBody = parsed_contract.body ?? '';

  // Re-use existing payment link from payload or create a new checkout session
  let paymentLink = payload.paymentLink;
  if (!paymentLink && priceUsd > 0) {
    try {
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{ price_data: { currency: 'usd', unit_amount: priceUsd * 100, product_data: { name: `AuthiChain ${segment} Pilot — Contract Execution` } }, quantity: 1 }],
        metadata: { leadEmail, segment, missionId: task.missionId, taskId: task.id, type: 'contract' },
        success_url: 'https://authichain.com/welcome?session_id={CHECKOUT_SESSION_ID}',
        cancel_url:  'https://authichain.com/pricing',
        customer_email: leadEmail,
        expires_at: Math.floor(Date.now() / 1000) + 86400 * 14, // 14 days to sign
      });
      paymentLink = session.url ?? undefined;
    } catch { /* non-fatal */ }
  }

  const paymentSection = paymentLink
    ? `\n\n---\nTo execute this agreement, complete payment here:\n${paymentLink}\n(Link expires in 14 days. Payment constitutes acceptance of the above terms.)`
    : '';

  const sendResult = await sendEmail({
    to: leadEmail,
    subject,
    body: `${contractBody}${paymentSection}`,
  });

  await logActivity({
    userId: null, action: 'contract_sent', entityType: 'task', entityId: 0,
    details: { taskId: task.id, leadEmail, segment, sendStatus: sendResult.status, hasPaymentLink: !!paymentLink },
  });
}

// ─── AUTO_REPLY ───────────────────────────────────────────────────────────────

interface AutoReplyPayload {
  leadEmail: string;
  leadName?: string;
  leadOrg?: string;
  segment: string;
  replyText: string;
  intent: 'objection' | 'pricing' | 'general';
  threadId?: string;
}

const PRICING_TABLE: Record<string, string> = {
  GOV:     '$25,000 for a 6-month pilot. Includes full onboarding, integrations, dedicated support, and a blockchain dashboard. Government pricing is fixed — no negotiation on scope, but we can phase the payment.',
  RETAIL:  '$5,000 for a 6-month pilot. Includes unlimited SKU onboarding, QR code generation, authentication analytics, and brand protection reporting. ROI typically pays back within 60 days.',
  PARTNER: '$10,000 for 6 months. Includes API access, white-label dashboard, co-marketing, and a dedicated integration engineer.',
  DEFAULT: 'Pricing is $5,000–$25,000 depending on scope, with a 6-month pilot structure. We can tailor the package to your needs.',
};

export async function runAutoReply(task: Task): Promise<void> {
  const payload = task.payload as AutoReplyPayload;
  const { leadEmail, leadName, leadOrg, segment, replyText, intent, threadId } = payload;

  const intentGuidance = intent === 'pricing'
    ? `Pricing context for ${segment}: ${PRICING_TABLE[segment] ?? PRICING_TABLE.DEFAULT}\nProvide clear pricing, justify the ROI, and offer a direct payment link.`
    : `This is an objection. Address it directly, confidently, and with evidence. Do NOT be defensive.`;

  const prompt = `You are responding to a prospect on behalf of AuthiChain. No hedging — be direct and close.

Prospect: ${leadName ?? 'there'} at ${leadOrg ?? 'your org'}
Their message: """${replyText.slice(0, 600)}"""
Intent category: ${intent}
${intentGuidance}

Write a 3–5 sentence reply that:
1. Acknowledges their specific point (one sentence)
2. Addresses it with facts/ROI (2–3 sentences)
3. Closes with a clear next step: "Reply to confirm and I'll send the agreement" or direct payment link offer

Return JSON: { "subject": "Re: [keep thread subject]", "body": "..." }`;

  const result = await invokeLLM({
    messages: [{ role: 'user', content: prompt }],
    responseFormat: { type: 'json_object' },
  });

  const parsed_reply = parseLLMContent<any>(result.choices[0].message.content);
  const subject = parsed_reply.subject ?? `Re: AuthiChain`;
  const body = parsed_reply.body ?? '';

  const sendResult = await sendEmail({ to: leadEmail, subject, body });

  if (sendResult.status === 'sent') {
    // Check again in 72h
    const check72h = new Date(Date.now() + 72 * 60 * 60 * 1000);
    await enqueueTask(task.missionId, 'CHECK_REPLIES', {
      threadId: sendResult.threadId ?? threadId,
      leadEmail, leadName, leadOrg, segment, sequence: 0, maxSequence: 1,
    }, check72h);
  }

  await logActivity({
    userId: null, action: 'auto_reply_sent', entityType: 'task', entityId: 0,
    details: { taskId: task.id, leadEmail, segment, intent, sendStatus: sendResult.status },
  });
}
