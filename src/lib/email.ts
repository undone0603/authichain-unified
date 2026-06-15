<<<<<<< HEAD
import type nodemailerType from 'nodemailer';

export interface SendEmailInput {
  to: string;
  subject: string;
  from?: string;
  text?: string;
  html?: string;
  replyTo?: string;
}

export interface SendEmailResult {
  ok: boolean;
  provider: string;
  error?: string;
}

async function loadNodemailer() {
  const nm = (await import('nodemailer')) as typeof nodemailerType & {
    default?: typeof nodemailerType;
  };
  return nm.default ?? nm;
}

function defaultFrom(): string {
  const name = process.env.SMTP_FROM_NAME || 'AuthiChain';
  const email = process.env.SMTP_FROM || 'noreply@authichain.com';
  return `"${name}" <${email}>`;
}

/**
 * Send a single transactional email through SMTP. Returns a result object
 * rather than throwing — callers (e.g. autonomous workflows) record
 * provider/error state in their own logs.
 */
export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const host = process.env.SMTP_HOST;
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;
  if (!host || !user || !pass) {
    return { ok: false, provider: 'smtp', error: 'SMTP credentials not configured' };
  }

  const parsedPort = parseInt(process.env.SMTP_PORT || '587', 10);
  const port = Number.isFinite(parsedPort) ? parsedPort : 587;
  const secure = process.env.SMTP_SECURE === 'true';

  try {
    const nodemailer = await loadNodemailer();
    const transporter = nodemailer.createTransport({
      host,
      port,
      secure,
      auth: { user, pass },
    });
    await transporter.sendMail({
      from: input.from || defaultFrom(),
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      replyTo: input.replyTo,
    });
    return { ok: true, provider: 'smtp' };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { ok: false, provider: 'smtp', error: message };
  }
=======
import nodemailer from 'nodemailer';

type SendArgs = {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
};

type SendResult = {
  ok: boolean;
  provider: 'gmail' | 'resend' | 'brevo' | 'sendgrid' | 'none';
  status?: number;
  error?: string;
};

function parseFrom(from: string): { email: string; name?: string } {
  const m = from.match(/^(.*)<(.+)>\s*$/);
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  return { email: from.trim() };
}

async function viaGmail(args: SendArgs, key: string): Promise<SendResult> {
  const user = process.env.GMAIL_USER;
  if (!user) return { ok: false, provider: 'gmail', error: 'GMAIL_USER not set' };
  try {
    const transporter = nodemailer.createTransport({
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user, pass: key.replace(/\s+/g, '') },
    });
    const info = await transporter.sendMail({
      from: args.from,
      to: args.to,
      subject: args.subject,
      text: args.text,
      html: args.html,
    });
    return { ok: !!info.messageId, provider: 'gmail' };
  } catch (e) {
    return { ok: false, provider: 'gmail', error: e instanceof Error ? e.message : String(e) };
  }
}

async function viaResend(args: SendArgs, key: string): Promise<SendResult> {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(args),
  });
  return { ok: res.ok, provider: 'resend', status: res.status, error: res.ok ? undefined : await res.text() };
}

async function viaBrevo(args: SendArgs, key: string): Promise<SendResult> {
  const sender = parseFrom(args.from);
  const res = await fetch('https://api.brevo.com/v3/smtp/email', {
    method: 'POST',
    headers: { 'api-key': key, 'Content-Type': 'application/json', accept: 'application/json' },
    body: JSON.stringify({
      sender,
      to: [{ email: args.to }],
      subject: args.subject,
      textContent: args.text,
      htmlContent: args.html,
    }),
  });
  return { ok: res.ok, provider: 'brevo', status: res.status, error: res.ok ? undefined : await res.text() };
}

async function viaSendGrid(args: SendArgs, key: string): Promise<SendResult> {
  const sender = parseFrom(args.from);
  const res = await fetch('https://api.sendgrid.com/v3/mail/send', {
    method: 'POST',
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: args.to }] }],
      from: sender,
      subject: args.subject,
      content: [
        ...(args.text ? [{ type: 'text/plain', value: args.text }] : []),
        ...(args.html ? [{ type: 'text/html', value: args.html }] : []),
      ],
    }),
  });
  return { ok: res.ok, provider: 'sendgrid', status: res.status, error: res.ok ? undefined : await res.text() };
}

/**
 * Send an email through whichever transactional provider is configured.
 * Tries Resend → Brevo → SendGrid; returns the first ok=true, otherwise
 * the last attempt's failure. Skips providers whose env var is unset.
 */
export async function sendEmail(args: SendArgs): Promise<SendResult> {
  const providers: Array<[string | undefined, (a: SendArgs, k: string) => Promise<SendResult>]> = [
    [process.env.RESEND_API_KEY, viaResend],
    [process.env.BREVO_API_KEY, viaBrevo],
    [process.env.SENDGRID_API_KEY, viaSendGrid],
    [process.env.GMAIL_APP_PASSWORD, viaGmail],
  ];

  let last: SendResult = { ok: false, provider: 'none', error: 'no provider configured' };
  for (const [key, fn] of providers) {
    if (!key) continue;
    last = await fn(args, key);
    if (last.ok) return last;
  }
  return last;
>>>>>>> origin/add-agentz-editable
}
