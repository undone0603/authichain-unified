import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const PLAN_HIERARCHY = ['free', 'starter', 'pro', 'business', 'enterprise'];

const PLAN_PRICES: Record<string, { monthly: number | null; annual: number | null; stripe_monthly?: string; stripe_annual?: string; contact?: boolean }> = {
  starter: { monthly: 19, annual: 15, stripe_monthly: 'price_qron_starter_mo', stripe_annual: 'price_qron_starter_yr' },
  pro: { monthly: 49, annual: 39, stripe_monthly: 'price_qron_pro_mo', stripe_annual: 'price_qron_pro_yr' },
  business: { monthly: 149, annual: 119, stripe_monthly: 'price_qron_biz_mo', stripe_annual: 'price_qron_biz_yr' },
  enterprise: { monthly: null, annual: null, contact: true }
};

export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await req.json();
    const { to_plan, billing_cycle = 'monthly', promo_code } = body;

    if (!to_plan || !PLAN_PRICES[to_plan]) {
      return NextResponse.json({ error: 'Invalid to_plan' }, { status: 400 });
    }

    const plan = PLAN_PRICES[to_plan];
    if (plan.contact) {
      return NextResponse.json({
        success: true,
        contact_required: true,
        message: 'Contact sales@qron.space for Enterprise pricing.',
        contact_url: 'https://qron.space/enterprise'
      });
    }

    const { data: sub } = await supabase
      .from('subscriptions')
      .select('plan_id')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .maybeSingle();

    const from_plan = sub?.plan_id || 'free';
    const from_idx = PLAN_HIERARCHY.indexOf(from_plan);
    const to_idx = PLAN_HIERARCHY.indexOf(to_plan);
    const is_upgrade = to_idx > from_idx;

    const base_amount = billing_cycle === 'annual' ? plan.annual! : plan.monthly!;
    let discount = 0;
    if (promo_code === 'QRON20') discount = 20;
    if (promo_code === 'EARLYBIRD') discount = 25;
    if (is_upgrade && from_plan !== 'free') discount = Math.max(discount, 5);

    const final_amount = base_amount - Math.floor(base_amount * discount / 100);
    const price_id = billing_cycle === 'annual' ? plan.stripe_annual : plan.stripe_monthly;

    const { data: record, error: recErr } = await supabase
      .from('upgrades')
      .insert({
        user_id: user.id,
        from_plan,
        to_plan,
        billing_cycle,
        price_id,
        amount: final_amount,
        discount_percent: discount,
        promo_code: promo_code || null,
        is_upgrade,
        status: 'pending',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (recErr) return NextResponse.json({ error: recErr.message }, { status: 500 });

    return NextResponse.json({
      success: true,
      upgrade_id: record.id,
      from_plan,
      to_plan,
      billing_cycle,
      amount: final_amount,
      discount_percent: discount,
      price_id,
      is_upgrade,
      checkout_url: `/api/checkout?upgrade_id=${record.id}`
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { data } = await supabase
      .from('upgrades')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    return NextResponse.json({ success: true, upgrades: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
