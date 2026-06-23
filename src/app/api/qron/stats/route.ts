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
 * GET /api/qron/stats
 *
 * Live aggregate stats for the QRON / AuthiChain ecosystem.
 * Powers the qron.space landing page hero numbers.
 */
export async function GET() {
  try {
    const admin = getAdmin();

    const [auths, auths30d, rewards, certs, events, qrons] = await Promise.all([
      admin.from('authentications').select('*', { count: 'exact', head: true }),
      admin.from('authentications').select('*', { count: 'exact', head: true })
        .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      admin.from('qron_rewards').select('*', { count: 'exact', head: true }),
      admin.from('authichain_certificates').select('*', { count: 'exact', head: true }).eq('valid', true),
      admin.from('product_events').select('*', { count: 'exact', head: true }),
      admin.from('products').select('*', { count: 'exact', head: true }).eq('is_active', true),
    ]);

    return NextResponse.json(
      {
        authentications_total: auths.count ?? 0,
        authentications_last_30d: auths30d.count ?? 0,
        rewards_issued: rewards.count ?? 0,
        certificates_valid: certs.count ?? 0,
        product_events_total: events.count ?? 0,
        active_products: qrons.count ?? 0,
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
