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
 * GET /api/authichain/cert/[cert_id]
 *
 * Public certificate verification endpoint — the QR-scan target printed on
 * physical products. Returns authenticity status, brand, product name, and
 * scan telemetry. Does NOT require authentication.
 *
 * Also increments scan_count and updates last_scanned so brands get telemetry.
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ cert_id: string }> },
) {
  const { cert_id } = await params;

  if (!cert_id || cert_id.length > 128) {
    return NextResponse.json({ error: 'Invalid cert_id' }, { status: 400, headers: CORS });
  }

  try {
    const admin = getAdmin();

    const { data: cert, error } = await admin
      .from('authichain_certificates')
      .select('cert_id, product_id, brand, product_name, sku, product_hash, issued_at, last_scanned, revoked_at, scan_count, valid, metadata')
      .eq('cert_id', cert_id)
      .maybeSingle();

    if (error) throw error;
    if (!cert) {
      return NextResponse.json(
        { is_authentic: false, error: 'Certificate not found' },
        { status: 404, headers: CORS },
      );
    }

    // Increment scan counter async (fire-and-forget — don't delay the response)
    admin
      .from('authichain_certificates')
      .update({ scan_count: (cert.scan_count ?? 0) + 1, last_scanned: new Date().toISOString() })
      .eq('cert_id', cert_id)
      .then(() => {});

    const isAuthentic = cert.valid === true && cert.revoked_at === null;

    return NextResponse.json(
      {
        is_authentic: isAuthentic,
        protocol: 'AuthiChain',
        version: '2.0',
        certificate: {
          cert_id: cert.cert_id,
          product_id: cert.product_id,
          brand: cert.brand,
          product_name: cert.product_name,
          sku: cert.sku,
          product_hash: cert.product_hash,
          issued_at: cert.issued_at,
          last_scanned: cert.last_scanned,
          revoked_at: cert.revoked_at ?? null,
          scan_count: (cert.scan_count ?? 0) + 1,
          valid: cert.valid,
          metadata: cert.metadata ?? null,
        },
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
