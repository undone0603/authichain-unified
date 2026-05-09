import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Conversion funnel: Free-to-paid intent capture
// Records conversion intent, attributes to UTM source, returns checkout URL
export async function POST(req: NextRequest) {
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await req.json();
    const {
      plan_id,
      billing_cycle = 'monthly',
      utm_source,
      utm_medium,
      utm_campaign,
      trigger,  // e.g. 'quota_exceeded', 'feature_gate', 'manual', 'trial_end'
      promo_code
    } = body;

    if (!plan_id) return NextResponse.json({ error: 'plan_id is required' }, { status: 400 });

    const PLAN_PRICES: Record<string, { monthly: number; annual: number; stripe_monthly: string; stripe_annual: string }> = {
      starter:  { monthly: 19, annual: 15, stripe_monthly: 'price_qron_starter_mo', stripe_annual: 'price_qron_starter_yr' },
      pro:      { monthly: 49, annual: 39, stripe_monthly: 'price_qron_pro_mo',     stripe_annual: 'price_qron_pro_yr' },
      business: { monthly: 149, annual: 119, stripe_monthly: 'price_qron_biz_mo',  stripe_annual: 'price_qron_biz_yr' }
    };

    const plan = PLAN_PRICES[plan_id];
    if (!plan) return NextResponse.json({ error: 'Invalid plan_id' }, { status: 400 });

    let discount = 0;
    if (promo_code === 'QRON20') discount = 20;
    if (promo_code === 'EARLYBIRD') discount = 25;
    if (trigger === 'trial_end') discount = Math.max(discount, 10);

    const base = billing_cycle === 'annual' ? plan.annual : plan.monthly;
    const final_amount = base - Math.floor(base * discount / 100);
    const price_id = billing_cycle === 'annual' ? plan.stripe_annual : plan.stripe_monthly;

    // Log conversion event for analytics
    const { data: conversionEvent, error: logErr } = await supabase
      .from('conversion_events')
      .insert({
        user_id: user.id,
        plan_id,
        billing_cycle,
        trigger: trigger || 'manual',
        utm_source: utm_source || null,
        utm_medium: utm_medium || null,
        utm_campaign: utm_campaign || null,
        promo_code: promo_code || null,
        discount_percent: discount,
        amount: final_amount,
        price_id,
        status: 'intent_captured',
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (logErr) console.error('Conversion log error:', logErr.message);

    return NextResponse.json({
      success: true,
      conversion_id: conversionEvent?.id || null,
      plan_id,
      billing_cycle,
      amount: final_amount,
      discount_percent: discount,
      price_id,
      trigger,
      checkout_url: `/api/checkout?plan=${plan_id}&billing=${billing_cycle}&promo=${promo_code || ''}`,
      message: 'Conversion intent captured. Proceed to checkout to complete upgrade.'
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
      .from('conversion_events')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(20);

    return NextResponse.json({ success: true, events: data || [] });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
