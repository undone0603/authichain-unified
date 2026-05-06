import { NextResponse } from 'next/server';
import { PLANS } from '@/lib/plans';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 500 }
      );
    }

    let body: { planId?: string; email?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { planId, email } = body;
    if (!planId) {
      return NextResponse.json({ error: 'planId is required' }, { status: 400 });
    }

    const plan = PLANS.find((p) => p.id === planId);
    if (!plan) {
      return NextResponse.json({ error: 'Unknown plan' }, { status: 400 });
    }
    if (!plan.stripe_price_id || !plan.stripe_mode) {
      return NextResponse.json(
        { error: 'Free plan does not require checkout' },
        { status: 400 }
      );
    }

    // Capture authenticated user for post-payment upgrade
    let userId: string | null = null;
    if (
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
    ) {
      try {
        const supabase = await createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();
        userId = user?.id ?? null;
      } catch {
        /* guest checkout still works */
      }
    }

    const Stripe = (await import('stripe')).default;
    // @ts-expect-error - version mismatch in types
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2024-06-20' }); // Use a stable version

    const origin = request.headers.get('origin') || new URL(request.url).origin;

    const session = await stripe.checkout.sessions.create({
      mode: plan.stripe_mode,
      payment_method_types: ['card'],
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/#pricing`,
      ...(email ? { customer_email: email } : {}),
      metadata: {
        planId: plan.id,
        ...(userId ? { userId } : {}),
      },
      // For subscriptions, allow promo codes and show a cancel URL
      ...(plan.stripe_mode === 'subscription'
        ? {
            allow_promotion_codes: true,
            subscription_data: {
              metadata: { planId: plan.id, ...(userId ? { userId } : {}) },
            },
          }
        : {}),
    });
return NextResponse.json({ url: session.url });
} catch (error: unknown) {
console.error('[checkout] Error:', error);

const err = error as { type?: string; message?: string };

if (
  err?.type === 'StripeInvalidRequestError' &&
  /payment.method/i.test(err?.message ?? '')
) {
  return NextResponse.json(
    {
      error:
        'Card payments are not enabled on this Stripe account. Contact support.',
      code: 'PAYMENT_METHOD_DISABLED',
    },
    { status: 503 }
  );
}

return NextResponse.json(
  { error: 'Internal Server Error', detail: err?.message },
  { status: 500 }
);
}
}
