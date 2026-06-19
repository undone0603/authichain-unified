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
      // Emit every metadata key variant the webhook handlers read. The credit-
      // granting handler (/api/webhook) reads `planId`/`userId`; the
      // status handler (/api/stripe/webhook) reads `plan`/`user_id`. Emitting
      // both keeps fulfillment correct regardless of which endpoint Stripe is
      // configured to call. Without `userId`, fulfillPlan() early-returns and a
      // paying customer receives no credits or tier upgrade.
      metadata: {
        planId: plan.id,
        plan: plan.id,
        ...(userId ? { user_id: userId, userId } : {}),
      },
      ...(plan.stripe_mode === 'subscription' ? {
        allow_promotion_codes: true,
        subscription_data: {
          metadata: {
            planId: plan.id,
            plan: plan.id,
            ...(userId ? { user_id: userId, userId } : {}),
          },
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

/**
 * GET /api/checkout?upgrade_id=<uuid>
 *
 * Converts a pending row from the `upgrades` table (created by POST /api/upgrade)
 * into a real Stripe Checkout session and redirects the browser to it. Without
 * this, /api/upgrade returned a checkout_url that pointed at a POST-only endpoint
 * — the upgrade was recorded but never charged. The upgrade_id (a server-issued
 * UUID tied to a user_id) acts as the capability token for the redirect.
 */
export async function GET(request: Request) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return NextResponse.json({ error: 'Billing is not configured' }, { status: 503 });
  }

  const { searchParams } = new URL(request.url);
  const upgradeId = searchParams.get('upgrade_id');
  if (!upgradeId) {
    return NextResponse.json({ error: 'upgrade_id is required' }, { status: 400 });
  }

  try {
    const { createClient: createAdmin } = await import('@supabase/supabase-js');
    const admin = createAdmin(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data: upgradeRow, error: lookupErr } = await admin
      .from('upgrades')
      .select('id, user_id, to_plan, price_id, status')
      .eq('id', upgradeId)
      .single();

    const upgrade = upgradeRow as
      | { id: string; user_id: string; to_plan: string; price_id: string | null; status: string }
      | null;

    if (lookupErr || !upgrade) {
      return NextResponse.json({ error: 'Upgrade not found' }, { status: 404 });
    }
    if (!upgrade.price_id) {
      return NextResponse.json({ error: 'Upgrade has no Stripe price configured' }, { status: 400 });
    }
    if (upgrade.status !== 'pending') {
      return NextResponse.json({ error: `Upgrade is ${upgrade.status}, not pending` }, { status: 409 });
    }

    const plan = PLANS.find((p) => p.id === upgrade.to_plan);
    const mode = plan?.stripe_mode ?? 'subscription';

    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2026-05-27.dahlia' as const });

    const origin = request.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://qron.space';

    const session = await stripe.checkout.sessions.create({
      mode,
      payment_method_types: ['card'],
      line_items: [{ price: upgrade.price_id, quantity: 1 }],
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/#pricing`,
      allow_promotion_codes: true,
      // Mirror POST metadata so both webhook handlers fulfill correctly.
      metadata: {
        planId: upgrade.to_plan,
        plan: upgrade.to_plan,
        user_id: upgrade.user_id,
        userId: upgrade.user_id,
        upgrade_id: upgrade.id,
      },
      ...(mode === 'subscription'
        ? {
            subscription_data: {
              metadata: {
                planId: upgrade.to_plan,
                plan: upgrade.to_plan,
                user_id: upgrade.user_id,
                userId: upgrade.user_id,
                upgrade_id: upgrade.id,
              },
            },
          }
        : {}),
    });

    if (!session.url) {
      return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 502 });
    }

    return NextResponse.redirect(session.url, { status: 303 });
  } catch (error: unknown) {
    console.error('[checkout:GET] Stripe error:', error);
    const err = error as { type?: string; code?: string };
    if (err?.type === 'StripeInvalidRequestError') {
      return NextResponse.json(
        { error: 'Checkout configuration error. Please contact support.', code: err?.code },
        { status: 503 }
      );
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
