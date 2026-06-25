/**
 * Webhook endpoint for Resend inbound email routing.
 * Receives inbound emails to proposals@authichain.com and processes them.
 *
 * Setup: Create a route in Resend dashboard:
 * - Domain: authichain.com
 * - Route name: proposals@authichain.com
 * - Forward to: https://api.authichain.com/api/webhooks/resend-inbound (or your domain)
 */

import { db } from '@/db';
import { inboundReplies, leads } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import { classifyReplyEmail, isProbablyLegitimateReply } from '@/lib/sentiment-classifier';
import { matchReplyToProposal, normalizeEmail } from '@/lib/proposal-matcher';
import { NextRequest, NextResponse } from 'next/server';

interface ResendInboundPayload {
  from: string;
  subject: string;
  text?: string;
  html?: string;
  messageId: string;
  inReplyTo?: string;
  headers?: Record<string, string>;
  replyTo?: string;
  cc?: string;
  bcc?: string;
}

/**
 * Parse email address from "Name <email@domain>" format
 */
function parseEmailAddress(emailString: string): string {
  const match = emailString.match(/<([^>]+)>/);
  return match ? match[1] : emailString;
}

/**
 * Extract sender name from "Name <email@domain>" format
 */
function extractSenderName(emailString: string): string | null {
  const match = emailString.match(/^([^<]+)</);
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}

export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as ResendInboundPayload;

    // Validate required fields
    if (!payload.from || !payload.subject || !payload.messageId) {
      return NextResponse.json(
        { error: 'Missing required fields: from, subject, or messageId' },
        { status: 400 },
      );
    }

    const senderEmail = normalizeEmail(parseEmailAddress(payload.from));
    const senderName = extractSenderName(payload.from);
    const emailBody = payload.text || payload.html || '';

    // Check if this is a legitimate reply (not auto-reply, bounce, etc.)
    if (!isProbablyLegitimateReply(payload.subject, emailBody)) {
      console.log(`Skipping non-legitimate reply from ${senderEmail}: ${payload.subject}`);
      return NextResponse.json({ skipped: true, reason: 'Auto-reply or bounce detected' }, { status: 200 });
    }

    // Check for duplicate (idempotency)
    const existing = await db.select().from(inboundReplies).where(eq(inboundReplies.messageId, payload.messageId)).limit(1);

    if (existing.length > 0) {
      console.log(`Duplicate email detected: ${payload.messageId}`);
      return NextResponse.json({ skipped: true, reason: 'Duplicate message ID' }, { status: 200 });
    }

    // Match reply to proposal
    const match = await matchReplyToProposal(senderEmail, payload.subject, payload.messageId, payload.inReplyTo);

    // Classify sentiment
    const sentimentResult = await classifyReplyEmail(emailBody, payload.subject);

    // Find or reference lead
    let leadId: number | null = null;
    if (match.leadId) {
      leadId = match.leadId;
    } else {
      // Try to find lead by email
      const leadByEmail = await db
        .select()
        .from(leads)
        .where(eq(leads.email, senderEmail))
        .limit(1);
      if (leadByEmail.length > 0) {
        leadId = leadByEmail[0].id;
      }
    }

    // Insert into inbound_replies
    const replyInsert = await db
      .insert(inboundReplies)
      .values({
        leadId,
        leadEmail: senderEmail,
        senderName: senderName || undefined,
        subject: payload.subject,
        bodyPlaintext: payload.text || undefined,
        bodyHtml: payload.html || undefined,
        messageId: payload.messageId,
        sentiment: sentimentResult.sentiment,
        objectionType: sentimentResult.objectionType || undefined,
        objectionDetails: sentimentResult.objectionDetails || undefined,
        confidence: sentimentResult.confidence,
        proposalMatchId: match.proposalId || undefined,
        matchConfidence: match.confidence,
        status: 'new',
        metadata: {
          matchMethod: match.method,
          matchReason: match.reason,
          sentimentReasoning: sentimentResult.reasoning,
          originalHeaders: payload.headers || {},
          replyTo: payload.replyTo,
        },
      })
      .returning();

    if (replyInsert.length === 0) {
      throw new Error('Failed to insert inbound reply');
    }

    const reply = replyInsert[0];

    // Update leads table if matched
    if (leadId) {
      await db
        .update(leads)
        .set({
          emailReplied: true,
          sentiment: sentimentResult.sentiment,
          lastReplyAt: new Date(),
          objectionType: sentimentResult.objectionType || undefined,
          // Atomic increment of the reply counter, COALESCE so a NULL seed
          // starts at 0 rather than producing NULL.
          repliesReceived: sql`COALESCE(${leads.repliesReceived}, 0) + 1`,
          lastContactedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(leads.id, leadId));
    }

    console.log(`Processed inbound reply: ${senderEmail} - Sentiment: ${sentimentResult.sentiment}`);

    return NextResponse.json(
      {
        success: true,
        replyId: reply.id,
        sentiment: sentimentResult.sentiment,
        matchConfidence: match.confidence,
        leadId,
      },
      { status: 201 },
    );
  } catch (error) {
    console.error('Error processing inbound email:', error);
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : String(error),
      },
      { status: 500 },
    );
  }
}
