import { NextRequest, NextResponse } from 'next/server';
import { runDunningEscalation } from '@/lib/dunning';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('x-internal-secret');
  if (
    secret !== process.env.INTERNAL_API_SECRET &&
    secret !== process.env.CRON_SECRET
  ) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const result = await runDunningEscalation();
  return NextResponse.json({ ok: true, ...result });
}
