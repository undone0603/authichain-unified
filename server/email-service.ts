import { ENV } from "./_core/env";

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

  const gmailAccessToken = process.env.GMAIL_ACCESS_TOKEN || "";
  const fromEmail = process.env.GMAIL_FROM_EMAIL || "";
  if (!gmailAccessToken || !fromEmail) {
    return {
      status: "skipped",
      reason: "gmail_not_configured",
      provider: "gmail",
    };
  }

  const fromName = input.fromName || "AuthiChain";
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
    provider: "gmail",
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
  const gmailAccessToken = process.env.GMAIL_ACCESS_TOKEN || "";
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

