import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '../../../../../server/config/stripe';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

export async function POST(req: NextRequest) {
  try {
    const { customer_email, brand, return_url } = await req.json();

    if (!customer_email) {
      return NextResponse.json({ error: 'customer_email is required' }, { status: 400 });
    }

    // Look up stripe_customer_id from subscriptions table
    const { data: subscription } = await supabase
      .from('subscriptions')
      .select('stripe_customer_id')
      .eq('email', customer_email)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (!subscription?.stripe_customer_id) {
      return NextResponse.json({ error: 'No active subscription found for this email' }, { status: 404 });
    }

    const stripe = getStripe();
    const base_url = process.env.NEXT_PUBLIC_APP_URL ?? 'https://authichain.com';

    const portalSession = await stripe.billingPortal.sessions.create({
      customer: subscription.stripe_customer_id,
      return_url: return_url ?? `${base_url}/dashboard?brand=${brand ?? 'authichain.com'}`,
    });

    return NextResponse.json({ url: portalSession.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[stripe/portal] Error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
