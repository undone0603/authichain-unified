import { invokeLLM, parseLLMContent } from '../_core/llm';
import { ENV } from '../_core/env';
import { sendEmail } from '../email-service';
import { logActivity, getDb, markTaskWaitingHuman, enqueueTask } from '../db';
import { emailDrafts, leads } from '../../drizzle/schema';
import { eq } from 'drizzle-orm';
import type { MissionTask as Task } from '../../drizzle/schema';
import {
  selectTone,
  SEGMENT_PRIORS,
  betaMean,
  betaCI,
  bayesianPreamble,
  type EmailTone,
} from '../_core/bayesian';

interface OutboundEmailPayload {
  segment?: string;
  sequence?: number;
  leadEmail?: string;
  leadName?: string;
  leadOrg?: string;
  leadTitle?: string;
  researchHook?: string;  // personalised opener injected by BROWSE_RESEARCH_LEAD
}

const segmentContext: Record<string, string> = {
  GOV:     'government agency procurement officer focused on supply chain integrity and anti-counterfeiting',
  RETAIL:  'retail business owner (dispensary or specialty retail) focused on product authenticity and brand trust',
  LUXURY:  'Head of Brand Protection at a high-end luxury fashion house concerned with global counterfeiting and gray market diversion',
  PHARMA:  'Compliance or Supply Chain Director at a pharmaceutical manufacturer preparing for FDA DSCSA 2027 mandates',
  MEDTECH: 'Director of Quality or Regulatory Affairs at a medical device manufacturer focused on ISO 13485 compliance and preventing clinical trial fraud',
  TIMEPIECE: 'CEO or Founder of an independent luxury watch brand concerned with gray-market diversion and secondary market trust',
  PRESS:   'technology journalist or crypto reporter interested in blockchain product authentication',
  PARTNER: 'technology partner or integration partner interested in embedded authentication APIs',
};

const segmentCTAs: Record<string, string> = {
  LUXURY:  'Invite them to see a "Cinematic Storymode" demonstration for high-end product engagement.',
  MEDTECH: 'Direct them to the AuthiChain ROI Calculator to quantify their Year 1 savings on compliance labor.',
  PHARMA:  'Offer a 15-minute briefing on automated DSCSA 2027 technical readiness.',
  DEFAULT: 'Schedule a 15-minute call or reply with interest.',
};

const toneGuidance: Record<EmailTone, string> = {
  formal:  'Use a professional, respectful tone. Reference institutional responsibilities and compliance.',
  warm:    'Use a friendly, conversational tone. Acknowledge their work and build rapport first.',
  direct:  'Lead with ROI immediately. Be brief, specific, and end with a single concrete CTA.',
  story:   'Open with a one-sentence customer story or stat that creates curiosity, then pitch.',
};

export async function runOutboundEmail(task: Task): Promise<void> {
  const payload = task.payload as OutboundEmailPayload;
  const segment = payload.segment ?? 'GOV';
  const sequence = payload.sequence ?? 1;
  const recipientContext = segmentContext[segment] ?? 'business professional';
  const ctaDirective = segmentCTAs[segment] ?? segmentCTAs.DEFAULT;

  // ── Bayesian tone selection ────────────────────────────────────────────────
  const tone = selectTone(segment);
  const prior = SEGMENT_PRIORS[segment] ?? SEGMENT_PRIORS.DEFAULT;
  const conversionEstimate = betaMean(prior);
  const ci = betaCI(prior);

  const reasoning = bayesianPreamble({
    segment,
    tone,
    conversionEstimate,
    ci,
    evidence: payload.leadTitle ? [`lead title: ${payload.leadTitle}`] : [],
  });

  const subjectFallback = sequence === 1
    ? 'Introducing AuthiChain – Product Authentication on the Blockchain'
    : `Follow-up ${sequence}: AuthiChain Product Authentication`;

  // ── Bayesian-structured prompt ─────────────────────────────────────────────
  const hookLine = payload.researchHook
    ? `Opening hook (use this as your first sentence, lightly adapted): "${payload.researchHook}"\n`
    : '';

  const prompt = `${reasoning}You are writing a cold outreach email on behalf of AuthiChain (authichain.com).

Recipient: ${payload.leadName ?? 'there'} at ${payload.leadOrg ?? 'your organization'}${payload.leadTitle ? `, ${payload.leadTitle}` : ''}
Recipient profile: ${recipientContext}
Sequence: Email ${sequence} of 3
Tone directive: ${toneGuidance[tone]}
CTA directive: ${ctaDirective}
${hookLine}

AuthiChain helps brands verify product authenticity via blockchain-backed QR codes and AI. Key value props:
- Instant product authentication via QR scan
- Tamper-evident certificate of authenticity
- Counterfeit detection with AI confidence scoring
- NFT-backed provenance trail
- Compliance readiness for FDA DSCSA (Pharma) and ISO 13485 (MedTech)

Write a ${sequence === 1 ? '3-4 sentence intro email' : '2-3 sentence follow-up'} that applies the tone and CTA directives above. Ensure the email is concise, high-impact, and professional.

Return JSON: { "subject": "...", "body": "..." }`;

  const result = await invokeLLM({
    messages: [{ role: 'user', content: prompt }],
    responseFormat: { type: 'json_object' },
  });

  const parsed_email = parseLLMContent<any>(result.choices[0].message.content);
  const subject = parsed_email.subject ?? subjectFallback;
  const body = parsed_email.body ?? '';

  if (!body) throw new Error('LLM returned empty email body');

  if (ENV.requireOutreachApproval) {
    const db = await getDb();
    if (db) {
      await db.insert(emailDrafts).values({
        prospectEmail:   payload.leadEmail ?? 'unknown@unknown.com',
        prospectName:    payload.leadName ?? undefined,
        prospectCompany: payload.leadOrg ?? undefined,
        prospectTitle:   payload.leadTitle ?? undefined,
        subject,
        body,
        status:      'pending',
        generatedBy: 'agentz',
        notes:       `taskId:${task.id}`,
      });
    }

    await markTaskWaitingHuman(task.id);
    await logActivity({ userId: null, action: 'outbound_email_draft_pending_approval', entityType: 'task', entityId: 0, details: {
      taskId: task.id, segment, sequence, leadEmail: payload.leadEmail,
      subject, tone, conversionEstimate: conversionEstimate.toFixed(3),
    }});
    return;
  }

  if (!payload.leadEmail) throw new Error('No leadEmail in payload for direct send');

  const sendResult = await sendEmail({ to: payload.leadEmail, subject, body });

  const db = await getDb();
  if (db) {
    await db.update(leads)
      .set({ status: 'CONTACTED', lastContactedAt: new Date(), updatedAt: new Date() })
      .where(eq(leads.email, payload.leadEmail.toLowerCase()));
  }

  // Enqueue reply check in 48h so closer agent can pick up the thread
  if (sendResult.status === 'sent') {
    const check48h = new Date(Date.now() + 48 * 60 * 60 * 1000);
    await enqueueTask(task.missionId, 'CHECK_REPLIES', {
      threadId: sendResult.threadId,
      leadEmail:  payload.leadEmail,
      leadName:   payload.leadName,
      leadOrg:    payload.leadOrg,
      leadTitle:  payload.leadTitle,
      segment,
      sequence,
      maxSequence: 3,
    }, check48h);
  }

  await logActivity({ userId: null, action: 'outbound_email_sent', entityType: 'task', entityId: 0, details: {
    taskId: task.id, segment, sequence, leadEmail: payload.leadEmail,
    subject, sendStatus: sendResult.status,
    tone, conversionEstimate: conversionEstimate.toFixed(3),
    ci: `${(ci[0] * 100).toFixed(1)}%–${(ci[1] * 100).toFixed(1)}%`,
  }});
}
