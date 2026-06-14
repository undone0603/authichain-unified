import { invokeLLM } from '../_core/llm.js';
import { ENV } from '../_core/env.js';
import { sendEmail } from '../email-service.js';
import { logActivity, getDb, markTaskWaitingHuman } from '../db.js';
import { emailDrafts, leads } from '../../drizzle/schema.js';
import { eq, and, lte, inArray } from 'drizzle-orm';
import type { MissionTask as Task } from '../../drizzle/schema.js';

interface FollowupPayload {
  segment?: string;
  maxFollowups?: number;
}

export async function runFollowupSequence(task: Task): Promise<void> {
  const payload = task.payload as FollowupPayload;
  const segment = payload.segment ?? 'GOV';
  const maxFollowups = payload.maxFollowups ?? 3;

  const db = await getDb();
  if (!db) {
    await logActivity({ userId: null, action: 'followup_skipped_no_db', entityType: 'task', entityId: 0, details: { taskId: task.id, segment } });
    return;
  }

  const now = new Date();
  const dueLeads = await db.select().from(leads).where(
    and(
      eq(leads.segment, segment),
      inArray(leads.status, ['CONTACTED']),
      lte(leads.nextActionAt, now),
    )
  );

  let drafted = 0;
  let sent = 0;

  for (const lead of dueLeads) {
    const meta = (lead.metadata as Record<string, number> | null) ?? {};
    const followupNum = Math.min((meta.followupCount ?? 0) + 1, maxFollowups);

    const tone = followupNum === 1 ? 'gentle reminder' : followupNum === 2 ? 'value-focused' : 'final outreach with urgency';

    const prompt = `Write follow-up email ${followupNum} of ${maxFollowups} to ${lead.name ?? lead.email} at ${lead.company ?? 'their organization'} about AuthiChain product authentication.
Tone: ${tone}
Keep it to 2-3 sentences. End with a clear CTA.
Return JSON: { "subject": "...", "body": "..." }`;

    const result = await invokeLLM({
      messages: [{ role: 'user', content: prompt }],
      responseFormat: { type: 'json_object' },
    });

    let subject: string;
    let body: string;
    try {
      const parsed = JSON.parse(result.choices[0].message.content as string ?? '{}');
      subject = parsed.subject ?? `Follow-up ${followupNum}: AuthiChain`;
      body = parsed.body ?? '';
    } catch {
      continue;
    }

    if (!body) continue;

    const nextActionAt = new Date(now.getTime() + (followupNum < maxFollowups ? 4 * 86400_000 : 7 * 86400_000));

    if (ENV.requireOutreachApproval) {
      await db.insert(emailDrafts).values({
        prospectEmail: lead.email,
        prospectName: lead.name ?? undefined,
        prospectCompany: lead.company ?? undefined,
        subject,
        body,
        status: 'pending',
        generatedBy: 'agentz_followup',
        notes: `taskId:${task.id}`,
      });
      await db.update(leads)
        .set({ nextActionAt, metadata: { ...meta, followupCount: followupNum }, updatedAt: new Date() })
        .where(eq(leads.id, lead.id));
      drafted++;
    } else {
      const sendResult = await sendEmail({ to: lead.email, subject, body });
      await db.update(leads)
        .set({
          status: 'CONTACTED',
          lastContactedAt: now,
          nextActionAt,
          metadata: { ...meta, followupCount: followupNum },
          updatedAt: new Date(),
        })
        .where(eq(leads.id, lead.id));
      if (sendResult.status === 'sent') sent++;
    }
  }

  if (ENV.requireOutreachApproval && drafted > 0) {
    await markTaskWaitingHuman(task.id);
  }

  await logActivity({ userId: null, action: 'followup_sequence_completed', entityType: 'task', entityId: 0, details: { taskId: task.id,
    segment,
    dueLeads: dueLeads.length,
    drafted,
    sent,
  }});
}
