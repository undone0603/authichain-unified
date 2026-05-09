import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

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

    const { data: profile } = await supabase
      .from('profiles')
      .select('stripe_customer_id, subscription_plan, subscription_status')
      .eq('id', user.id)
      .single();

    if (!profile?.stripe_customer_id) {
      return NextResponse.json({
        error: 'No active subscription found. Please subscribe first.',
        action: 'subscribe',
        subscribe_url: `${process.env.NEXT_PUBLIC_APP_URL}/pricing`,
      }, { status: 404 });
    }

    const body = await req.json().catch(() => ({}));
    const returnUrl = body.return_url || `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/billing`;

    const session = await stripe.billingPortal.sessions.create({
      customer: profile.stripe_customer_id,
      return_url: returnUrl,
    });

    return NextResponse.json({
      success: true,
      portal_url: session.url,
      current_plan: profile.subscription_plan,
      current_status: profile.subscription_status,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function GET(req: NextRequest) {
  // GET returns the user's current subscription status
  try {
    const authHeader = req.headers.get('authorization');
    if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return NextResponse.json({ error: 'Invalid token' }, { status: 401 });

    const { data: profile } = await supabase
      .from('profiles')
      .select('subscription_plan, subscription_status, subscribed_at, stripe_subscription_id, stripe_customer_id')
      .eq('id', user.id)
      .single();

    const { data: payments } = await supabase
      .from('payment_history')
      .select('amount, currency, status, paid_at')
      .eq('user_id', user.id)
      .order('paid_at', { ascending: false })
      .limit(10);

    return NextResponse.json({
      success: true,
      subscription: {
        plan: profile?.subscription_plan || 'free',
        status: profile?.subscription_status || 'inactive',
        subscribed_at: profile?.subscribed_at || null,
        has_stripe: !!profile?.stripe_customer_id,
      },
      payment_history: payments || [],
      portal_available: !!profile?.stripe_customer_id,
    });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
