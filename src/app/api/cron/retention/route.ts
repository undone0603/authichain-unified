/**
 * Retention cron — runs the brand-aware dunning escalation (past-due payment
 * recovery) and the win-back campaign (re-engage cancelled customers) in one
 * scheduled pass. Registered in vercel.json.
 *
 * Auth: Vercel Cron sends GET with `Authorization: Bearer <CRON_SECRET>`. An
 * `x-internal-secret` header is also accepted for manual/internal triggers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { runDunningEscalation } from '@/lib/dunning';
import { runWinbackCampaign } from '@/lib/winback';
import { isCronAuthorized } from '@/lib/cron-auth';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  if (!isCronAuthorized(req)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [dunning, winback] = await Promise.all([
      runDunningEscalation(),
      runWinbackCampaign(),
    ]);
    return NextResponse.json({ ok: true, dunning, winback });
  } catch (err) {
    console.error('[cron/retention] failed:', err);
    return NextResponse.json(
      { error: 'Retention cron failed', details: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}
