/**
 * Moonshot Deal Agent
 *
 * Targets high-value, non-standard deals in entertainment, sports, creator, and
 * collectibles verticals. Pitches creative deal structures (revenue-share, per-unit,
 * platform integrations) rather than plain flat-fee pilots. Uses cultural hooks,
 * sector-specific counterfeit scandals, and urgency tied to real industry moments.
 */
import { invokeLLM } from '../_core/llm.js';
import { sendEmail } from '../email-service.js';
import { logActivity, enqueueTask, getDb } from '../db.js';
import { leads } from '../../drizzle/schema.js';
import { eq } from 'drizzle-orm';
import type { MissionTask as Task } from '../../drizzle/schema.js';

// ─── Segment intelligence ──────────────────────────────────────────────────────

const SEGMENT_CONTEXT: Record<string, {
  painPoint: string;
  hook: string;
  dealStructure: string;
  dealLabel: string;
  priceUsd: number;
  altStructure: string;
}> = {
  ENTERTAINMENT: {
    painPoint: "Fake merch is estimated to cost the music and film industry $4B+ annually. Every counterfeit hoodie or bootleg vinyl sold is a direct royalty leak from artists and studios.",
    hook: "When a fan buys a 'tour exclusive' hoodie on eBay, there's a 1-in-3 chance it's fake. AuthiChain gives every official drop a scannable blockchain certificate — fans love it, counterfeiters can't replicate it.",
    dealStructure: "$75,000 flat pilot OR 0.5% of authenticated product revenue — whichever is lower after 6 months.",
    dealLabel: "Entertainment Pilot",
    priceUsd: 75_000,
    altStructure: "0.5% of authenticated product GMV (capped at $75K for the first 6 months)",
  },
  SPORTS: {
    painPoint: "The sports memorabilia market loses $1B+ annually to fakes. One in five signed jerseys sold online is counterfeit. Authentication services charge $50–$200 per item with 6-week turnaround — that's dead inventory.",
    hook: "Instant blockchain authentication at the point of signing, not weeks later. Every jersey, card, and cleat gets a tamper-evident QR that resolves to an immutable chain-of-custody record.",
    dealStructure: "$50,000 flat pilot OR $2 per authenticated item — whichever fits your volume better.",
    dealLabel: "Sports Authentication Pilot",
    priceUsd: 50_000,
    altStructure: "$2/authenticated item (ideal for high-volume orgs — pays for itself at 25,000+ items/year)",
  },
  CREATOR: {
    painPoint: "Creator merchandise is the most counterfeited category in DTC. Fake drops erode brand trust and cannibalize the very fans who love you most. There's no scalable way to prove a hoodie is the real drop — until now.",
    hook: "Give every piece of your merch a soul. Scan the tag, see the blockchain certificate, watch the community flex the proof. AuthiChain turns authentication into a fan engagement moment, not just a security feature.",
    dealStructure: "$10,000 for a 6-month integration OR $1 per authenticated drop item — pay only for what you launch.",
    dealLabel: "Creator Merch Pilot",
    priceUsd: 10_000,
    altStructure: "$1/authenticated item with no monthly minimum (aligns our incentives with your drop volume)",
  },
  COLLECTIBLES: {
    painPoint: "Authentication is the #1 trust barrier in the collectibles market. Grading companies take weeks and charge $50–$500 per item. Meanwhile, fakes flood every major marketplace. It's a $500B market with a trust crisis at its core.",
    hook: "Instant on-chain authentication for physical collectibles — trading cards, sneakers, memorabilia, limited editions. Every item gets an NFT provenance record the moment it's authenticated. Resellers and buyers can verify in seconds.",
    dealStructure: "$100,000 for a full platform integration — unlimited items, white-label dashboard, API access, and a co-branded 'AuthiChain Verified' trust mark.",
    dealLabel: "Collectibles Platform Integration",
    priceUsd: 100_000,
    altStructure: "Platform integration with per-item authentication fees after a 10,000-item threshold",
  },
};

// ─── Moonshot pitch email ──────────────────────────────────────────────────────

interface MoonshotPayload {
  leadEmail: string;
  leadName?: string;
  leadOrg?: string;
  leadTitle?: string;
  segment: string;
  threadId?: string;
}

export async function runPitchMoonshotDeal(task: Task): Promise<void> {
  const payload = task.payload as MoonshotPayload;
  const { leadEmail, leadName, leadOrg, leadTitle, segment } = payload;
  const ctx = SEGMENT_CONTEXT[segment] ?? SEGMENT_CONTEXT.ENTERTAINMENT;

  const prompt = `You are AgentZ, an autonomous deal-closer for AuthiChain — a blockchain product authentication platform.

Your target:
- Name: ${leadName ?? 'there'}
- Title: ${leadTitle ?? 'Decision-Maker'}
- Company: ${leadOrg ?? 'their organization'}
- Segment: ${segment}

The opportunity:
${ctx.painPoint}

The hook:
${ctx.hook}

Deal structure to offer:
${ctx.dealStructure}
Alternative: ${ctx.altStructure}

Write a cold outreach email that:
1. Opens with a single punchy sentence about their specific pain — no pleasantries, no "I hope this finds you well"
2. Delivers the hook in 2–3 sentences — specific, vivid, makes them feel the problem and the solution simultaneously
3. Proposes the deal structure clearly — give them both options (flat fee and alt structure)
4. Closes with one clear ask: "Reply YES and I'll send the full brief + payment link today."
5. Sign off as "AgentZ @ AuthiChain" — lean into the autonomous deal-closer identity, it's a conversation starter

Tone: direct, witty, a little audacious. This is a moonshot pitch, not a brochure. No bullet lists. Max 180 words.

Return JSON: { "subject": "...", "body": "..." }`;

  const result = await invokeLLM({
    messages: [{ role: 'user', content: prompt }],
    responseFormat: { type: 'json_object' },
  });

  let subject: string;
  let body: string;
  try {
    const parsed = JSON.parse(result.choices[0].message.content as string ?? '{}');
    subject = parsed.subject ?? `Moonshot deal for ${leadOrg ?? segment}`;
    body = parsed.body ?? '';
  } catch {
    throw new Error('PITCH_MOONSHOT_DEAL LLM returned unparseable JSON');
  }

  if (!body) throw new Error('Moonshot LLM returned empty body');

  const sendResult = await sendEmail({
    to: leadEmail,
    subject,
    body,
    fromName: "AgentZ @ AuthiChain",
    trackLeadEmail: leadEmail,
  });

  if (sendResult.status === 'sent') {
    // Update lead status
    const db = await getDb();
    if (db) {
      await db.update(leads)
        .set({ status: 'MOONSHOT_PITCHED', updatedAt: new Date() })
        .where(eq(leads.email, leadEmail.toLowerCase()));
    }
    // Check for reply in 72h
    const check72h = new Date(Date.now() + 72 * 60 * 60 * 1000);
    await enqueueTask(task.missionId, 'CHECK_REPLIES', {
      threadId: sendResult.threadId ?? payload.threadId,
      leadEmail, leadName, leadOrg, leadTitle, segment, sequence: 0, maxSequence: 2,
    }, check72h);
  }

  await logActivity({
    userId: null, action: 'moonshot_pitched', entityType: 'task', entityId: 0,
    details: { taskId: task.id, leadEmail, segment, sendStatus: sendResult.status, priceUsd: ctx.priceUsd },
  });
}

// ─── Moonshot proposal (triggered after YES reply) ─────────────────────────────

export async function runMoonshotProposal(task: Task): Promise<void> {
  const payload = task.payload as MoonshotPayload & { replyText?: string };
  const { leadEmail, leadName, leadOrg, leadTitle, segment, replyText } = payload;
  const ctx = SEGMENT_CONTEXT[segment] ?? SEGMENT_CONTEXT.ENTERTAINMENT;

  const prompt = `Write a moonshot deal brief for AuthiChain's ${segment} segment.

Client: ${leadName ?? 'Decision-Maker'} at ${leadOrg ?? 'their organization'}${leadTitle ? `, ${leadTitle}` : ''}
${replyText ? `Their reply: "${replyText.slice(0, 300)}"` : ''}

Pain: ${ctx.painPoint}
Our solution: ${ctx.hook}
Deal: ${ctx.dealStructure}
Alt: ${ctx.altStructure}

Write a 350–500 word deal brief covering:
1. The Problem (specific to their segment — include a real statistic)
2. The AuthiChain Solution (QR + blockchain + AI confidence scoring)
3. The Deal (both structures spelled out with numbers)
4. What Happens Next (one sentence: click the link below to lock in your pilot)

Tone: punchy, founder-to-founder energy. This is not a formal proposal — it's a term sheet in email form.

Return JSON: { "subject": "AuthiChain x ${leadOrg ?? 'Your Brand'} — Deal Brief", "body": "..." }`;

  const result = await invokeLLM({
    messages: [{ role: 'user', content: prompt }],
    responseFormat: { type: 'json_object' },
  });

  let subject: string;
  let body: string;
  try {
    const parsed = JSON.parse(result.choices[0].message.content as string ?? '{}');
    subject = parsed.subject ?? `AuthiChain x ${leadOrg ?? segment} — Deal Brief`;
    body = parsed.body ?? '';
  } catch {
    throw new Error('MOONSHOT_PROPOSAL LLM returned unparseable JSON');
  }

  let paymentLink: string | undefined;
  if (ctx.priceUsd > 0) {
    try {
      const { getStripe } = await import('../stripe-service.js');
      const stripe = getStripe();
      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        line_items: [{
          price_data: {
            currency: 'usd',
            unit_amount: ctx.priceUsd * 100,
            product_data: {
              name: `AuthiChain ${ctx.dealLabel}`,
              description: ctx.altStructure,
            },
          },
          quantity: 1,
        }],
        metadata: { leadEmail, segment, missionId: task.missionId, taskId: task.id },
        success_url: 'https://authichain.com/welcome?session_id={CHECKOUT_SESSION_ID}',
        cancel_url: 'https://authichain.com/pricing',
        customer_email: leadEmail,
        expires_at: Math.floor(Date.now() / 1000) + 86400 * 30,
      });
      paymentLink = session.url ?? undefined;
    } catch { /* non-fatal */ }
  }

  const paymentSection = paymentLink
    ? `\n\n---\nLock in your pilot: ${paymentLink}\n(Valid 30 days. Payment = deal accepted.)`
    : '';

  await sendEmail({
    to: leadEmail,
    subject,
    body: `${body}${paymentSection}`,
    fromName: "AgentZ @ AuthiChain",
    trackLeadEmail: leadEmail,
  });

  await logActivity({
    userId: null, action: 'moonshot_proposal_sent', entityType: 'task', entityId: 0,
    details: { taskId: task.id, leadEmail, segment, hasPaymentLink: !!paymentLink, priceUsd: ctx.priceUsd },
  });
}
