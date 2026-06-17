import { NextResponse } from 'next/server';
import { PLANS } from '@/lib/plans';
import { createClient } from '@/utils/supabase/server';

export const runtime = 'nodejs';

export async function POST(request: Request) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return NextResponse.json({ error: 'Billing is not configured' }, { status: 503 });
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
    return NextResponse.json({ error: 'Free plan does not require checkout' }, { status: 400 });
  }

  let userId: string | null = null;
  try {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    userId = user?.id ?? null;
  } catch {
    /* guest checkout — userId stays null */
  }

  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2026-05-27.dahlia' as const });

    const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://qron.space';

    const session = await stripe.checkout.sessions.create({
      mode: plan.stripe_mode,
      payment_method_types: ['card'],
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/#pricing`,
      ...(email ? { customer_email: email } : {}),
      metadata: {
        planId: plan.id,
        ...(userId ? { user_id: userId } : {}),
      },
      ...(plan.stripe_mode === 'subscription' ? {
        allow_promotion_codes: true,
        subscription_data: {
          metadata: { planId: plan.id, ...(userId ? { user_id: userId } : {}) },
        },
      } : {}),
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    console.error('[checkout] Stripe error:', error);

    const err = error as { type?: string; code?: string };

    if (err?.type === 'StripeInvalidRequestError') {
      // Surface a safe, user-facing message — never leak raw Stripe error messages
      return NextResponse.json(
        { error: 'Checkout configuration error. Please contact support.', code: err?.code },
        { status: 503 }
      );
    }

    // Generic fallback — do NOT include err.message in the response body
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
