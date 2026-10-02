import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/require-admin';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

type AutomationLog = {
  id: string;
  workflow_name: string;
  trigger_type: string;
  status: string;
  created_at: string;
};

function normalize(row: AutomationLog) {
  const isAgentZ = row.workflow_name.startsWith('agentz_');
  const failed = ['failure', 'failed', 'error', 'critical'].includes(row.status.toLowerCase());

  return {
    id: row.id,
    timestamp: row.created_at,
    source: isAgentZ ? 'agentz' : 'automation',
    transport:
      row.trigger_type === 'webhook'
        ? 'webhook'
        : row.trigger_type === 'cron'
          ? 'schedule'
          : 'event-log',
    type: `automation.${failed ? 'run_failed' : 'run_completed'}`,
    severity: failed ? 'warning' : 'info',
    entity: row.workflow_name,
    summary: `${row.workflow_name.replace(/[_-]/g, ' ')} ${failed ? 'reported a failure' : 'completed'}`,
    data: { status: row.status },
    status: row.status,
    agent: isAgentZ ? 'AgentZ' : null,
  };
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createClient();
    const authResult = await requireAdmin(supabase);
    if (authResult instanceof NextResponse) return authResult;

    const params = request.nextUrl.searchParams;
    const since = params.get('since');
    if (since && !Number.isFinite(Date.parse(since))) {
      return NextResponse.json({ error: 'since must be a valid ISO timestamp' }, { status: 400 });
    }

    const { data, error } = await supabase
      .from('automation_logs')
      .select('id, workflow_name, trigger_type, status, created_at')
      .gte('created_at', since ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(500);

    if (error) throw error;

    const source = params.get('source');
    const agent = params.get('agent');
    const severity = params.get('severity');
    const entity = params.get('entity')?.trim().toLowerCase();
    const events = ((data ?? []) as AutomationLog[])
      .map(normalize)
      .filter(event => !source || source === 'all' || event.source === source)
      .filter(event => !agent || agent === 'all' || event.agent?.toLowerCase() === agent.toLowerCase())
      .filter(event => !severity || severity === 'all' || event.severity === severity)
      .filter(event => !entity || event.entity.toLowerCase().includes(entity))
      .slice(0, 100);

    return NextResponse.json(
      {
        events,
        generated_at: new Date().toISOString(),
        refresh_after_seconds: 30,
        sources: ['agentz', 'automation'],
      },
      { headers: { 'Cache-Control': 'private, no-store' } }
    );
  } catch {
    return NextResponse.json({ error: 'Unable to load the SI Feed' }, { status: 500 });
  }
}
