import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * GET /api/affiliate/stats
 *
 * Fetch performance stats for the current affiliate.
 */
export async function GET(_request: Request) {
  try {
    const supabase = await createClient();
    const {
      data: { session },
    } = await supabase.auth.getSession();
    if (!session)
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('affiliate_id')
      .eq('id', session.user.id)
      .single();

    if (!profile?.affiliate_id) {
      return NextResponse.json({ error: 'Not an affiliate' }, { status: 404 });
    }

    const { data: referrals } = await supabase
      .from('referrals')
      .select('*')
      .eq('affiliate_id', profile.affiliate_id);

    const totalEarned = (referrals || []).reduce(
      (sum, r) => sum + parseFloat(r.commission_earned || '0'),
      0
    );

    return NextResponse.json({
      affiliateId: profile.affiliate_id,
      totalReferrals: referrals?.length || 0,
      totalEarned: totalEarned.toFixed(2),
      currency: 'USD',
    });
  } catch (_err: unknown) {
    return NextResponse.json({ error: 'Failed to fetch stats' }, { status: 500 });
  }
}
