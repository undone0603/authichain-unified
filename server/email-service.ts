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
  };
}

