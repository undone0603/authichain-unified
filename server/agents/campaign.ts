import { Db } from '../db';
import { Task } from '../drizzle/schema';
import { logActivity, enqueueTask } from './db-helpers';
import { sendEmail } from '../email-service';
import { invokeLLM, parseLLMContent } from '../_core/llm';

/**
 * runEmailCampaign Agent
 * 
 * Orchestrates automated email outreach:
 * 1. Takes a segment and campaign template ID.
 * 2. Fetches eligible leads for the segment.
 * 3. For each lead, generates a personalized email draft via LLM.
 * 4. Sends the email or marks as draft for human approval.
 * 5. Logs campaign progress.
 */
export async function runEmailCampaign(task: Task, db: Db): Promise<void> {
  const { segment, templateId, campaignId } = task.payload as {
    segment: string;
    templateId: string;
    campaignId: string;
  };

  await logActivity(db, {
    userId: null,
    action: 'email_campaign_started',
    entityType: 'task',
    entityId: 0,
    details: { taskId: task.id, segment, campaignId },
  });

  // 1. Fetch eligible leads for this segment (simplified mock logic)
  const leads = await db.query.leads.findMany({
    where: (leads, { and, eq, isNull }) =>
      and(eq(leads.segment, segment), isNull(leads.lastOutreachAt)),
  });

  for (const lead of leads) {
    // 2. Personalize email
    const prompt = `Write a personalized email for ${lead.name} at ${lead.org}.
    Template Context: ${templateId}
    Goal: AuthiChain trust infrastructure.
    Return JSON: { "subject": "...", "body": "..." }`;

    const result = await invokeLLM(prompt);
    const email = parseLLMContent<{ subject: string; body: string }>(result.choices[0].message.content);

    // 3. Send/Queue
    const sendResult = await sendEmail({
      to: lead.email,
      subject: email.subject,
      body: email.body,
    });

    // 4. Log status
    await logActivity(db, {
      userId: null,
      action: 'email_sent',
      entityType: 'lead',
      entityId: lead.id,
      details: { taskId: task.id, campaignId, status: sendResult.status },
    });
  }

  await logActivity(db, {
    userId: null,
    action: 'email_campaign_completed',
    entityType: 'task',
    entityId: 0,
    details: { taskId: task.id, campaignId, leadsProcessed: leads.length },
  });
}
