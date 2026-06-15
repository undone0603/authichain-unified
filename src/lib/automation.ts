import { createClient } from '@supabase/supabase-js';

export type AutomationStatus = 'success' | 'failure';
export type AutomationKind = 'cron' | 'webhook' | 'manual' | 'api';

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
