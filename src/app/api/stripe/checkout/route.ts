import { NextRequest, NextResponse } from 'next/server';
import { getStripe, getPriceId } from '../../../../../server/config/stripe';

export async function POST(req: NextRequest) {
  try {
    const { plan_id, brand, customer_email } = await req.json();

    if (!plan_id || !brand || !customer_email) {
      return NextResponse.json(
        { error: 'plan_id, brand, and customer_email are required' },
        { status: 400 },
      );
    }

    const stripe = getStripe();
    const price_id = getPriceId(plan_id);

    const base_url = process.env.NEXT_PUBLIC_APP_URL ?? 'https://authichain.com';

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      customer_email,
      line_items: [{ price: price_id, quantity: 1 }],
      metadata: { plan_id, brand },
      success_url: `${base_url}/dashboard?brand=${brand}&session_id={CHECKOUT_SESSION_ID}&status=success`,
      cancel_url: `${base_url}/pricing?brand=${brand}&status=cancelled`,
      allow_promotion_codes: true,
      billing_address_collection: 'auto',
      tax_id_collection: { enabled: true },
    });

    return NextResponse.json({ url: session.url });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Internal server error';
    console.error('[stripe/checkout] Error:', err);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
