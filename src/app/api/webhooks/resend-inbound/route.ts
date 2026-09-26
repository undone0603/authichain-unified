/**
 * Webhook endpoint for Resend inbound email routing.
 * Receives inbound emails to proposals@authichain.com and processes them.
 *
 * Unsigned posts are refused. The edge copy in worker-app/resend-inbound.ts
 * is the live path; this Node route uses the same Standard Webhooks check
 * so a direct hit cannot insert a reply or flip a lead to replied.
 *
 * Audit (reply classifier path):
 * - Classification always runs for legitimate, non-duplicate inbound.
 * - Side effects here are local only: insert inbound_replies, update the
 *   matched leads row, console.log domain + sentiment. This route does
 *   **not** write HubSpot (HUBSPOT_ACCESS_TOKEN is unused here; CRM sync
 *   is `/api/crm/sync`) and does **not** draft or send a reply.
 * - Actionability: positive/objection + matched lead → nurture cron
 *   (`/api/cron/nurture-replies`) auto-sends later. Neutral/negative or
 *   unmatched → `/dashboard/inbound-replies` for manual review.
 * - Paid LLM is optional. Missing OPENAI_API_KEY is reported on GET/POST
 *   as `classifier.missingSecret`; Ollama then heuristic keep the path live.
 */

import { db } from '@/db';
import { inboundReplies, leads } from '@/db/schema';
import { eq, sql } from 'drizzle-orm';
import {
  classifyReplyEmail,
  inboundReplyAction,
  isProbablyLegitimateReply,
  resolveReplyClassifierBackend,
} from '@/lib/sentiment-classifier';
import { matchReplyToProposal, normalizeEmail } from '@/lib/proposal-matcher';
import { verifyWebhookSignature } from '@/lib/standard-webhooks';
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

function parseEmailAddress(emailString: string): string {
  const match = emailString.match(/<([^>]{1,256})>/);
  return match ? match[1] : emailString;
}

function extractSenderName(emailString: string): string | null {
  const match = emailString.match(/^([^<]+)</);
  if (match && match[1]) {
    return match[1].trim();
  }
  return null;
}

function signatureHeaders(request: NextRequest) {
  return {
    id: request.headers.get('webhook-id') ?? request.headers.get('svix-id') ?? undefined,
    timestamp:
      request.headers.get('webhook-timestamp') ??
      request.headers.get('svix-timestamp') ??
      undefined,
    signature:
      request.headers.get('webhook-signature') ??
      request.headers.get('svix-signature') ??
      undefined,
  };
}

/**
 * Ops probe: which classifier backend will run, and the exact missing
 * paid secret if any. Does not send mail or write the database.
 */
export async function GET() {
  const backend = resolveReplyClassifierBackend();
  return NextResponse.json({
    ok: true,
    signatureRequired: true,
    webhookSecretConfigured: Boolean(process.env.RESEND_WEBHOOK_SECRET),
    classifier: backend,
    sideEffects: {
      hubspotWrite: false,
      draftReply: false,
      persistInboundReply: true,
      nurtureCron: '/api/cron/nurture-replies',
      dashboard: '/dashboard/inbound-replies',
    },
    autoflow: {
      industryClassifier: 'shared/industries.ts',
      strategyDoc: 'docs/knowledge/AI_AUTOFLOW_STRATEGY.md',
    },
  });
}

export async function POST(request: NextRequest) {
  try {
    const secret = process.env.RESEND_WEBHOOK_SECRET;
    if (!secret) {
      return NextResponse.json(
        { error: 'RESEND_WEBHOOK_SECRET not configured' },
        { status: 503 },
      );
    }

    const rawBody = await request.text();
    if (!verifyWebhookSignature(secret, signatureHeaders(request), rawBody)) {
      return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
    }

    let payload: ResendInboundPayload;
    try {
      payload = JSON.parse(rawBody) as ResendInboundPayload;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    if (!payload.from || !payload.subject || !payload.messageId) {
      return NextResponse.json(
        { error: 'Missing required fields: from, subject, or messageId' },
        { status: 400 },
      );
    }

    const senderEmail = normalizeEmail(parseEmailAddress(payload.from));
    const senderName = extractSenderName(payload.from);
    const emailBody = payload.text || payload.html || '';

    if (!isProbablyLegitimateReply(payload.subject, emailBody)) {
      console.log('Skipping non-legitimate reply', { senderEmail, subjectLength: payload.subject.length });
      return NextResponse.json({ skipped: true, reason: 'Auto-reply or bounce detected' }, { status: 200 });
    }

    const existing = await db.select().from(inboundReplies).where(eq(inboundReplies.messageId, payload.messageId)).limit(1);

    if (existing.length > 0) {
      console.log('Duplicate email detected', { messageIdLength: payload.messageId.length });
      return NextResponse.json({ skipped: true, reason: 'Duplicate message ID' }, { status: 200 });
    }

    const match = await matchReplyToProposal(senderEmail, payload.subject, payload.messageId, payload.inReplyTo);

    const backend = resolveReplyClassifierBackend();
    const sentimentResult = await classifyReplyEmail(emailBody, payload.subject);

    let leadId: number | null = null;
    if (match.leadId) {
      leadId = match.leadId;
    } else {
      const leadByEmail = await db
        .select()
        .from(leads)
        .where(eq(leads.email, senderEmail))
        .limit(1);
      if (leadByEmail.length > 0) {
        leadId = leadByEmail[0].id;
      }
    }

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
          classifierProvider: sentimentResult.provider,
          classifierMissingSecret: backend.missingSecret ?? null,
          originalHeaders: payload.headers || {},
          replyTo: payload.replyTo,
        },
      })
      .returning();

    if (replyInsert.length === 0) {
      throw new Error('Failed to insert inbound reply');
    }

    const reply = replyInsert[0];
    const action = inboundReplyAction(sentimentResult.sentiment, leadId);

    if (leadId) {
      await db
        .update(leads)
        .set({
          emailReplied: true,
          sentiment: sentimentResult.sentiment,
          lastReplyAt: new Date(),
          objectionType: sentimentResult.objectionType || undefined,
          repliesReceived: sql`COALESCE(${leads.repliesReceived}, 0) + 1`,
          lastContactedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(leads.id, leadId));
    }

    console.log('Processed inbound reply', { senderEmailDomain: senderEmail.split('@')[1], sentiment: sentimentResult.sentiment });

    return NextResponse.json(
      {
        success: true,
        replyId: reply.id,
        sentiment: sentimentResult.sentiment,
        matchConfidence: match.confidence,
        leadId,
        action,
        classifier: {
          provider: sentimentResult.provider,
          missingSecret: backend.missingSecret ?? null,
          paidLlmAvailable: backend.paidLlmAvailable,
        },
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
