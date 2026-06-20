import { NextResponse } from 'next/server';
import { grantCheckoutEntitlements } from '@/lib/fulfillment';

export const runtime = 'nodejs';

/**
 * POST /api/checkout/verify  { session_id }
 *
 * Post-checkout fulfillment backstop. The Stripe webhook is the primary
 * fulfillment path, but webhooks can be delayed, mis-configured, or dropped —
 * in which case a paying customer would land on /success with nothing granted.
 *
 * This endpoint is called by the success page: it reads the session straight
 * from Stripe (the authoritative source of truth for payment status), and if
 * the session is genuinely paid, grants the entitlements through the same
 * idempotent path the webhook uses. The per-session guard guarantees credits
 * are never granted twice if the webhook also fires.
 *
 * Safe to expose publicly: session ids are unguessable, and the grant acts only
 * on metadata WE embedded at checkout creation — a caller cannot forge an
 * entitlement, they can at most trigger fulfillment of a real, already-paid
 * session (the desired outcome).
 */
export async function POST(request: Request) {
  const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
  if (!stripeSecretKey) {
    return NextResponse.json({ error: 'Billing is not configured' }, { status: 503 });
  }

  let body: { session_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const sessionId = body.session_id;
  if (!sessionId) {
    return NextResponse.json({ error: 'session_id is required' }, { status: 400 });
  }

  try {
    const Stripe = (await import('stripe')).default;
    const stripe = new Stripe(stripeSecretKey, { apiVersion: '2026-05-27.dahlia' as const });

    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (session.payment_status !== 'paid') {
      return NextResponse.json({
        fulfilled: false,
        reason: 'not_paid',
        payment_status: session.payment_status,
      });
    }

    const userId =
      session.metadata?.userId ?? session.metadata?.user_id ?? null;
    const planId =
      session.metadata?.planId ?? session.metadata?.plan ?? null;
    const customerId =
      typeof session.customer === 'string' ? session.customer : null;

    const result = await grantCheckoutEntitlements({
      sessionId,
      userId,
      planId,
      customerId,
      source: 'backstop',
    });

    return NextResponse.json({ fulfilled: true, ...result });
  } catch (error: unknown) {
    console.error('[checkout/verify] error:', error);
    const err = error as { type?: string; code?: string };
    if (err?.type === 'StripeInvalidRequestError') {
      return NextResponse.json(
        { error: 'Invalid session', code: err?.code },
        { status: 404 }
      );
    }
    return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
  }
}
