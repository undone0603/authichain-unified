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
 * Lightweight lead-automation hook invoked by the /api/leads/capture edge route.
 * Records the trigger; the substantive outreach (HubSpot / Make / email) runs in
 * the server pipeline (server/agents/*, scheduled-jobs), not in the edge runtime.
 */
export async function handleLeadAutomation(lead: {
  email: string;
  name?: string;
  source?: string;
}): Promise<void> {
  try {
    await logAutomation('lead_automation', 'event', 'success', lead);
  } catch (err) {
    await logAutomation('lead_automation', 'event', 'failure', lead, formatErr(err));
  }
}

/**
 * Daily-maintenance marker invoked by the /api/automation/cron edge route.
 * The substantive maintenance jobs run via the server scheduler
 * (server/scheduled-jobs.ts); this records that the edge cron fired.
 */
export async function runDailyMaintenance(): Promise<void> {
  await logAutomation('daily_maintenance', 'cron', 'success');
}
