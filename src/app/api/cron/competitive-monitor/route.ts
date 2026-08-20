import { NextRequest, NextResponse } from 'next/server';
import { runCompetitiveMonitor } from '@/lib/competitive-monitor';
import { isCronAuthorized } from '@/lib/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await runCompetitiveMonitor();
    return NextResponse.json({ ok: true, ...result, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('[cron/competitive-monitor] failed:', err);
    return NextResponse.json(
      { error: 'Competitive monitor failed', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
