import { NextRequest, NextResponse } from 'next/server';
import { runAdvancedGovernmentLeadGen } from '@/agents/government-lead-gen-v2';
import { isCronAuthorized } from '@/lib/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    const result = await runAdvancedGovernmentLeadGen();
    return NextResponse.json({ ok: true, ...result, timestamp: new Date().toISOString() });
  } catch (err) {
    console.error('[cron/govchain] failed:', err);
    return NextResponse.json(
      { error: 'GovChain lead-gen failed', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
