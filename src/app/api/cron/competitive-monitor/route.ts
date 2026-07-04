import { NextRequest, NextResponse } from 'next/server';
import { runCompetitiveMonitor } from '@/lib/competitive-monitor';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET || process.env.INTERNAL_API_SECRET;
  if (!secret) return true;
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '');
  const internal = req.headers.get('x-internal-secret');
  return bearer === secret || internal === secret;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
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
