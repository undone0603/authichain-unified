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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

function authorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET || process.env.INTERNAL_API_SECRET;
  if (!secret) return true; // no secret configured → allow (dev)
  const bearer = req.headers.get('authorization')?.replace('Bearer ', '');
  const internal = req.headers.get('x-internal-secret');
  return bearer === secret || internal === secret;
}

export async function GET(req: NextRequest) {
  if (!authorized(req)) {
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
