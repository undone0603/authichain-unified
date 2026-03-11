import { invokeLLM } from '../_core/llm.js';
import { ENV } from '../_core/env.js';
import { sendEmail } from '../email-service.js';
import { logActivity, getDb, markTaskWaitingHuman } from '../db.js';
import { emailDrafts, leads } from '../../drizzle/schema.js';
import { eq } from 'drizzle-orm';
import type { MissionTask as Task } from '../../drizzle/schema.js';

interface OutboundEmailPayload {
  segment?: string;
  sequence?: number;
  leadEmail?: string;
  leadName?: string;
  leadOrg?: string;
  leadTitle?: string;
}

const segmentContext: Record<string, string> = {
  GOV: 'government agency procurement officer focused on supply chain integrity and anti-counterfeiting',
  RETAIL: 'retail business owner (dispensary or specialty retail) focused on product authenticity and brand trust',
  PRESS: 'technology journalist or crypto reporter interested in blockchain product authentication',
  PARTNER: 'technology partner or integration partner interested in embedded authentication APIs',
};

export async function runOutboundEmail(task: Task): Promise<void> {
  const payload = task.payload as OutboundEmailPayload;
  const segment = payload.segment ?? 'GOV';
  const sequence = payload.sequence ?? 1;
  const recipientContext = segmentContext[segment] ?? 'business professional';

  const subjectPrompt = sequence === 1
    ? 'Introducing AuthiChain – Product Authentication on the Blockchain'
    : `Follow-up ${sequence}: AuthiChain Product Authentication`;

  const prompt = `You are writing a concise, professional cold outreach email on behalf of AuthiChain (authichain.com).

Recipient: ${payload.leadName ?? 'there'} at ${payload.leadOrg ?? 'your organization'}${payload.leadTitle ? `, ${payload.leadTitle}` : ''}
Recipient profile: ${recipientContext}
Sequence: Email ${sequence} of 3

AuthiChain helps brands and distributors verify product authenticity using blockchain-backed QR codes and AI analysis. Key value props:
- Instant product authentication via QR scan
- Tamper-evident certificate of authenticity
- Counterfeit detection with AI confidence scoring
- NFT-backed provenance trail

Write a ${sequence === 1 ? '3-4 sentence intro email' : '2-3 sentence follow-up'} that is direct, specific to their segment, and ends with a clear CTA (schedule a 15-min call or reply with interest).

Return a JSON object: { "subject": "...", "body": "..." }`;

  const result = await invokeLLM({
    messages: [{ role: 'user', content: prompt }],
    responseFormat: { type: 'json_object' },
  });

  let subject: string;
  let body: string;
  try {
    const parsed = JSON.parse(result.choices[0].message.content as string ?? '{}');
    subject = parsed.subject ?? subjectPrompt;
    body = parsed.body ?? '';
  } catch {
    throw new Error(`Outbound email LLM returned unparseable JSON`);
  }

  if (!body) throw new Error('LLM returned empty email body');

  if (ENV.requireOutreachApproval) {
    const db = await getDb();
    if (db) {
      await db.insert(emailDrafts).values({
        prospectEmail: payload.leadEmail ?? 'unknown@unknown.com',
        prospectName: payload.leadName ?? undefined,
        prospectCompany: payload.leadOrg ?? undefined,
        prospectTitle: payload.leadTitle ?? undefined,
        subject,
        body,
        status: 'pending',
        generatedBy: 'agentz',
        taskId: task.id,
      });
    }

    await markTaskWaitingHuman(task.id);
    await logActivity({ userId: null, action: 'outbound_email_draft_pending_approval', entityType: 'task', entityId: 0, details: { taskId: task.id,
      segment,
      sequence,
      leadEmail: payload.leadEmail,
      subject,
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

  await logActivity({ userId: null, action: 'outbound_email_sent', entityType: 'task', entityId: 0, details: { taskId: task.id,
    segment,
    sequence,
    leadEmail: payload.leadEmail,
    subject,
    sendStatus: sendResult.status,
  }});
}
