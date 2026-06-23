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
 * GET /api/govchain/grants
 *
 * Public grant discovery feed — federal and agency grant programs tracked
 * by the GovChain pipeline. Supplements the SAM.gov opportunity radar with
 * direct grant funding intelligence.
 *
 * Query params: agency, category, open_only (true|false), limit (<=100), offset
 * Contact_email is intentionally excluded from the public response.
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const limit = Math.min(Math.max(parseInt(sp.get('limit') || '20', 10) || 20, 1), 100);
    const offset = Math.max(parseInt(sp.get('offset') || '0', 10) || 0, 0);
    const agency = sp.get('agency');
    const category = sp.get('category');
    const openOnly = sp.get('open_only') === 'true';

    const admin = getAdmin();
    let query = admin
      .from('grant_applications')
      .select('id, program, agency, category, amount_min, amount_max, deadline, apply_url, status, created_at', { count: 'exact' })
      .order('deadline', { ascending: true, nullsFirst: false })
      .range(offset, offset + limit - 1);

    if (agency) query = query.ilike('agency', `%${agency}%`);
    if (category) query = query.ilike('category', `%${category}%`);
    if (openOnly) query = query.gte('deadline', new Date().toISOString().slice(0, 10));

    const { data, count, error } = await query;
    if (error) throw error;

    return NextResponse.json(
      { grants: data ?? [], total: count ?? 0, limit, offset },
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
