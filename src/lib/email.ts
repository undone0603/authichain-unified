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
  messageId?: string;
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
export async function sendEmail(
  args: SendArgs,
  options?: { onlyProvider?: "resend"; idempotencyKey?: string }
): Promise<SendResult> {
  // Transactional activation must not fall back across providers: a timeout
  // from one provider can mean acceptance, so trying another risks two emails.
  if (options?.onlyProvider === "resend") {
    const key = process.env.RESEND_API_KEY;
    if (!key) return { ok: false, provider: "resend", error: "RESEND_API_KEY not set" };
    const idem = options.idempotencyKey;
    // Resend supports an idempotency key for POST /emails. A stable Checkout
    // Session key prevents accidental duplicate accepts during transport retries.
    if (!idem || idem.length > 256) {
      return { ok: false, provider: "resend", error: "invalid idempotency key" };
    }
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        "Idempotency-Key": idem,
      },
      body: JSON.stringify(args),
    });
    if (!response.ok) {
      return { ok: false, provider: "resend", status: response.status, error: await response.text() };
    }
    // 2xx without a verifiable Resend email ID is an unknown outcome, not an
    // accepted delivery receipt. The outbox holds it for reconciliation.
    const payload: unknown = await response.json().catch(() => null);
    const id = payload && typeof payload === "object" && "id" in payload &&
      typeof payload.id === "string" ? payload.id : null;
    return {
      ok: Boolean(id),
      provider: "resend",
      status: response.status,
      ...(id ? { messageId: id } : { error: "provider email ID missing" }),
    };
  }
  const providers: Array<[string | undefined, (a: SendArgs, k: string) => Promise<SendResult>]> = [
    [process.env.GMAIL_APP_PASSWORD, viaGmail],
    [process.env.RESEND_API_KEY, viaResend],
    [process.env.BREVO_API_KEY, viaBrevo],
    [process.env.SENDGRID_API_KEY, viaSendGrid],
  ];

  let last: SendResult = { ok: false, provider: 'none', error: 'no provider configured' };
  for (const [key, fn] of providers) {
    if (!key) continue;
    last = await fn(args, key);
    if (last.ok) return last;
  }
  return last;
}
