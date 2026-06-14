import { ENV } from "./_core/env";
import nodemailer from "nodemailer";
import { getDb } from "./db";
import { activityLog } from "../drizzle/schema";
import { sql, and, gte, eq } from "drizzle-orm";

// ─── Gmail token cache (auto-refresh) ────────────────────────────────────────

let _cachedToken: string | null = null;
let _tokenExpiresAt = 0; // epoch ms

async function getGmailAccessToken(): Promise<string> {
  // If we have a cached token with >60s remaining, use it
  if (_cachedToken && Date.now() < _tokenExpiresAt - 60_000) {
    return _cachedToken;
  }

  // Prefer static env token (e.g. short-lived dev token set directly)
  const staticToken = process.env.GMAIL_ACCESS_TOKEN || "";
  if (staticToken && !ENV.gmailRefreshToken) {
    // Can't refresh — use as-is
    _cachedToken = staticToken;
    _tokenExpiresAt = Date.now() + 55 * 60 * 1000; // assume ~1h
    return staticToken;
  }

  if (!ENV.gmailClientId || !ENV.gmailClientSecret || !ENV.gmailRefreshToken) {
    return staticToken; // not configured — fall back silently
  }

  // Exchange refresh token for a new access token
  const res = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: ENV.gmailClientId,
      client_secret: ENV.gmailClientSecret,
      refresh_token: ENV.gmailRefreshToken,
      grant_type: "refresh_token",
    }).toString(),
  });

  if (!res.ok) {
    console.error("[gmail] token refresh failed:", res.status, await res.text().catch(() => ""));
    return staticToken; // fall back to static if refresh fails
  }

  const data = await res.json().catch(() => ({})) as any;
  _cachedToken = data.access_token ?? staticToken;
  // expires_in is in seconds; default 3600
  _tokenExpiresAt = Date.now() + ((data.expires_in ?? 3600) * 1000);
  return _cachedToken!;
}

// ─────────────────────────────────────────────────────────────────────────────

export type SendEmailInput = {
  to: string;
  subject: string;
  body: string;
  fromName?: string;
};

export type SendEmailResult = {
  status: "sent" | "suppressed" | "skipped";
  providerMessageId?: string;
  threadId?: string;
  provider?: string;
  reason?: string;
};

function suppressionSet() {
  return new Set(
    ENV.suppressionList
      .split(",")
      .map(x => x.trim().toLowerCase())
      .filter(Boolean),
  );
}

export function isSuppressed(email: string) {
  return suppressionSet().has(email.trim().toLowerCase());
}

function toBase64Url(input: string) {
  return Buffer.from(input)
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

/**
 * Rate-limit check — counts past `email_sent` rows in activity_log.
 * Returns null when allowed, or a "reason" string when over a cap. Disabled
 * if no DB is available (best-effort; do not let metering block delivery).
 */
async function checkSendCaps(to: string): Promise<string | null> {
  try {
    const db = await getDb();
    if (!db) return null;
    const now = Date.now();
    const dayCutoff = new Date(now - 24 * 60 * 60 * 1000);
    const hourCutoff = new Date(now - 60 * 60 * 1000);

    // Per-recipient/day
    const [perRecipient] = await db
      .select({ n: sql<number>`count(*)` })
      .from(activityLog)
      .where(and(
        eq(activityLog.action, "email_sent"),
        gte(activityLog.createdAt, dayCutoff),
        sql`${activityLog.details}->>'to' = ${to}`,
      ));
    const perRecipientCount = Number(perRecipient?.n ?? 0);
    if (perRecipientCount >= ENV.emailMaxPerRecipientDay) {
      return `per-recipient daily cap (${ENV.emailMaxPerRecipientDay}) reached`;
    }

    // Global/hour
    const [globalHour] = await db
      .select({ n: sql<number>`count(*)` })
      .from(activityLog)
      .where(and(
        eq(activityLog.action, "email_sent"),
        gte(activityLog.createdAt, hourCutoff),
      ));
    const globalHourCount = Number(globalHour?.n ?? 0);
    if (globalHourCount >= ENV.emailMaxPerHourGlobal) {
      return `global hourly cap (${ENV.emailMaxPerHourGlobal}) reached`;
    }
    return null;
  } catch (err) {
    console.warn("[email-service] rate-limit check failed (allowing send):", err);
    return null;
  }
}

async function recordSent(to: string, provider: string): Promise<void> {
  try {
    const db = await getDb();
    if (!db) return;
    await db.insert(activityLog).values({
      action: "email_sent",
      details: { to, provider, sentAt: new Date().toISOString() },
    });
  } catch (err) {
    console.warn("[email-service] failed to record send:", err);
  }
}

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const to = input.to.trim().toLowerCase();
  if (isSuppressed(to)) {
    return { status: "suppressed", reason: "suppression_list" };
  }
  const capReason = await checkSendCaps(to);
  if (capReason) {
    return { status: "skipped", reason: capReason };
  }

  const fromEmail = ENV.gmailFromEmail || process.env.GMAIL_FROM_EMAIL || "";
  const appPassword = ENV.gmailAppPassword || process.env.GMAIL_APP_PASSWORD || "";
  const fromName = input.fromName || "AuthiChain";

  // ─── Method 0: Resend (verified authichain.com domain, SPF+DKIM+DMARC) ─────
  // RESEND_API_KEY is the only mail credential present in Vercel production —
  // without this method, transactional email (purchase access emails, dunning
  // notices) silently no-ops in prod.
  const resendKey = process.env.RESEND_API_KEY || "";
  if (resendKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${resendKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${fromName} <noreply@authichain.com>`,
          to: [to],
          subject: input.subject,
          text: input.body,
        }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({} as any));
        await recordSent(to, "resend");
        return {
          status: "sent",
          provider: "resend",
          providerMessageId: data?.id,
        };
      }
      const txt = await res.text().catch(() => "");
      console.warn(`[email-service] Resend failed (${res.status}): ${txt.slice(0, 200)} — falling back to Gmail`);
    } catch (resendErr: any) {
      console.warn("[email-service] Resend errored, falling back to Gmail...", resendErr.message);
    }
  }

  // ─── Method 1: SMTP via App Password (Reliable Fallback) ───────────────────
  if (fromEmail && appPassword) {
    try {
      const transporter = nodemailer.createTransport({
        service: "gmail",
        auth: { user: fromEmail, pass: appPassword },
      });

      const info = await transporter.sendMail({
        from: `${fromName} <${fromEmail}>`,
        to,
        subject: input.subject,
        text: input.body,
      });

      await recordSent(to, "gmail-smtp");
      return {
        status: "sent",
        provider: "gmail-smtp",
        providerMessageId: info.messageId,
      };
    } catch (smtpErr: any) {
      console.warn("[email-service] SMTP failed, attempting OAuth2...", smtpErr.message);
    }
  }

  // ─── Method 2: OAuth2 (Primary/Legacy) ─────────────────────────────────────
  if (!fromEmail) {
    return { status: "skipped", reason: "gmail_not_configured", provider: "gmail" };
  }

  const gmailAccessToken = await getGmailAccessToken();
  if (!gmailAccessToken) {
    return { status: "skipped", reason: "gmail_token_unavailable", provider: "gmail" };
  }

  const mime = [
    `From: ${fromName} <${fromEmail}>`,
    `To: ${to}`,
    `Subject: ${input.subject}`,
    "MIME-Version: 1.0",
    "Content-Type: text/plain; charset=UTF-8",
    "",
    input.body,
  ].join("\r\n");

  const raw = toBase64Url(mime);
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/messages/send", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${gmailAccessToken}`,
    },
    body: JSON.stringify({ raw }),
  });

  if (!response.ok) {
    const txt = await response.text().catch(() => "");
    return {
      status: "skipped",
      provider: "gmail",
      reason: `gmail_send_failed:${response.status}:${txt.slice(0, 200)}`,
    };
  }

  const data = await response.json().catch(() => ({} as any));
  await recordSent(to, "gmail-oauth");
  return {
    status: "sent",
    provider: "gmail-oauth",
    providerMessageId: data?.id,
    threadId: data?.threadId,
  };
}

/** Check whether a Gmail thread has received a reply (any message NOT in SENT labels). */
export async function checkThreadReplies(threadId: string): Promise<{
  hasReply: boolean;
  replyText?: string;
  replyFrom?: string;
}> {
  const gmailAccessToken = await getGmailAccessToken();
  if (!gmailAccessToken || !threadId) return { hasReply: false };

  const res = await fetch(
    `https://gmail.googleapis.com/gmail/v1/users/me/threads/${threadId}?format=full`,
    { headers: { Authorization: `Bearer ${gmailAccessToken}` } },
  );
  if (!res.ok) return { hasReply: false };

  const thread = await res.json().catch(() => null) as any;
  const messages: any[] = thread?.messages ?? [];
  // First message is the one we sent (SENT label). Any subsequent message is a reply.
  const replies = messages.filter(m =>
    Array.isArray(m.labelIds) && m.labelIds.includes("INBOX"),
  );
  if (replies.length === 0) return { hasReply: false };

  const latest = replies[replies.length - 1];

  // Extract plain-text body (base64url encoded)
  function extractBody(payload: any): string {
    if (!payload) return "";
    if (payload.mimeType === "text/plain" && payload.body?.data) {
      return Buffer.from(payload.body.data, "base64").toString("utf-8");
    }
    for (const part of payload.parts ?? []) {
      const t = extractBody(part);
      if (t) return t;
    }
    return "";
  }

  const replyText = extractBody(latest.payload).slice(0, 1500);
  const fromHeader = (latest.payload?.headers as any[] ?? []).find((h: any) => h.name === "From");

  return { hasReply: true, replyText, replyFrom: fromHeader?.value };
}

