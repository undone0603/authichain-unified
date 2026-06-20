import { createClient } from '@supabase/supabase-js';

export type AutomationStatus = 'success' | 'failure';
export type AutomationKind = 'cron' | 'webhook' | 'manual' | 'api' | 'event';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _client: ReturnType<typeof createClient<any>> | null = null;
function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  if (!_client) _client = createClient(url, key);
  return _client;
}

export function formatErr(err: unknown): string {
  if (err instanceof Error) return err.stack || err.message;
  if (typeof err === 'string') return err;
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/**
 * Persist a workflow execution record. Falls back to console logging when
 * Supabase credentials are not configured. Errors are swallowed so callers
 * never fail because of telemetry.
 */
export async function logAutomation(
  workflowName: string,
  kind: AutomationKind,
  status: AutomationStatus,
  data: unknown = null,
  errorMessage?: string,
): Promise<void> {
  const tag = `[automation:${status}]`;
  if (errorMessage) {
    console.warn(tag, workflowName, errorMessage, data);
  } else {
    console.log(tag, workflowName, data ?? '');
  }

  const client = getClient();
  if (!client) return;

  try {
    await client.from('automation_logs').insert({
      workflow_name: workflowName,
      kind,
      status,
      data,
      error_message: errorMessage ?? null,
    });
  } catch (err) {
    console.warn('[automation] failed to persist log:', err);
  }
}

/**
 * Lead-automation hook invoked by the /api/leads/capture route on every inbound
 * lead. Sends an instant welcome email and upserts a HubSpot contact so a
 * captured email is engaged immediately instead of going dark.
 */
export async function handleLeadAutomation(lead: {
  email: string;
  name?: string;
  source?: string;
}): Promise<void> {
  // Speed-to-lead: a captured email is worth nothing until it's engaged. This
  // used to be a no-op that only wrote a log row, so every inbound lead went
  // dark. Now it (1) sends an instant branded welcome email with a CTA and
  // (2) upserts a HubSpot contact when configured. Both are best-effort and
  // never throw — the capture endpoint must always return ok to the visitor.
  const results: Record<string, string> = {};
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'https://qron.space').replace(/\/+$/, '');
  const first = (lead.name || '').trim().split(/\s+/)[0] || '';
  const greeting = first ? `Hi ${first},` : 'Hi there,';

  // 1) Instant welcome email
  try {
    const { sendEmail } = await import('./email');
    const r = await sendEmail({
      to: lead.email,
      from: process.env.SENDGRID_FROM_EMAIL || 'QRON <noreply@authichain.com>',
      subject: 'Your QRON access is ready',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#0a0a0a;color:#ededed;padding:40px 32px;border-radius:16px;border:1px solid rgba(201,162,39,0.2);">
          <div style="text-align:center;margin-bottom:24px;">
            <span style="color:#c9a227;font-size:30px;font-weight:900;letter-spacing:-1px;">QRON</span>
            <p style="color:#6b6b6b;font-size:12px;margin:4px 0 0;">by AuthiChain Protocol</p>
          </div>
          <h1 style="color:#ffffff;font-size:24px;margin-bottom:8px;">${greeting}</h1>
          <p style="color:#9e9e9e;line-height:1.6;margin-bottom:20px;">
            Thanks for your interest in QRON — cryptographically verified, Ed25519-signed
            QR art with a ~100% scan rate. Your first generations are free, no card required.
          </p>
          <div style="text-align:center;margin:28px 0;">
            <a href="${appUrl}/?utm_source=lead_welcome" style="background:linear-gradient(135deg,#c9a227,#a07c10);color:#000;padding:14px 32px;border-radius:10px;text-decoration:none;font-weight:800;font-size:15px;display:inline-block;">
              Start Free
            </a>
          </div>
          <p style="color:#6b6b6b;font-size:13px;text-align:center;margin-bottom:24px;">
            Need volume or team features? <a href="${appUrl}/pricing" style="color:#c9a227;text-decoration:none;">See pricing</a>.
          </p>
          <hr style="border:none;border-top:1px solid rgba(201,162,39,0.15);margin:24px 0;" />
          <p style="color:#3a3a3a;font-size:11px;text-align:center;">
            <a href="https://qron.space" style="color:#c9a227;text-decoration:none;">qron.space</a> ·
            <a href="https://authichain.com" style="color:#c9a227;text-decoration:none;">authichain.com</a>
          </p>
        </div>`,
      text: `${greeting}\n\nThanks for your interest in QRON — cryptographically verified, Ed25519-signed QR art with a ~100% scan rate. Your first generations are free, no card required.\n\nStart free: ${appUrl}/\nPricing: ${appUrl}/pricing\n\n— The QRON team`,
    });
    results.email = r.ok ? `sent:${r.provider}` : `failed:${r.error ?? r.provider}`;
  } catch (err) {
    results.email = `error:${formatErr(err)}`;
  }

  // 2) HubSpot contact upsert (only when configured)
  const hsToken = process.env.HUBSPOT_ACCESS_TOKEN;
  if (hsToken) {
    try {
      const resp = await fetch('https://api.hubapi.com/crm/v3/objects/contacts', {
        method: 'POST',
        headers: { Authorization: `Bearer ${hsToken}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          properties: {
            email: lead.email,
            ...(first ? { firstname: first } : {}),
            lead_source: lead.source || 'website',
            lifecyclestage: 'lead',
          },
        }),
      });
      // 409 = contact already exists, which is a success for our purposes.
      results.hubspot = resp.ok ? 'created' : resp.status === 409 ? 'exists' : `http_${resp.status}`;
    } catch (err) {
      results.hubspot = `error:${formatErr(err)}`;
    }
  } else {
    results.hubspot = 'skipped:no_token';
  }

  const failed = Object.values(results).some(
    (v) => v.startsWith('error') || v.startsWith('failed') || v.startsWith('http_'),
  );
  await logAutomation('lead_automation', 'event', failed ? 'failure' : 'success', { ...lead, results });
}

/**
 * Daily-maintenance marker invoked by the /api/automation/cron edge route.
 * The substantive maintenance jobs run via the server scheduler
 * (server/scheduled-jobs.ts); this records that the edge cron fired.
 */
export async function runDailyMaintenance(): Promise<void> {
  await logAutomation('daily_maintenance', 'cron', 'success');
}
