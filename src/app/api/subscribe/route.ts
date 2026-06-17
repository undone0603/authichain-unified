import { NextRequest, NextResponse } from 'next/server';
import { PLANS } from '@/lib/plans';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://localhost',
      process.env.SUPABASE_SERVICE_ROLE_KEY || 'not_configured'
    );
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(stripeKey, { apiVersion: '2026-05-27.dahlia' as const });

    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await req.json();
    const { plan: planId, success_url, cancel_url, trial_days } = body;

    const plan = PLANS.find((p) => p.id === planId);
    if (!plan || !plan.stripe_price_id || !plan.stripe_mode) {
      const available = PLANS.filter((p) => p.stripe_price_id).map((p) => p.id);
      return NextResponse.json({ error: `Invalid plan. Available: ${available.join(', ')}` }, { status: 400 });
    }

    // Get or create Stripe customer
    let stripeCustomerId: string | undefined;
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, full_name')
      .eq('user_id', user.id)
      .single();

    if (profile?.stripe_customer_id) {
      stripeCustomerId = profile.stripe_customer_id;
    } else {
      const customer = await stripe.customers.create({
        email: user.email!,
        name: profile?.full_name || undefined,
        metadata: { supabase_user_id: user.id, platform: 'qron' },
      });
      stripeCustomerId = customer.id;
      await supabase.from('profiles').update({ stripe_customer_id: customer.id }).eq('user_id', user.id);
    }

    const origin = process.env.NEXT_PUBLIC_APP_URL || 'https://qron.space';
    const sessionParams: Record<string, unknown> = {
      customer: stripeCustomerId,
      mode: plan.stripe_mode,
      payment_method_types: ['card'],
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      success_url: success_url || `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: cancel_url || `${origin}/pricing`,
      metadata: { planId: plan.id, userId: user.id },
    };

    if (plan.stripe_mode === 'subscription') {
      sessionParams.allow_promotion_codes = true;
      sessionParams.subscription_data = { metadata: { planId: plan.id, userId: user.id } };
      if (trial_days && parseInt(trial_days) > 0) {
        (sessionParams.subscription_data as Record<string, unknown>).trial_period_days = parseInt(trial_days);
      }
    }

    const session = await stripe.checkout.sessions.create(sessionParams as Parameters<typeof stripe.checkout.sessions.create>[0]);

    await supabase.from('checkout_sessions').insert({
      user_id: user.id,
      session_id: session.id,
      plan: plan.id,
      status: 'pending',
      created_at: new Date().toISOString(),
    }).select();

    return NextResponse.json({
      success: true,
      checkout_url: session.url,
      session_id: session.id,
      plan: plan.id,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function GET() {
  const plans = PLANS.filter((p) => p.stripe_price_id).map((p) => ({
    id: p.id,
    name: p.name,
    price: p.price,
    price_suffix: p.price_suffix,
    description: p.description,
    generations: p.generations,
    tier: p.tier,
    mode: p.stripe_mode,
    features: p.features,
  }));
  return NextResponse.json({ success: true, plans, currency: 'usd' });
}
