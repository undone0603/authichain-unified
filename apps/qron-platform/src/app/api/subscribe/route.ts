import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const runtime = 'nodejs';

// QRON Stripe Price IDs — set in env or map here
const PLAN_PRICE_MAP: Record<string, string> = {
  starter: process.env.STRIPE_PRICE_STARTER || '',
  pro: process.env.STRIPE_PRICE_PRO || '',
  business: process.env.STRIPE_PRICE_BUSINESS || '',
  enterprise: process.env.STRIPE_PRICE_ENTERPRISE || '',
};

export async function POST(req: NextRequest) {
  try {
    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });

    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const body = await req.json();
    const { plan, success_url, cancel_url, trial_days } = body;

    if (!plan || !PLAN_PRICE_MAP[plan]) {
      return NextResponse.json({ error: `Invalid plan. Available: ${Object.keys(PLAN_PRICE_MAP).join(', ')}` }, { status: 400 });
    }

    const priceId = PLAN_PRICE_MAP[plan];
    if (!priceId) return NextResponse.json({ error: `Price not configured for plan: ${plan}` }, { status: 500 });

    // Get or create Stripe customer
    let stripeCustomerId: string | undefined;
    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, full_name')
      .eq('id', user.id)
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
      await supabase.from('profiles').update({ stripe_customer_id: customer.id }).eq('id', user.id);
    }

    // Build checkout session
    const sessionParams: any = {
      customer: stripeCustomerId,
      mode: 'subscription',
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: success_url || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?subscribed=true&plan=${plan}`,
      cancel_url: cancel_url || `${process.env.NEXT_PUBLIC_APP_URL}/pricing?cancelled=true`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      metadata: { user_id: user.id, plan, platform: 'qron' },
      subscription_data: {
        metadata: { user_id: user.id, plan },
      },
    };

    // Add trial if requested
    if (trial_days && parseInt(trial_days) > 0) {
      sessionParams.subscription_data.trial_period_days = parseInt(trial_days);
    }

    const session = await stripe.checkout.sessions.create(sessionParams);

    // Log the checkout attempt
    await supabase.from('checkout_sessions').insert({
      user_id: user.id,
      session_id: session.id,
      plan,
      status: 'pending',
      created_at: new Date().toISOString(),
    }).select();

    return NextResponse.json({
      success: true,
      checkout_url: session.url,
      session_id: session.id,
      plan,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  // Return available plans with prices for self-serve pricing page
  const plans = [
    { id: 'starter', name: 'Starter', price_monthly: 29, price_yearly: 290, qr_codes: 100, scans: 10000, features: ['Custom QR styles', 'Analytics', 'API access'] },
    { id: 'pro', name: 'Pro', price_monthly: 79, price_yearly: 790, qr_codes: 1000, scans: 100000, features: ['Everything in Starter', 'AI art styles', 'Priority support', 'Bulk generation'] },
    { id: 'business', name: 'Business', price_monthly: 199, price_yearly: 1990, qr_codes: 10000, scans: 1000000, features: ['Everything in Pro', 'White label', 'Team seats', 'Custom domains', 'SLA'] },
    { id: 'enterprise', name: 'Enterprise', price_monthly: null, price_yearly: null, qr_codes: null, scans: null, features: ['Unlimited everything', 'Dedicated support', 'Custom contracts', 'On-premise option'] },
  ];
  return NextResponse.json({ success: true, plans, currency: 'usd' });
}
