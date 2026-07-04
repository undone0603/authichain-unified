import { NextRequest, NextResponse } from 'next/server';
import { runAdvancedGovernmentLeadGen } from '@/agents/government-lead-gen-v2';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 300;

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
