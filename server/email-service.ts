import { ENV } from "./_core/env";

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

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const to = input.to.trim().toLowerCase();
  if (isSuppressed(to)) {
    return { status: "suppressed", reason: "suppression_list" };
  }

  const fromEmail = ENV.gmailFromEmail || process.env.GMAIL_FROM_EMAIL || "";
  const fromName = input.fromName || "AuthiChain";

  // ── Try Resend first (if API key is configured) ─────────────────────────
  // Resend uses its own RESEND_FROM_EMAIL when set, otherwise falls back to
  // the same fromEmail used by Gmail/SendGrid. The address's domain must be
  // verified in the Resend dashboard.
  if (ENV.resendApiKey) {
    const resendFrom = process.env.RESEND_FROM_EMAIL || fromEmail || "outreach@authichain.com";
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ENV.resendApiKey}`,
      },
      body: JSON.stringify({
        from: `${fromName} <${resendFrom}>`,
        to: [to],
        subject: input.subject,
        text: input.body,
      }),
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({} as any));
      return {
        status: "sent",
        provider: "resend",
        providerMessageId: data?.id,
      };
    }

    const errTxt = await res.text().catch(() => "");
    console.warn("[email] Resend failed, falling back:", res.status, errTxt.slice(0, 200));
  }

  // ── Try Gmail next (if OAuth tokens are configured) ──────────────────────
  const gmailConfigured = !!(
    fromEmail &&
    (process.env.GMAIL_ACCESS_TOKEN || ENV.gmailClientId)
  );
  if (gmailConfigured) {
    const gmailAccessToken = await getGmailAccessToken();
    if (gmailAccessToken) {
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

      if (response.ok) {
        const data = await response.json().catch(() => ({} as any));
        return {
          status: "sent",
          provider: "gmail",
          providerMessageId: data?.id,
          threadId: data?.threadId,
        };
      }
      console.warn("[email] Gmail send failed, falling back to SendGrid");
    }
  }

  // ── Fallback: SendGrid ────────────────────────────────────────────────────
  if (ENV.sendgridApiKey) {
    const senderEmail = fromEmail || "outreach@authichain.com";
    const sgRes = await fetch("https://api.sendgrid.com/v3/mail/send", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ENV.sendgridApiKey}`,
      },
      body: JSON.stringify({
        personalizations: [{ to: [{ email: to }] }],
        from: { email: senderEmail, name: fromName },
        subject: input.subject,
        content: [{ type: "text/plain", value: input.body }],
      }),
    });

    if (sgRes.ok || sgRes.status === 202) {
      const msgId = sgRes.headers.get("X-Message-Id") ?? undefined;
      return { status: "sent", provider: "sendgrid", providerMessageId: msgId };
    }

    const errTxt = await sgRes.text().catch(() => "");
    console.error("[email] SendGrid failed:", sgRes.status, errTxt.slice(0, 200));
    return { status: "skipped", provider: "sendgrid", reason: `sendgrid_failed:${sgRes.status}` };
  }

  const attempted = [
    ENV.resendApiKey ? "resend" : null,
    gmailConfigured ? "gmail" : null,
    ENV.sendgridApiKey ? "sendgrid" : null,
  ].filter(Boolean);
  const reason = attempted.length ? `all_providers_failed:${attempted.join(",")}` : "no_email_provider_configured";
  console.error("[email] All providers exhausted:", reason);
  return { status: "skipped", reason };
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

