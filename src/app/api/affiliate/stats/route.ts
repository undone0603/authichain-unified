import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { createClient as createAdminClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

function getAdmin() {
  return createAdminClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

/**
 * GET /api/affiliate/stats
 *
 * Performance + payout stats for the current affiliate, read from the
 * `affiliates` table (the source of truth) plus Stripe-connection status.
 */
export async function GET(_request: Request) {
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const admin = getAdmin();

    const { data: affiliate } = await admin
      .from('affiliates')
      .select('affiliatecode, tier, commission_rate, total_referrals, total_conversions, total_earnings, pending_payout, status')
      .eq('user_id', user.id)
      .maybeSingle();

    if (!affiliate) {
      return NextResponse.json({ error: 'Not an affiliate' }, { status: 404 });
    }

    const { data: profile } = await admin
      .from('profiles')
      .select('stripe_account_id')
      .eq('id', user.id)
      .maybeSingle();

    const a = affiliate as Record<string, unknown>;
    return NextResponse.json({
      affiliateCode: a.affiliatecode,
      tier: a.tier,
      status: a.status,
      commissionRate: Number(a.commission_rate ?? 0),
      totalReferrals: Number(a.total_referrals ?? 0),
      totalConversions: Number(a.total_conversions ?? 0),
      totalEarned: Number(a.total_earnings ?? 0).toFixed(2),
      pendingPayout: Number(a.pending_payout ?? 0).toFixed(2),
      payoutConnected: Boolean((profile as { stripe_account_id?: string } | null)?.stripe_account_id),
      currency: 'USD',
    });
  } catch (_err: unknown) {
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
