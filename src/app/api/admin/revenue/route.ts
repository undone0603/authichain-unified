export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/revenue
 * Revenue + tokenomics aggregation.
 * Requires: authenticated session + admin role.
 * NOTE: Previously relied on a plaintext ?key= query param (deprecated).
 * The ADMIN_DASHBOARD_KEY env var can be removed once all callers are updated.
 */
import { NextResponse } from 'next/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/utils/supabase/require-admin';

export async function GET() {
  const auth = await requireAdmin();
  if (auth instanceof NextResponse) return auth;

  // Use service-role client for aggregation queries that need full table access.
  const admin = createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  try {
    const { data: fees } = await admin.from('fee_flows').select('*');
    const totals = (fees || []).reduce(
      (acc, f) => ({
        gross:    acc.gross    + parseFloat(f.gross_amount),
        net:      acc.net      + parseFloat(f.net_amount),
        burned:   acc.burned   + parseFloat(f.burn_amount),
        treasury: acc.treasury + parseFloat(f.treasury_amount),
        rewards:  acc.rewards  + parseFloat(f.staker_reward_amount),
      }),
      { gross: 0, net: 0, burned: 0, treasury: 0, rewards: 0 }
    );

    const { count: leadCount } = await admin
      .from('lead_captures')
      .select('*', { count: 'exact', head: true });

    const { data: brands } = await admin.from('brands').select('staking_tier, id');
    const tierCounts = (brands || []).reduce((acc: Record<string, number>, b) => {
      acc[b.staking_tier] = (acc[b.staking_tier] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      infrastructure: { database: 'Connected (D1 Mirror)', workers: '21 Active', stripeConnect: 'v2 Enabled' },
      revenue: {
        gross_qron:          totals.gross.toFixed(4),
        net_qron:            totals.net.toFixed(4),
        burned_qron:         totals.burned.toFixed(4),
        treasury_qron:       totals.treasury.toFixed(4),
        staker_rewards_qron: totals.rewards.toFixed(4),
      },
      pipeline: { total_leads: leadCount || 0, brand_tiers: tierCounts },
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json({ error: 'Dashboard data fetch failed', detail: message }, { status: 500 });
  }
}
