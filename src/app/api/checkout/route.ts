import { NextResponse } from 'next/server';
import { PLANS } from '@/lib/plans';
import { createClient } from '@/utils/supabase/server';
import { logAutomation } from '@/lib/automation';
import { getBrandIdFromRequest } from '@/lib/brand-billing';

/** Read a single cookie value from a Cookie header. */
function readCookie(cookieHeader: string, name: string): string | undefined {
  return cookieHeader
    .split(';')
    .map((c) => c.trim())
    .find((c) => c.startsWith(`${name}=`))
    ?.slice(`${name}=`.length);
}

export const runtime = 'nodejs';

async function trackFunnelEvent(
  prospectId: string | null,
  stage: 'start_checkout' | 'complete_checkout',
  source: string
) {
  if (!prospectId) return; // Only track if we have prospect ID

  try {
    const { createClient: createServiceClient } = await import('@supabase/supabase-js');
    const supabase = createServiceClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    await supabase.from('funnel_events').insert({
      prospect_id: prospectId,
      stage,
      source: source || 'direct',
      metadata: {},
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error(`[checkout] Failed to track funnel event (${stage}):`, error);
  }
}

export async function POST(request: Request) {
  try {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeSecretKey) {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 500 }
      );
    }

    let body: { planId?: string; email?: string; affiliateCode?: string; prospectId?: string; source?: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const { planId, email, prospectId, source } = body;
    if (!planId) {
      return NextResponse.json({ error: 'planId is required' }, { status: 400 });
    }

    // Track checkout start
    await trackFunnelEvent(prospectId || null, 'start_checkout', source || 'direct');

    // Active brand (Host header → x-brand) so the webhook provisions, emails,
    // and duns under the right brand. Falls back to DEFAULT_BRAND.
    const brand = getBrandIdFromRequest(request);

    // Affiliate attribution: explicit body param wins, else the aff_ref cookie
    // set by middleware when the buyer landed via ?ref=CODE.
    const cookieHeader = request.headers.get('cookie') || '';
    const cookieRef = readCookie(cookieHeader, 'aff_ref');
    const affiliateCode = (body.affiliateCode || (cookieRef ? decodeURIComponent(cookieRef) : '') || '')
      .trim()
      .slice(0, 64);

    // User-to-user referral code (account-credit reward), distinct from the B2B
    // affiliate code. Set client-side by ReferralTracker as the `ref_code` cookie.
    const cookieReferral = readCookie(cookieHeader, 'ref_code');
    const refCode = (cookieReferral ? decodeURIComponent(cookieReferral) : '').trim().slice(0, 64);

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
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2026-05-27.dahlia' as const });

    const origin = request.headers.get('origin') || new URL(request.url).origin;

    const session = await stripe.checkout.sessions.create({
      mode: plan.stripe_mode,
      payment_method_types: ['card'],
      line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
      success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}${prospectId ? `&prospect_id=${prospectId}` : ''}${source ? `&utm_source=${source}` : ''}`,
      cancel_url: `${origin}/#pricing`,
      ...(email ? { customer_email: email } : {}),
      metadata: {
        plan: plan.id,
        brand,
        ...(userId ? { user_id: userId } : {}),
        ...(affiliateCode ? { affiliate_code: affiliateCode } : {}),
        ...(refCode ? { ref_code: refCode } : {}),
        ...(prospectId ? { prospect_id: prospectId } : {}),
        ...(source ? { source } : {}),
      },
      // For subscriptions, allow promo codes and show a cancel URL
      ...(plan.stripe_mode === 'subscription'
        ? {
            allow_promotion_codes: true,
            subscription_data: {
              metadata: {
                plan: plan.id,
                brand,
                ...(userId ? { user_id: userId } : {}),
                ...(affiliateCode ? { affiliate_code: affiliateCode } : {}),
                ...(refCode ? { ref_code: refCode } : {}),
                ...(prospectId ? { prospect_id: prospectId } : {}),
                ...(source ? { source } : {}),
              },
            },
          }
        : {}),
    });
return NextResponse.json({ url: session.url });
} catch (error: unknown) {
console.error('[checkout] Error:', error);

const err = error as { type?: string; message?: string };
await logAutomation('checkout_session_create', 'event', 'failure', null, `${err?.type || 'Error'}: ${err?.message || 'unknown'}`);

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
