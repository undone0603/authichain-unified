import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const CORS: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
};

const STRAIN_EVENT_TYPES = ['cultivated', 'harvested', 'lab_tested', 'packaged', 'transferred', 'dispensary_received', 'registered'];

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/**
 * GET /api/strainchain/events
 *
 * Public cannabis supply-chain event feed — the full cultivate → harvest →
 * lab_test → package → transfer → dispensary audit trail. Every entry is
 * an immutable on-chain record of a batch moving through the licensed supply
 * chain.
 *
 * Query params: event_type, cert_id, verified (true|false), limit (<=100), offset
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const limit = Math.min(Math.max(parseInt(sp.get('limit') || '20', 10) || 20, 1), 100);
    const offset = Math.max(parseInt(sp.get('offset') || '0', 10) || 0, 0);
    const eventType = sp.get('event_type');
    const certId = sp.get('cert_id');
    const verifiedParam = sp.get('verified');

    const admin = getAdmin();
    let query = admin
      .from('product_events')
      .select('id, cert_id, event_type, location, blockchain_tx, verified, occurred_at', { count: 'exact' })
      .in('event_type', STRAIN_EVENT_TYPES)
      .order('occurred_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (eventType && STRAIN_EVENT_TYPES.includes(eventType)) query = query.eq('event_type', eventType);
    if (certId) query = query.eq('cert_id', certId);
    if (verifiedParam !== null) query = query.eq('verified', verifiedParam === 'true');

    const { data, count, error } = await query;
    if (error) throw error;

    return NextResponse.json(
      { events: data ?? [], total: count ?? 0, limit, offset },
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
