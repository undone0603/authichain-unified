import { NextRequest, NextResponse } from 'next/server';
import { getStripe } from '../../../../../server/config/stripe';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { createClient } from '@/utils/supabase/server';

export async function POST(req: NextRequest) {
  // Authenticate the caller and use THEIR OWN email — never trust a
  // customer_email from the request body, which would let anyone request a
  // live Stripe Billing Portal session (view invoices, change payment
  // method, cancel the subscription) for any account whose email they know.
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  try {
    const { brand, return_url } = await req.json();
    const customer_email = user.email;

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
