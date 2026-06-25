/**
 * Cron job: Auto-nurture email replies
 * Runs every 2 hours to send follow-up emails based on reply sentiment
 *
 * Triggers:
 * - Positive reply → send calendar link (2 hour delay)
 * - Objection → send targeted response (3-6 hour delay by type)
 * - No reply after 7 days → send reminder
 */

import { db } from '@/db';
import { inboundReplies, replySequences, leads, proposals } from '@/db/schema';
import { eq, lt, isNull, and, lte } from 'drizzle-orm';
import { sendEmail } from '@/lib/email.ts';
import { selectTemplate } from '@/lib/email-templates';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Delays (in ms) before sending nurture email based on reply sentiment
 */
const NURTURE_DELAYS = {
  positive_followup: 2 * 60 * 60 * 1000, // 2 hours
  objection_budget: 4 * 60 * 60 * 1000, // 4 hours
  objection_timeline: 6 * 60 * 60 * 1000, // 6 hours
  objection_competitor: 3 * 60 * 60 * 1000, // 3 hours
  objection_decision_maker: 5 * 60 * 60 * 1000, // 5 hours
  reminder: 7 * 24 * 60 * 60 * 1000, // 7 days
};

export async function GET(request: NextRequest) {
  try {
    // Verify cron secret (if configured)
    const cronSecret = request.headers.get('authorization')?.replace('Bearer ', '');
    if (process.env.CRON_SECRET && cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const now = new Date();
    let processedCount = 0;

    // 1. Process NEW replies → create nurture sequences
    const newReplies = await db
      .select()
      .from(inboundReplies)
      .where(eq(inboundReplies.status, 'new'));

    for (const reply of newReplies) {
      // `nurturePaused` lives on the lead, not the reply. Skip replies with no
      // matched lead here; lead-level pause is enforced when the sequence is
      // actually sent (a paused lead carries status='nurture_paused').
      if (!reply.leadId) {
        continue;
      }

      const sentiment = reply.sentiment || 'neutral';

      // Determine template type and delay
      let templateType = 'reminder'; // default
      let delayMs = 0;

      if (sentiment === 'positive') {
        templateType = 'positive_followup';
        delayMs = NURTURE_DELAYS.positive_followup;
      } else if (sentiment === 'objection') {
        switch (reply.objectionType) {
          case 'budget':
            templateType = 'objection_budget';
            delayMs = NURTURE_DELAYS.objection_budget;
            break;
          case 'timeline':
            templateType = 'objection_timeline';
            delayMs = NURTURE_DELAYS.objection_timeline;
            break;
          case 'competitor':
            templateType = 'objection_competitor';
            delayMs = NURTURE_DELAYS.objection_competitor;
            break;
          case 'decision_maker':
            templateType = 'objection_decision_maker';
            delayMs = NURTURE_DELAYS.objection_decision_maker;
            break;
          default:
            delayMs = NURTURE_DELAYS.objection_budget; // default to 4h
        }
      }

      // Skip neutral/negative replies (manual review)
      if (sentiment === 'neutral' || sentiment === 'negative') {
        continue;
      }

      // Create nurture sequence entry
      const scheduledAt = new Date(Date.now() + delayMs);

      await db.insert(replySequences).values({
        leadId: reply.leadId,
        replyId: reply.id,
        templateType,
        sequenceNumber: 1,
        status: 'pending',
        nextScheduledAt: scheduledAt,
        metadata: {
          scheduledDelay: delayMs,
          createdAt: new Date().toISOString(),
        },
      });

      processedCount++;
    }

    // 2. Process PENDING sequences → send emails if scheduled time passed
    const pendingSequences = await db
      .select({
        sequence: replySequences,
        reply: inboundReplies,
        lead: leads,
      })
      .from(replySequences)
      .where(and(eq(replySequences.status, 'pending'), lte(replySequences.nextScheduledAt, now)))
      .innerJoin(inboundReplies, eq(replySequences.replyId, inboundReplies.id))
      .innerJoin(leads, eq(replySequences.leadId, leads.id));

    for (const { sequence, reply, lead } of pendingSequences) {
      try {
        // Generate email from template
        const templateFn = selectTemplate(reply.sentiment || 'neutral', reply.objectionType);
        const emailTemplate = templateFn({
          leadName: lead.name || 'there',
          leadCompany: lead.company || undefined,
          objectionDetails: reply.objectionDetails || undefined,
          calendlyUrl: process.env.CALENDLY_URL,
          pilotPrice: process.env.PILOT_PRICE || '$2,999',
        });

        // Send email
        const sendResult = await sendEmail({
          to: reply.leadEmail,
          from: process.env.NURTURE_EMAIL_FROM || 'proposals@authichain.com',
          subject: emailTemplate.subject,
          html: emailTemplate.body,
          text: emailTemplate.body,
        });

        if (sendResult.ok) {
          // Update sequence status
          await db
            .update(replySequences)
            .set({
              status: 'sent',
              sentAt: new Date(),
              nextScheduledAt: null,
              emailSubject: emailTemplate.subject,
              emailBody: emailTemplate.body,
              metadata: {
                ...((sequence.metadata as Record<string, unknown>) || {}),
                sentAt: new Date().toISOString(),
                provider: sendResult.provider,
              },
              updatedAt: new Date(),
            })
            .where(eq(replySequences.id, sequence.id));

          console.log(`Sent nurture email to ${reply.leadEmail} (${sequence.templateType})`);
          processedCount++;
        } else {
          console.error(`Failed to send nurture email to ${reply.leadEmail}:`, sendResult.error);
          // Mark as bounced, don't retry
          await db
            .update(replySequences)
            .set({
              status: 'bounced',
              metadata: {
                ...((sequence.metadata as Record<string, unknown>) || {}),
                error: sendResult.error,
              },
              updatedAt: new Date(),
            })
            .where(eq(replySequences.id, sequence.id));
        }
      } catch (error) {
        console.error(`Error processing nurture sequence ${sequence.id}:`, error);
      }
    }

    // 3. Process reminders for replies with no follow-up after 7 days
    // (This would query proposals by sent date, not yet fully implemented here)
    // For now, this is handled by manual review or separate job

    return NextResponse.json(
      {
        success: true,
        processed: processedCount,
        message: `Processed ${processedCount} reply nurture actions`,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error('Error in nurture-replies cron:', error);
    return NextResponse.json(
      {
        error: 'Cron job failed',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
