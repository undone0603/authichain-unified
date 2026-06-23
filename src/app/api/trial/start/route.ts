import { NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { logAutomation } from '@/lib/automation';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/trial/start
 *
 * "Try for free" — starts a card-required Stripe free trial subscription
 * (replaces the old free-generations grant). The card is collected up front
 * but not charged until the trial ends, at which point Stripe auto-converts
 * the subscription to paid (and the existing trial_will_end email + dunning
 * flow take over).
 *
 * Requires:
 *   STRIPE_SECRET_KEY
 *   STRIPE_TRIAL_PRICE_ID   — a recurring Stripe price to trial into
 *   STRIPE_TRIAL_DAYS       — optional, default 7
 *   STRIPE_TRIAL_GENERATIONS — optional generation grant during trial, default 100
 */
export async function POST(request: Request) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    const trialPriceId = process.env.STRIPE_TRIAL_PRICE_ID;
    if (!stripeSecretKey || !trialPriceId) {
      return NextResponse.json(
        { error: 'Free trial is not configured', code: 'TRIAL_NOT_CONFIGURED' },
        { status: 503 },
      );
    }

    // A trial subscription must attach to an account.
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Sign in to start your free trial' }, { status: 401 });
    }

    const trialDays = parseInt(process.env.STRIPE_TRIAL_DAYS || '7', 10);
    const trialGrant = process.env.STRIPE_TRIAL_GENERATIONS || '100';

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2026-05-27.dahlia' as const });

    const origin = request.headers.get('origin') || new URL(request.url).origin;

    // Carry affiliate attribution through the trial too (aff_ref cookie).
    const cookieHeader = request.headers.get('cookie') || '';
    const cookieRef = cookieHeader
      .split(';')
      .map((c) => c.trim())
      .find((c) => c.startsWith('aff_ref='))
      ?.slice('aff_ref='.length);
    const affiliateCode = cookieRef ? decodeURIComponent(cookieRef).trim().slice(0, 64) : '';

    const meta: Record<string, string> = {
      plan: 'trial',
      user_id: user.id,
      trial: 'true',
      grant: trialGrant,
      ...(affiliateCode ? { affiliate_code: affiliateCode } : {}),
    };

    const session = await stripe.checkout.sessions.create({
      mode: 'subscription',
      payment_method_types: ['card'],
      // Card required up front even though the trial does not charge now.
      payment_method_collection: 'always',
      line_items: [{ price: trialPriceId, quantity: 1 }],
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}&trial=1`,
      cancel_url: `${origin}/#pricing`,
      customer_email: user.email ?? undefined,
      allow_promotion_codes: true,
      subscription_data: {
        trial_period_days: trialDays,
        // If the card is removed/invalid at trial end, cancel rather than leave unpaid.
        trial_settings: { end_behavior: { missing_payment_method: 'cancel' } },
        metadata: meta,
      },
      metadata: meta,
    });

    return NextResponse.json({ url: session.url });
  } catch (error: unknown) {
    const err = error as { type?: string; message?: string };
    await logAutomation('trial_start', 'event', 'failure', null, `${err?.type || 'Error'}: ${err?.message || 'unknown'}`);
    return NextResponse.json({ error: 'Failed to start trial', detail: err?.message }, { status: 500 });
  }
}
