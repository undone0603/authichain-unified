import type { Db } from "../db-helpers";
import type { MissionTask as Task } from "../../drizzle/schema";
import { leads } from "../../drizzle/schema";
import { and, eq, isNull } from "drizzle-orm";
import { logActivity } from "./db-helpers";
import { sendEmail } from "../email-service";
import { invokeLLM, parseLLMContent, type InvokeParams } from "../_core/llm";

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
    action: "email_campaign_started",
    entityType: "task",
    entityId: 0,
    details: { taskId: task.id, segment, campaignId },
  });

  // 1. Fetch eligible leads for this segment (not yet contacted)
  const leadRows = await db
    .select()
    .from(leads)
    .where(and(eq(leads.segment, segment), isNull(leads.lastContactedAt)));

  for (const lead of leadRows) {
    // 2. Personalize email
    const params: InvokeParams = {
      messages: [
        {
          role: "system",
          content:
            "You are an expert B2B email copywriter. Return only valid JSON.",
        },
        {
          role: "user",
          content: `Write a personalized email for ${lead.name} at ${lead.company}.
    Template Context: ${templateId}
    Goal: AuthiChain trust infrastructure.
    Return JSON: { "subject": "...", "body": "..." }`,
        },
      ],
    };

    const result = await invokeLLM(params);
    const email = parseLLMContent<{ subject: string; body: string }>(
      result.choices[0].message.content
    );

    // 3. Send/Queue
    const sendResult = await sendEmail({
      to: lead.email,
      subject: email.subject,
      body: email.body,
    });

    // 4. Log status
    await logActivity(db, {
      userId: null,
      action: "email_sent",
      entityType: "lead",
      entityId: lead.id,
      details: { taskId: task.id, campaignId, status: sendResult.status },
    });
  }

  await logActivity(db, {
    userId: null,
    action: "email_campaign_completed",
    entityType: "task",
    entityId: 0,
    details: { taskId: task.id, campaignId, leadsProcessed: leadRows.length },
  });
}
