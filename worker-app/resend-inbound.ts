/**
 * Port of src/app/api/webhooks/resend-inbound/route.ts onto the edge router.
 * Captures replies to proposals@authichain.com: classify sentiment, match the
 * sender to a lead/proposal, store the reply in inbound_replies, and mark the
 * lead as replied. Like the original, it does not write HubSpot and does not
 * send anything; /api/cron/nurture-replies is ported on the edge router but
 * stays GROUP B / HELD (dry-run until NURTURE_SEND_ENABLED=true and ?send=1).
 *
 * Differences from the Next.js route, all deliberate:
 * - Signed events only. The original accepted any unauthenticated POST, so
 *   anyone could insert replies and flip leads to "replied". Resend signs
 *   webhooks with the Standard Webhooks scheme; this verifies the signature
 *   against RESEND_WEBHOOK_SECRET and refuses everything when it is unset.
 * - Resend's current payload. Inbound mail arrives as an `email.received`
 *   event whose data carries metadata only (email_id, from, subject,
 *   message_id, …). The body and headers are fetched from
 *   GET https://api.resend.com/emails/receiving/{email_id} with
 *   RESEND_API_KEY. The original expected an older flat shape
 *   ({from, subject, text, html, messageId}) that Resend no longer posts.
 * - Supabase instead of `@/db`. The edge router talks to Postgres through
 *   the Supabase service-role client like worker-app/lead-routes.ts; `@/db`
 *   is a postgres-js singleton keyed on DATABASE_URL for the Node runtime.
 *   Because of that, repliesReceived is incremented read-then-write rather
 *   than with SQL COALESCE(...)+1; a lost increment on two simultaneous
 *   replies from one lead is acceptable for a counter shown on a dashboard.
 * - Proposal matching is re-implemented from src/lib/proposal-matcher.ts
 *   (same strategies and confidences), which imports `@/db` directly.
 */
import type { Context, Hono } from "hono";
import { createHmac, timingSafeEqual } from "node:crypto";
import {
  classifyReplyEmail,
  inboundReplyAction,
  isProbablyLegitimateReply,
  resolveReplyClassifierBackend,
  type WorkersAIBinding,
} from "../src/lib/sentiment-classifier";

export type ResendInboundEnv = {
  RESEND_WEBHOOK_SECRET?: string;
  RESEND_API_KEY?: string;
  OPENAI_API_KEY?: string;
  /** Workers AI binding ([ai] in wrangler.toml): the free classifier. */
  AI?: WorkersAIBinding;
  NEXT_PUBLIC_SUPABASE_URL?: string;
  SUPABASE_URL?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
};

type InboundContext = Context<{ Bindings: ResendInboundEnv }>;

/** Standard Webhooks default: reject events signed more than 5 minutes off. */
export const SIGNATURE_TOLERANCE_SECONDS = 5 * 60;

function envValue(
  c: InboundContext,
  name: Exclude<keyof ResendInboundEnv, "AI">
): string | undefined {
  return c.env?.[name] || process.env[name] || undefined;
}

/**
 * Verify a Standard Webhooks signature (the scheme Resend signs with).
 * Signed content is `${id}.${timestamp}.${rawBody}`, HMAC-SHA256 keyed with
 * the base64 secret after its `whsec_` prefix. The header holds one or more
 * space-separated `v1,<base64>` entries; any match passes.
 */
export function verifyWebhookSignature(
  secret: string,
  headers: { id?: string; timestamp?: string; signature?: string },
  rawBody: string,
  nowSeconds = Math.floor(Date.now() / 1000)
): boolean {
  const { id, timestamp, signature } = headers;
  if (!id || !timestamp || !signature) return false;

  const ts = Number(timestamp);
  if (
    !Number.isFinite(ts) ||
    Math.abs(nowSeconds - ts) > SIGNATURE_TOLERANCE_SECONDS
  ) {
    return false;
  }

  const key = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = createHmac("sha256", key)
    .update(`${id}.${timestamp}.${rawBody}`)
    .digest();

  return signature.split(" ").some(entry => {
    const [version, value] = entry.split(",", 2);
    if (version !== "v1" || !value) return false;
    const provided = Buffer.from(value, "base64");
    return (
      provided.length === expected.length && timingSafeEqual(provided, expected)
    );
  });
}

function header(c: InboundContext, name: string): string | undefined {
  // Resend documents svix-* names; the Standard Webhooks spec uses webhook-*.
  return c.req.header(`webhook-${name}`) ?? c.req.header(`svix-${name}`);
}

function parseEmailAddress(value: string): string {
  const match = value.match(/<([^>]{1,256})>/);
  return (match ? match[1] : value).toLowerCase().trim();
}

function extractSenderName(value: string): string | null {
  const match = value.match(/^([^<]+)</);
  return match?.[1]?.trim() || null;
}

function headerValue(
  headers: Record<string, string> | null | undefined,
  name: string
) {
  if (!headers) return undefined;
  const key = Object.keys(headers).find(k => k.toLowerCase() === name);
  return key ? headers[key] : undefined;
}

type ReceivedEmail = {
  id: string;
  from: string;
  subject: string;
  html: string | null;
  text: string | null;
  headers: Record<string, string> | null;
  message_id: string;
  reply_to: string[] | null;
};

async function fetchReceivedEmail(
  apiKey: string,
  emailId: string
): Promise<ReceivedEmail> {
  const res = await fetch(
    `https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`,
    { headers: { Authorization: `Bearer ${apiKey}` } }
  );
  if (!res.ok) throw new Error(`Resend receiving API ${res.status}`);
  return (await res.json()) as ReceivedEmail;
}

type Admin = Awaited<ReturnType<typeof supabaseAdmin>> & object;

async function supabaseAdmin(c: InboundContext) {
  const url =
    envValue(c, "SUPABASE_URL") || envValue(c, "NEXT_PUBLIC_SUPABASE_URL");
  const key = envValue(c, "SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  const { createClient } = await import("@supabase/supabase-js");
  return createClient(url, key);
}

type MatchResult = {
  proposalId: string | null;
  leadId: number | null;
  confidence: number;
  method: "exact_email" | "subject_match" | "no_match";
  reason: string;
};

/** Same strategies and confidences as src/lib/proposal-matcher.ts. */
export async function matchReplyToProposal(
  admin: Admin,
  senderEmail: string,
  subject: string
): Promise<MatchResult> {
  const { data: lead } = await admin
    .from("leads")
    .select("id")
    .eq("email", senderEmail)
    .limit(1)
    .maybeSingle();
  if (lead) {
    const { data: proposal } = await admin
      .from("proposals")
      .select("id")
      .eq("lead_email", senderEmail)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (proposal) {
      return {
        proposalId: proposal.id,
        leadId: lead.id,
        confidence: 1.0,
        method: "exact_email",
        reason: "Perfect match on sender email",
      };
    }
  }

  const company = subject.match(
    /^(?:RE|FW):\s*Proposal[^:]*?(?:for|to)\s+([A-Za-z0-9\s&.,\-]{1,100})/i
  );
  if (company?.[1]) {
    return {
      proposalId: null,
      leadId: null,
      confidence: 0.6,
      method: "subject_match",
      reason: `Found company name "${company[1].trim()}" in subject, but could not verify proposal`,
    };
  }
  const id = subject.match(/Proposal[-_]?([a-f0-9-]{36})/i);
  if (id?.[1]) {
    return {
      proposalId: id[1],
      leadId: null,
      confidence: 0.7,
      method: "subject_match",
      reason: "Found proposal ID in subject line",
    };
  }

  return {
    proposalId: null,
    leadId: null,
    confidence: 0,
    method: "no_match",
    reason: "Could not match email to any proposal",
  };
}

function classifierEnv(c: InboundContext) {
  const openai = envValue(c, "OPENAI_API_KEY");
  // The classifier and the AI SDK read OPENAI_API_KEY from process.env.
  if (openai) process.env.OPENAI_API_KEY = openai;
  return process.env;
}

async function handleProbe(c: InboundContext) {
  return c.json({
    ok: true,
    signatureRequired: true,
    webhookSecretConfigured: Boolean(envValue(c, "RESEND_WEBHOOK_SECRET")),
    classifier: resolveReplyClassifierBackend(classifierEnv(c), c.env?.AI),
    sideEffects: {
      hubspotWrite: false,
      draftReply: false,
      persistInboundReply: true,
      nurtureCron: "/api/cron/nurture-replies",
      dashboard: "/dashboard/inbound-replies",
    },
  });
}

async function handleInbound(c: InboundContext) {
  const secret = envValue(c, "RESEND_WEBHOOK_SECRET");
  if (!secret)
    return c.json({ error: "RESEND_WEBHOOK_SECRET not configured" }, 503);

  const rawBody = await c.req.text();
  const verified = verifyWebhookSignature(
    secret,
    {
      id: header(c, "id"),
      timestamp: header(c, "timestamp"),
      signature: header(c, "signature"),
    },
    rawBody
  );
  if (!verified) return c.json({ error: "Invalid signature" }, 401);

  let event: { type?: string; data?: { email_id?: string } };
  try {
    event = JSON.parse(rawBody);
  } catch {
    return c.json({ error: "Invalid JSON" }, 400);
  }
  // Acknowledge other event types so Resend doesn't retry them.
  if (event.type !== "email.received") {
    return c.json({
      skipped: true,
      reason: `Ignored event type ${event.type ?? "unknown"}`,
    });
  }
  const emailId = event.data?.email_id;
  if (!emailId) return c.json({ error: "Missing data.email_id" }, 400);

  const apiKey = envValue(c, "RESEND_API_KEY");
  if (!apiKey) return c.json({ error: "RESEND_API_KEY not configured" }, 503);
  const admin = await supabaseAdmin(c);
  if (!admin) return c.json({ error: "Supabase not configured" }, 503);

  try {
    const email = await fetchReceivedEmail(apiKey, emailId);
    const subject = email.subject ?? "";
    const senderEmail = parseEmailAddress(email.from ?? "");
    const senderName = extractSenderName(email.from ?? "");
    const body = email.text || email.html || "";
    const messageId = email.message_id || email.id;

    if (!senderEmail || !subject) {
      return c.json({ skipped: true, reason: "Missing sender or subject" });
    }
    if (!isProbablyLegitimateReply(subject, body)) {
      return c.json({ skipped: true, reason: "Auto-reply or bounce detected" });
    }

    const { data: existing } = await admin
      .from("inbound_replies")
      .select("id")
      .eq("message_id", messageId)
      .limit(1)
      .maybeSingle();
    if (existing)
      return c.json({ skipped: true, reason: "Duplicate message ID" });

    const match = await matchReplyToProposal(admin, senderEmail, subject);
    const env = classifierEnv(c);
    const workersAI = c.env?.AI;
    const backend = resolveReplyClassifierBackend(env, workersAI);
    const sentiment = await classifyReplyEmail(body, subject, {
      env,
      workersAI,
    });

    let leadId = match.leadId;
    if (!leadId) {
      const { data: lead } = await admin
        .from("leads")
        .select("id")
        .eq("email", senderEmail)
        .limit(1)
        .maybeSingle();
      leadId = lead?.id ?? null;
    }

    const { data: reply, error: insertError } = await admin
      .from("inbound_replies")
      .insert({
        lead_id: leadId,
        lead_email: senderEmail,
        sender_name: senderName,
        subject,
        body_plaintext: email.text,
        body_html: email.html,
        message_id: messageId,
        sentiment: sentiment.sentiment,
        objection_type: sentiment.objectionType ?? null,
        objection_details: sentiment.objectionDetails ?? null,
        confidence: sentiment.confidence,
        proposal_match_id: match.proposalId,
        match_confidence: match.confidence,
        status: "new",
        metadata: {
          matchMethod: match.method,
          matchReason: match.reason,
          sentimentReasoning: sentiment.reasoning,
          classifierProvider: sentiment.provider,
          classifierMissingSecret: backend.missingSecret ?? null,
          classifierFallbackReason: sentiment.fallbackReason ?? null,
          originalHeaders: email.headers ?? {},
          inReplyTo: headerValue(email.headers, "in-reply-to") ?? null,
          replyTo: email.reply_to,
          resendEmailId: email.id,
        },
      })
      .select("id")
      .single();
    if (insertError || !reply) {
      throw new Error(insertError?.message ?? "Failed to insert inbound reply");
    }

    if (leadId) {
      const { data: lead } = await admin
        .from("leads")
        .select("repliesReceived")
        .eq("id", leadId)
        .maybeSingle();
      const now = new Date().toISOString();
      await admin
        .from("leads")
        .update({
          emailReplied: true,
          sentiment: sentiment.sentiment,
          lastReplyAt: now,
          objectionType: sentiment.objectionType ?? null,
          repliesReceived: (lead?.repliesReceived ?? 0) + 1,
          lastContactedAt: now,
          updatedAt: now,
        })
        .eq("id", leadId);
    }

    console.log("[resend-inbound] processed reply", {
      senderDomain: senderEmail.split("@")[1],
      sentiment: sentiment.sentiment,
    });

    return c.json(
      {
        success: true,
        replyId: reply.id,
        sentiment: sentiment.sentiment,
        matchConfidence: match.confidence,
        leadId,
        action: inboundReplyAction(sentiment.sentiment, leadId),
        classifier: {
          provider: sentiment.provider,
          workersAiAvailable: backend.workersAiAvailable,
          missingSecret: backend.missingSecret ?? null,
          paidLlmAvailable: backend.paidLlmAvailable,
          fallbackReason: sentiment.fallbackReason ?? null,
        },
      },
      201
    );
  } catch (err) {
    console.error(
      "[resend-inbound] error:",
      err instanceof Error ? err.message : err
    );
    // 500 lets Resend retry; the message_id dedupe makes a retry safe.
    return c.json({ error: "Internal server error" }, 500);
  }
}

export function registerResendInbound(app: Hono<any>) {
  app.get("/api/webhooks/resend-inbound", c => handleProbe(c));
  app.post("/api/webhooks/resend-inbound", c => handleInbound(c));
}
