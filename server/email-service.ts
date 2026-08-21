import { ENV } from "./_core/env";
import nodemailer from "nodemailer";

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
  status: "sent" | "suppressed" | "skipped" | "dry_run";
  providerMessageId?: string;
  threadId?: string;
  provider?: string;
  reason?: string;
};

// ─── Dry run ─────────────────────────────────────────────────────────────────
//
// Arming this makes sendEmail() record what it was asked to send and return
// without contacting a provider.
//
// It lives here, at the single point every outbound email passes through,
// rather than as a flag threaded from runPipelineTick() down through each job.
// Threading it would mean every current send site *and every one added later*
// has to remember to honour it, and the failure mode of forgetting is sending
// real mail during something a person was told is a dry run. At this boundary
// the guarantee holds by construction: a new caller cannot opt out of it,
// because it does not know it exists.
//
// Deliberately module-scope rather than an argument, for the same reason.
// Deliberately not driven by an environment variable either — a dry run is a
// decision made by one caller for the length of one call, not deployment
// configuration that could linger and silently suppress real mail.

type RecordedSend = SendEmailInput & { at: string };

let dryRunLog: RecordedSend[] | null = null;

/** True while sends are being recorded instead of dispatched. */
export function isDryRun() {
  return dryRunLog !== null;
}

/**
 * Records an outbound message and reports whether a dry run is active.
 *
 * For send paths that do not go through sendEmail(). There is one that
 * matters: guardedSend() in server/outreach/send-guard.ts posts to the Resend
 * API directly, because it layers on CAN-SPAM footers, one-click unsubscribe
 * headers and a per-domain API key. It is also the cold-email path — the exact
 * thing a dry run is run to inspect — so leaving it uncovered made the dry run
 * wrong in the case it exists for.
 *
 * Any future transport must call this before it dispatches. That is a weaker
 * guarantee than sendEmail() gets, where the interception is unavoidable, so
 * prefer routing new senders through sendEmail() rather than adding a third
 * caller here.
 */
export function recordDryRunSend(input: SendEmailInput): boolean {
  if (dryRunLog === null) return false;
  dryRunLog.push({ ...input, to: input.to.trim().toLowerCase(), at: new Date().toISOString() });
  return true;
}

/**
 * Runs `fn` with every sendEmail() call recorded instead of dispatched, and
 * returns both the function's result and what it tried to send.
 *
 * Restores the previous state in a finally block, so a throw inside `fn`
 * cannot leave sends suppressed for the rest of the process.
 */
export async function withDryRunEmail<T>(
  fn: () => Promise<T>,
): Promise<{ result: T; sends: RecordedSend[] }> {
  const previous = dryRunLog;
  const log: RecordedSend[] = [];
  dryRunLog = log;
  try {
    const result = await fn();
    return { result, sends: log };
  } finally {
    dryRunLog = previous;
  }
}

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

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const to = input.to.trim().toLowerCase();
  if (isSuppressed(to)) {
    return { status: "suppressed", reason: "suppression_list" };
  }

  // After the suppression check, deliberately: a dry run should report what
  // would really happen, and a suppressed address really would be suppressed.
  // Intercepting first would hide that and overstate what a live run sends.
  if (dryRunLog !== null) {
    dryRunLog.push({ ...input, to, at: new Date().toISOString() });
    return { status: "dry_run", reason: "recorded, not sent" };
  }

  const fromEmail = ENV.gmailFromEmail || process.env.GMAIL_FROM_EMAIL || "";
  const appPassword = ENV.gmailAppPassword || process.env.GMAIL_APP_PASSWORD || "";
  const fromName = input.fromName || "AuthiChain";

  // ─── Method 0: Resend (preferred transactional email SaaS) ─────────────────
  const resendApiKey = ENV.resendApiKey || process.env.RESEND_API_KEY || "";
  if (resendApiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: `${fromName} <${ENV.resendFromEmail}>`,
          to,
          subject: input.subject,
          text: input.body,
        }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({} as any));
        return { status: "sent", provider: "resend", providerMessageId: data?.id };
      }
      const errText = await res.text().catch(() => "");
      console.warn(`[email-service] Resend failed (${res.status}): ${errText.slice(0, 200)}`);
    } catch (resendErr: any) {
      console.warn("[email-service] Resend error, falling back:", resendErr.message);
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

