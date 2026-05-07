type SendArgs = {
  to: string;
  from: string;
  subject: string;
  text?: string;
  html?: string;
};

type SendResult = {
  ok: boolean;
  provider: 'resend' | 'brevo' | 'sendgrid' | 'none';
  status?: number;
  error?: string;
};

function parseFrom(from: string): { email: string; name?: string } {
  const m = from.match(/^(.*)<(.+)>\s*$/);
  if (m) return { name: m[1].trim(), email: m[2].trim() };
  return { email: from.trim() };
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
  ];

  let last: SendResult = { ok: false, provider: 'none', error: 'no provider configured' };
  for (const [key, fn] of providers) {
    if (!key) continue;
    last = await fn(args, key);
    if (last.ok) return last;
  }
  return last;
}
