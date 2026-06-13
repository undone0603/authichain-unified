import type nodemailerType from "nodemailer";
import type { Transporter } from "nodemailer";

async function getNodemailer() {
  return (await import("nodemailer")) as typeof nodemailerType & { default: typeof nodemailerType };
}

export interface EmailOptions {
  to: string | string[];
  subject: string;
  html?: string;
  text?: string;
  from?: string;
  replyTo?: string;
  attachments?: Array<{ filename: string; content: string | Buffer; contentType?: string }>;
}

function getFrom(): string {
  const name = process.env.SMTP_FROM_NAME || "AuthiChain";
  const email = process.env.SMTP_FROM || "noreply@authichain.com";
  return `"${name}" <${email}>`;
}

async function createTransporter() {
  const nodemailer = await getNodemailer();
  const nm = nodemailer.default ?? nodemailer;
  const host = process.env.SMTP_HOST || "smtp.gmail.com";
  const parsedPort = parseInt(process.env.SMTP_PORT || "587", 10);
  const port = Number.isFinite(parsedPort) ? parsedPort : 587;
  const secure = process.env.SMTP_SECURE === "true";
  return nm.createTransport({
    host,
    port,
    secure,
    auth: {
      user: process.env.SMTP_USER || "",
      pass: process.env.SMTP_PASS || "",
    },
  });
}

export async function sendEmail(options: EmailOptions): Promise<void> {
  const transporter = await createTransporter();
  await transporter.sendMail({
    from: options.from || getFrom(),
    to: Array.isArray(options.to) ? options.to.join(", ") : options.to,
    subject: options.subject,
    html: options.html,
    text: options.text,
    replyTo: options.replyTo,
    attachments: options.attachments,
  });
}

export async function sendBulkEmails(emails: EmailOptions[]): Promise<{ sent: number; failed: number }> {
  let sent = 0;
  let failed = 0;
  const transporter = await createTransporter();
  for (const email of emails) {
    try {
      await transporter.sendMail({
        from: email.from || getFrom(),
        to: Array.isArray(email.to) ? email.to.join(", ") : email.to,
        subject: email.subject,
        html: email.html,
        text: email.text,
      });
      sent++;
    } catch (err) {
      console.error("[SMTP] Failed to send email to", email.to, err);
      failed++;
    }
  }
  return { sent, failed };
}

export function replaceTemplateVariables(template: string, vars: Record<string, string>): string {
  return Object.entries(vars).reduce(
    (result, [key, value]) => result.replace(
      new RegExp(`\\{\\{${key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\}\\}`, "g"),
      () => value,
    ),
    template
  );
}

export function textToHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/\n\n/g, "</p><p>")
    .replace(/\n/g, "<br>")
    .replace(/^(.+)$/, "<p>$1</p>");
}

export async function sendSequenceEmail(
  to: string,
  sequence: Array<{ subject: string; html: string; delayMs?: number }>
): Promise<void> {
  for (const step of sequence) {
    if (step.delayMs) await new Promise(r => setTimeout(r, step.delayMs));
    await sendEmail({ to, subject: step.subject, html: step.html });
  }
}

export async function verifySMTPConfig(): Promise<boolean> {
  try {
    const transporter = await createTransporter();
    await transporter.verify();
    return true;
  } catch {
    return false;
  }
}
