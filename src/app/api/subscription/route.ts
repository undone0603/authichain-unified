export const runtime = 'nodejs';

import { NextRequest, NextResponse } from 'next/server';
import { requireSession } from '@/lib/api-auth-middleware';
import Stripe from 'stripe';

/**
 * GET /api/subscription
 *
 * ?type=plans  — public plan catalog (no auth required)
 * (default)    — authenticated user's own subscription(s)
 */
export async function GET(req: NextRequest) {
  const { createClient } = await import('@supabase/supabase-js');
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const { searchParams } = new URL(req.url);
  const type = searchParams.get('type');

  // Plans catalog is public — no auth needed
  if (type === 'plans') {
    const { data: plans, error } = await admin
      .from('plans')
      .select('id, name, price, interval, features, max_qr_codes')
      .eq('is_active', true)
      .order('price', { ascending: true });

    if (error) return NextResponse.json({ error: 'Failed to load plans' }, { status: 500 });
    return NextResponse.json({ success: true, plans, platform: 'QRON' });
  }

  // All other queries require authentication
  const session = await requireSession(req);
  if (session instanceof NextResponse) return session;

  const { data: subscriptions, error } = await admin
    .from('subscriptions')
    .select('id, plan_id, status, current_period_start, current_period_end, stripe_subscription_id, created_at')
    .eq('user_id', session.id)
    .order('created_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'Failed to load subscriptions' }, { status: 500 });

  return NextResponse.json({
    success: true,
    subscriptions,
    total: subscriptions?.length ?? 0,
    active: subscriptions?.filter(s => s.status === 'active').length ?? 0,
    platform: 'QRON',
  });
}

/**
 * POST /api/subscription
 *
 * Creates a Stripe checkout session for upgrading/subscribing.
 * Never creates a subscription row directly — that is handled by
 * the Stripe webhook (stripe/webhook/route.ts) after payment.
 */
export async function POST(req: NextRequest) {
  const { createClient } = await import('@supabase/supabase-js');
  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
  const session = await requireSession(req);
  if (session instanceof NextResponse) return session;

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const { plan_id } = body as Record<string, unknown>;

  if (typeof plan_id !== 'string' || !plan_id.trim()) {
    return NextResponse.json({ error: 'plan_id is required' }, { status: 400 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeKey) {
    return NextResponse.json({ error: 'Billing not configured' }, { status: 503 });
  }

  const { data: plan, error: planErr } = await admin
    .from('plans')
    .select('id, name, stripe_price_id, stripe_mode')
    .eq('id', plan_id.trim())
    .single();

  if (planErr || !plan) {
    return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
  }

  if (!plan.stripe_price_id) {
    return NextResponse.json({ error: 'This plan does not require a payment' }, { status: 400 });
  }

  const stripe = new Stripe(stripeKey, { apiVersion: '2026-05-27.dahlia' as const });
  const origin = req.headers.get('origin') ?? process.env.NEXT_PUBLIC_APP_URL ?? 'https://qron.space';

  const checkoutSession = await stripe.checkout.sessions.create({
    mode: plan.stripe_mode ?? 'subscription',
    payment_method_types: ['card'],
    line_items: [{ price: plan.stripe_price_id, quantity: 1 }],
    success_url: `${origin}/dashboard?checkout=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}/pricing`,
    metadata: { user_id: session.id, plan_id: plan.id },
    ...(plan.stripe_mode === 'subscription' ? {
      allow_promotion_codes: true,
      subscription_data: { metadata: { user_id: session.id, plan_id: plan.id } },
    } : {}),
  });

  return NextResponse.json({ success: true, url: checkoutSession.url, session_id: checkoutSession.id });
}
