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
 * GET /api/authichain/certificates
 *
 * Public certificate registry — powers the "immutable on-chain datalog" on
 * authichain.com. Brands, compliance auditors, and consumers can browse and
 * verify issued certificates without authentication.
 *
 * Query params: brand, sku, valid (true|false), limit (<=100), offset, q (product_name search)
 */
export async function GET(req: NextRequest) {
  try {
    const sp = req.nextUrl.searchParams;
    const limit = Math.min(Math.max(parseInt(sp.get('limit') || '20', 10) || 20, 1), 100);
    const offset = Math.max(parseInt(sp.get('offset') || '0', 10) || 0, 0);
    const brand = sp.get('brand');
    const sku = sp.get('sku');
    const q = sp.get('q');
    const validParam = sp.get('valid');

    const admin = getAdmin();
    let query = admin
      .from('authichain_certificates')
      .select('cert_id, product_id, brand, product_name, sku, product_hash, issued_at, scan_count, valid, revoked_at', { count: 'exact' })
      .order('issued_at', { ascending: false })
      .range(offset, offset + limit - 1);

    if (brand) query = query.ilike('brand', `%${brand}%`);
    if (sku) query = query.eq('sku', sku);
    if (q) query = query.ilike('product_name', `%${q}%`);
    if (validParam !== null) query = query.eq('valid', validParam === 'true');

    const { data, count, error } = await query;
    if (error) throw error;

    return NextResponse.json(
      { certificates: data ?? [], total: count ?? 0, limit, offset },
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
