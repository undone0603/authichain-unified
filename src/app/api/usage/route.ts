export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/api-auth-middleware';

/**
 * GET /api/usage
 *
 * Returns real usage data scoped to the authenticated user.
 * user_id is NEVER accepted from query params.
 */
export async function GET(req: NextRequest) {
  const { createClient } = await import('@supabase/supabase-js');
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const auth = await requireAuth(req);
  if (auth instanceof NextResponse) return auth;

  const { searchParams } = new URL(req.url);
  const period = searchParams.get('period') ?? 'monthly';

  const now = new Date();
  const periodStart = period === 'yearly'
    ? new Date(now.getFullYear(), 0, 1).toISOString()
    : new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const nextReset = period === 'yearly'
    ? new Date(now.getFullYear() + 1, 0, 1).toISOString()
    : new Date(now.getFullYear(), now.getMonth() + 1, 1).toISOString();

  // Fetch profile for plan limits
  const { data: profile } = await admin
    .from('profiles')
    .select('tier, generation_limit, generations_used')
    .eq('user_id', auth.userId)
    .single();

  // QR codes
  const { count: qrTotal } = await admin
    .from('qrons')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', auth.userId);

  const { count: qrThisPeriod } = await admin
    .from('qrons')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', auth.userId)
    .gte('created_at', periodStart);

  // Scans
  const { count: scansTotal } = await admin
    .from('scan_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', auth.userId);

  const { count: scansThisPeriod } = await admin
    .from('scan_events')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', auth.userId)
    .gte('scanned_at', periodStart);

  // API keys count
  const { count: apiKeyCount } = await admin
    .from('api_keys')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', auth.userId)
    .eq('is_active', true);

  const tier = profile?.tier ?? 'free';
  const qrLimit = tier === 'free' ? 10 : tier === 'pro' ? 500 : -1;
  const qrUsed = qrTotal ?? 0;

  return NextResponse.json({
    success: true,
    usage: {
      user_id: auth.userId,
      period,
      period_start: periodStart,
      next_reset: nextReset,
      generated_at: new Date().toISOString(),
      qr_codes: {
        used: qrUsed,
        limit: qrLimit,
        this_period: qrThisPeriod ?? 0,
        percentage: qrLimit > 0 ? Math.round((qrUsed / qrLimit) * 1000) / 10 : null,
        remaining: qrLimit > 0 ? Math.max(0, qrLimit - qrUsed) : null,
      },
      scans: {
        total: scansTotal ?? 0,
        this_period: scansThisPeriod ?? 0,
      },
      generations: {
        used: profile?.generations_used ?? 0,
        limit: profile?.generation_limit ?? 0,
        remaining: Math.max(0, (profile?.generation_limit ?? 0) - (profile?.generations_used ?? 0)),
      },
      api_keys: {
        active: apiKeyCount ?? 0,
      },
      plan: tier,
    },
    platform: 'QRON',
  });
}
