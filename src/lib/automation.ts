import { createClient } from '@supabase/supabase-js';
import { enrichLead } from './industrial/enrichment';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const admin = createClient(supabaseUrl, serviceKey);

/**
 * Capture an arbitrary thrown value as a useful string. Handles JS Errors,
 * Supabase-style `{message, code, details, hint}` objects, and anything else.
 */
export function formatErr(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (err && typeof err === 'object') {
    const obj = err as Record<string, unknown>;
    if (typeof obj.message === 'string') {
      const code = typeof obj.code === 'string' ? ` [${obj.code}]` : '';
      const details = typeof obj.details === 'string' && obj.details ? ` — ${obj.details}` : '';
      return `${obj.message}${code}${details}`;
    }
    try { return JSON.stringify(err); } catch { return String(err); }
  }
  return String(err);
}

/**
 * Log an automation event for tracking and debugging.
 */
export async function logAutomation(
  workflowName: string,
  triggerType: 'event' | 'cron' | 'manual',
  status: 'success' | 'failure',
  payload?: unknown,
  errorMessage?: string
) {
  try {
    await admin.from('automation_logs').insert({
      workflow_name: workflowName,
      trigger_type: triggerType,
      status,
      payload: payload ? JSON.stringify(payload) : null,
      error_message: errorMessage || null,
    });
  } catch (err) {
    console.error('[automation] Logging failed:', err);
  }
}

/**
 * Captured lead automation: Sync to CRM, trigger email sequence.
 */
export async function handleLeadAutomation(lead: {
  email: string;
  name?: string;
  source?: string;
}) {
  const workflowName = 'lead_captured';
  try {
    // 1. Enrich Lead with Professional Data
    const enriched = await enrichLead(lead.email);
    const finalLead = { ...lead, ...enriched };

    // 2. Sync Enriched Data to HubSpot / Make.com
    const makeWebhook = process.env.MAKE_LEAD_WEBHOOK_URL;
    if (makeWebhook) {
      await fetch(makeWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...finalLead, timestamp: new Date().toISOString() }),
      });
    }

    // 3. Sync to HubSpot (if enterprise potential detected)
    if (enriched.is_enterprise || enriched.lead_score > 60) {
      try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://qron.space';
        await fetch(`${baseUrl}/api/crm/sync`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(finalLead)
        });
      } catch (crmErr) {
        console.warn('[automation] HubSpot sync deferred:', crmErr);
      }
    }

    // 4. Trigger Welcome Email via SendGrid (simulated or direct)
    // For now, we'll log it. In a real scenario, call SendGrid.
    
    await logAutomation(workflowName, 'event', 'success', finalLead);
  } catch (err: unknown) {
    await logAutomation(workflowName, 'event', 'failure', lead, formatErr(err));
  }
}

/**
 * Social Media Automation: Queue high-quality generation for showcase.
 */
export async function queueSocialShowcase(qron: {
  id: string;
  imageUrl: string;
  prompt?: string;
}) {
  const workflowName = 'social_showcase';
  try {
    const bufferWebhook = process.env.BUFFER_WEBHOOK_URL;
    if (bufferWebhook) {
      await fetch(bufferWebhook, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `Check out this AI-generated QRON! ðŸŽ¨\n\nPrompt: ${qron.prompt}\n\n#AIArt #QRCode #QRON`,
          media: { picture: qron.imageUrl },
        }),
      });
    }
    await logAutomation(workflowName, 'event', 'success', qron);
  } catch (err: unknown) {
    await logAutomation(workflowName, 'event', 'failure', qron, formatErr(err));
  }
}

/**
 * Autonomous Business Ops: Daily Credit Reset / Report
 */
export async function runDailyMaintenance() {
  const workflowName = 'daily_maintenance';
  try {
    // 1. Reset guest counters if stored in KV/DB
    // 2. Clean up old temporary files
    // 3. Send daily revenue report to owner
    const _reportEmail = process.env.ADMIN_EMAIL || 'undone.k@gmail.com';
    
    // Fetch stats for the last 24h
    const { count: generations } = await admin
      .from('qron_generations')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 86400000).toISOString());

    const { count: leads } = await admin
      .from('lead_captures')
      .select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(Date.now() - 86400000).toISOString());

    await logAutomation(workflowName, 'cron', 'success', { generations, leads });
  } catch (err: unknown) {
    await logAutomation(workflowName, 'cron', 'failure', null, formatErr(err));
  }
}
