import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/ops
 *
 * Operations dashboard data: aggregated success/failure counts, recent
 * failures with error details, and the latest 50 events in chronological
 * order. Reads automation_logs for the last 24h.
 */
export async function GET() {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const past24h = new Date(Date.now() - 86400000).toISOString();

    const { data: rows, error } = await supabase
      .from('automation_logs')
      .select('workflow_name, status, error_message, payload, created_at')
      .gte('created_at', past24h)
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) throw error;

    type Row = {
      workflow_name: string;
      status: string;
      error_message: string | null;
      payload: string | null;
      created_at: string;
    };
    const allRows = (rows ?? []) as Row[];

    const byWorkflow = new Map<string, { success: number; failure: number; lastError?: string; lastSeen: string }>();
    for (const r of allRows) {
      const entry = byWorkflow.get(r.workflow_name) ?? { success: 0, failure: 0, lastSeen: r.created_at };
      if (r.status === 'success') entry.success++;
      else if (r.status === 'failure') {
        entry.failure++;
        if (!entry.lastError) entry.lastError = r.error_message || '(no message)';
      }
      if (r.created_at > entry.lastSeen) entry.lastSeen = r.created_at;
      byWorkflow.set(r.workflow_name, entry);
    }

    const summary = Array.from(byWorkflow.entries())
      .map(([name, v]) => ({ workflow: name, success: v.success, failure: v.failure, last_seen: v.lastSeen, last_error: v.lastError ?? null }))
      .sort((a, b) => b.failure - a.failure || b.success - a.success);

    const failures = allRows
      .filter(r => r.status === 'failure')
      .slice(0, 50)
      .map(r => ({
        workflow: r.workflow_name,
        error: r.error_message,
        payload: r.payload,
        at: r.created_at,
      }));

    const recent = allRows.slice(0, 50).map(r => ({
      workflow: r.workflow_name,
      status: r.status,
      at: r.created_at,
    }));

    const totals = {
      success: allRows.filter(r => r.status === 'success').length,
      failure: allRows.filter(r => r.status === 'failure').length,
    };

    return NextResponse.json({
      window_hours: 24,
      generated_at: new Date().toISOString(),
      totals,
      summary,
      failures,
      recent,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Failed to load ops data';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
