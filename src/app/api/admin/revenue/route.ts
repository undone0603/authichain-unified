import { NextResponse } from 'next/server';
import { supabaseAdmin as admin } from '@/lib/supabase-admin';
import { createClient } from '@/utils/supabase/server';
import { requireAdmin } from '@/lib/require-admin';
import { checkAdminKey } from '@/lib/admin-key';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  // Shared-key path: ADMIN_DASHBOARD_KEY only, min 16 chars, fail-closed.
  // Session path: requireAdmin so the founder dashboard still works without
  // a query-string key. Do not drop this fallback.
  if (!checkAdminKey(request)) {
    const supabase = await createClient();
    const authResult = await requireAdmin(supabase);
    if (authResult instanceof NextResponse) return authResult;
  }

  try {
    // 1. Fetch Aggregated Revenue & Tokenomics Stats
    // fee_flows amounts are speculative $QRON theater (authentic-economy.ts),
    // not x402 Base USDC. See docs/strategy/WEB3_IDENTITY.md.
    const { data: fees } = await admin.from('fee_flows').select('*');

    const totals = (fees || []).reduce(
      (acc, f) => ({
        gross: acc.gross + parseFloat(f.gross_amount),
        net: acc.net + parseFloat(f.net_amount),
        burned: acc.burned + parseFloat(f.burn_amount),
        treasury: acc.treasury + parseFloat(f.treasury_amount),
        rewards: acc.rewards + parseFloat(f.staker_reward_amount),
      }),
      { gross: 0, net: 0, burned: 0, treasury: 0, rewards: 0 }
    );

    // 2. Fetch Lead Stats
    const { count: leadCount } = await admin
      .from('lead_captures')
      .select('*', { count: 'exact', head: true });

    // 3. Fetch Brand Tiers
    const { data: brands } = await admin
      .from('brands')
      .select('staking_tier, id');

    const tierCounts = (brands || []).reduce((acc: Record<string, number>, b) => {
      acc[b.staking_tier] = (acc[b.staking_tier] || 0) + 1;
      return acc;
    }, {});

    return NextResponse.json({
      theater: true,
      liveTokenomics: false,
      unit: 'QRON',
      identity:
        'https://github.com/undone0603/authichain-unified/blob/main/docs/strategy/WEB3_IDENTITY.md',
      infrastructure: {
        database: 'Connected (D1 Mirror)',
        workers: '21 Active',
        stripeConnect: 'v2 Enabled',
      },
      revenue: {
        gross_qron: totals.gross.toFixed(4),
        net_qron: totals.net.toFixed(4),
        burned_qron: totals.burned.toFixed(4),
        treasury_qron: totals.treasury.toFixed(4),
        staker_rewards_qron: totals.rewards.toFixed(4),
        note: 'Speculative $QRON fee_flows theater — not x402 Base USDC.',
      },
      pipeline: {
        total_leads: leadCount || 0,
        brand_tiers: tierCounts,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'An unknown error occurred';
    return NextResponse.json(
      { error: 'Dashboard data fetch failed', detail: message },
      { status: 500 }
    );
  }
}
