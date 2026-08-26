import { NextRequest, NextResponse } from 'next/server';
import { runDunningEscalation } from '@/lib/dunning';
import { isCronAuthorized } from '@/lib/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await runDunningEscalation();
  return NextResponse.json({ ok: true, ...result });
}
