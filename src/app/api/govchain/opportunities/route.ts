import { NextRequest, NextResponse } from 'next/server';
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
 * GET /api/govchain/opportunities
 *
 * Public "opportunity radar" over the gov-engine's scored SAM.gov pipeline.
 * Surfaces public SAM.gov fields plus the AI relevance score. Internal strategy
 * fields (recommended_action, ai_reasoning) are intentionally NOT exposed.
 *
 * Query params: min_fit, agency, naics, q (title search), status, limit (<=100), offset.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const limit = Math.min(Math.max(parseInt(sp.get('limit') || '20', 10) || 20, 1), 100);
    const offset = Math.max(parseInt(sp.get('offset') || '0', 10) || 0, 0);
    const minFit = parseInt(sp.get('min_fit') || '0', 10) || 0;
    const status = sp.get('status') || 'scored';
    const agency = sp.get('agency');
    const naics = sp.get('naics');
    const q = sp.get('q');

    const admin = getAdmin();
    let query = admin
      .from('gov_opportunities')
      .select(
        'notice_id, title, agency, deadline, naics_code, description, fit_score, sam_url, scored_at',
        { count: 'exact' },
      )
      .eq('status', status)
      .gte('fit_score', minFit)
      .order('fit_score', { ascending: false, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (agency) query = query.ilike('agency', `%${agency}%`);
    if (naics) query = query.eq('naics_code', naics);
    if (q) query = query.ilike('title', `%${q}%`);

    const { data, count, error } = await query;
    if (error) throw error;

    return NextResponse.json(
      { opportunities: data ?? [], total: count ?? 0, limit, offset },
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
