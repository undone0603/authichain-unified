import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return NextResponse.json({ error: 'Supabase not configured' }, { status: 503 });
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const limit = Number(req.nextUrl.searchParams.get('limit') ?? '50');
  const { data, error } = await admin
    .from('automation_logs')
    .select('id, workflow_name, trigger_type, status, payload, created_at')
    .ilike('workflow_name', 'agentz_%')
    .order('created_at', { ascending: false })
    .limit(Math.min(limit, 200));

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  const summary = {
    total: data?.length ?? 0,
    byWorkflow: {} as Record<string, { count: number; lastRun: string; lastStatus: string }>,
  };

  for (const row of data ?? []) {
    const name = row.workflow_name as string;
    const existing = summary.byWorkflow[name];
    if (!existing) {
      summary.byWorkflow[name] = {
        count: 1,
        lastRun: row.created_at as string,
        lastStatus: row.status as string,
      };
    } else {
      existing.count += 1;
    }
  }

  return NextResponse.json({ ok: true, summary, logs: data });
}
