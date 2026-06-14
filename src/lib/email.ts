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
}
