import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/**
 * GET /api/govchain/stats
 *
 * Public aggregate stats over the gov-engine pipeline — real numbers for the
 * govchain.us landing page (replaces hard-coded placeholders).
 */
export async function GET() {
  try {
    const admin = getAdmin();

    const [scored, highFit, proposals, latest] = await Promise.all([
      admin.from('gov_opportunities').select('*', { count: 'exact', head: true }),
      admin.from('gov_opportunities').select('*', { count: 'exact', head: true }).gte('fit_score', 70),
      admin.from('gov_proposals').select('*', { count: 'exact', head: true }),
      admin.from('gov_opportunities').select('ingested_at').order('ingested_at', { ascending: false }).limit(1).maybeSingle(),
    ]);

    return NextResponse.json(
      {
        opportunities_scored: scored.count ?? 0,
        high_fit: highFit.count ?? 0,
        proposals_drafted: proposals.count ?? 0,
        last_ingested: (latest.data as { ingested_at?: string } | null)?.ingested_at ?? null,
      },
      { headers: CORS },
    );
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: msg }, { status: 500, headers: CORS });
  }
}

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}
