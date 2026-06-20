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
import { PLANS } from '@/lib/plans';

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

    // --- Founder FIAT income (actual dollars, not QRON tokenomics) ---
    // The block above tracks the internal QRON token economy. Founder income is
    // real money: recurring revenue from active subscriptions, plus the actual
    // cash sitting in the Stripe balance awaiting payout to the founder's bank.
    let fiat: Record<string, unknown>;
    try {
      // MRR from active subscriptions, exact for our own plan catalogue.
      const monthlyPriceByPlan: Record<string, number> = {};
      for (const p of PLANS) {
        if (p.stripe_mode === 'subscription' && p.price_suffix === '/month') {
          monthlyPriceByPlan[p.id] = p.price;
        }
      }
      const { data: subs } = await admin
        .from('profiles')
        .select('subscription_plan, subscription_status');
      let mrr = 0;
      let activeSubscribers = 0;
      for (const row of subs || []) {
        const price = monthlyPriceByPlan[row.subscription_plan as string];
        if (row.subscription_status === 'active' && price != null) {
          mrr += price;
          activeSubscribers++;
        }
      }

      fiat = {
        configured: true,
        currency: 'usd',
        mrr_usd: mrr.toFixed(2),
        arr_usd: (mrr * 12).toFixed(2),
        active_subscribers: activeSubscribers,
      };

      // Authoritative cash position — what's actually collected and payable.
      const stripeKey = process.env.STRIPE_SECRET_KEY;
      if (stripeKey) {
        const Stripe = (await import('stripe')).default;
        const stripe = new Stripe(stripeKey, { apiVersion: '2026-05-27.dahlia' as const });
        const balance = await stripe.balance.retrieve();
        const sumUsd = (arr: { amount: number; currency: string }[] | undefined) =>
          (arr || []).filter((b) => b.currency === 'usd').reduce((a, b) => a + b.amount, 0) / 100;
        fiat.stripe_balance_available_usd = sumUsd(balance.available).toFixed(2);
        fiat.stripe_balance_pending_usd = sumUsd(balance.pending).toFixed(2);
      } else {
        fiat.stripe_balance_note = 'STRIPE_SECRET_KEY not set — cash balance unavailable';
      }
    } catch (e) {
      fiat = { configured: false, error: e instanceof Error ? e.message : 'fiat fetch failed' };
    }

    return NextResponse.json({
      infrastructure: { database: 'Connected (D1 Mirror)', workers: '21 Active', stripeConnect: 'v2 Enabled' },
      fiat,
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
