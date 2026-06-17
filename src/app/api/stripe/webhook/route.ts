export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

// Lazy singletons — avoid build-time throw when env vars are absent.
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
    _stripe = new Stripe(key, { apiVersion: '2026-05-27.dahlia' as const });
  }
  return _stripe;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let _supabase: ReturnType<typeof createClient> | null = null;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function getSupabase(): any {
  if (!_supabase) {
    _supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );
  }
  return _supabase;
}

export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!process.env.STRIPE_SECRET_KEY || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  const stripe = getStripe();

  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let event: any;
  try {
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Stripe webhook signature verification failed:', msg);
    return NextResponse.json({ error: `Webhook Error: ${msg}` }, { status: 400 });
  }

  // SECURITY: Idempotency guard — check if this Stripe event ID has already been
  // processed before taking any action. Stripe can deliver the same event multiple
  // times (retries on non-2xx responses), so without this guard a payment-failed
  // event could flip a user's subscription to past_due more than once, or a
  // checkout.session.completed could grant subscription access multiple times.
  const { data: existingEvent } = await getSupabase()
    .from('stripe_events')
    .select('event_id')
    .eq('event_id', event.id)
    .maybeSingle();

  if (existingEvent) {
    // Already processed — acknowledge to Stripe without re-running business logic
    console.log(`[stripe/webhook] Duplicate event skipped: ${event.id}`);
    return NextResponse.json({ received: true, duplicate: true, type: event.type });
  }

  // Log the event FIRST (before processing) so that if processing throws, a
  // retry from Stripe will hit the idempotency guard above and not double-process.
  await getSupabase().from('stripe_events').insert({
    event_id: event.id,
    event_type: event.type,
    processed_at: new Date().toISOString(),
  });

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.user_id;
        const plan = session.metadata?.plan;
        const customerId = session.customer;
        const subscriptionId = session.subscription;

        if (userId) {
          await getSupabase().from('profiles').update({
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_plan: plan,
            subscription_status: 'active',
            subscribed_at: new Date().toISOString(),
          }).eq('user_id', userId);

          await getSupabase().from('checkout_sessions').update({ status: 'completed' })
            .eq('session_id', session.id);

          await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/email`, {
            method: 'POST',
            headers: { 'x-internal-secret': process.env.INTERNAL_API_SECRET || '', 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'subscription_confirmed', user_id: userId, email: session.customer_email, plan }),
          }).catch(() => {});
        }
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object;
        const customerId = invoice.customer;
        const subscriptionId = invoice.subscription;
        const amountPaid = invoice.amount_paid / 100;

        const { data: profile } = await getSupabase()
          .from('profiles')
          .select('id, subscription_plan')
          .eq('stripe_customer_id', customerId)
          .single();

        if (profile) {
          await getSupabase().from('profiles').update({
            subscription_status: 'active',
            last_payment_at: new Date().toISOString(),
          }).eq('id', profile.id);

          await getSupabase().from('payment_history').insert({
            user_id: profile.id,
            stripe_invoice_id: invoice.id,
            stripe_subscription_id: subscriptionId,
            amount: amountPaid,
            currency: invoice.currency,
            status: 'paid',
            paid_at: new Date().toISOString(),
          });
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object;
        const customerId = invoice.customer;

        const { data: profile } = await getSupabase()
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          .single() as any;

        if (profile) {
          await getSupabase().from('profiles').update({
            subscription_status: 'past_due',
          }).eq('id', profile.id);

          await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/email`, {
            method: 'POST',
            headers: { 'x-internal-secret': process.env.INTERNAL_API_SECRET || '', 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'payment_failed', user_id: profile.id }),
          }).catch(() => {});
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        await getSupabase().from('profiles').update({
          subscription_status: 'cancelled',
          subscription_plan: 'free',
          cancelled_at: new Date().toISOString(),
        }).eq('stripe_customer_id', customerId);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object;
        const customerId = subscription.customer;
        const status = subscription.status;

        await getSupabase().from('profiles').update({
          subscription_status: status,
          stripe_subscription_id: subscription.id,
        }).eq('stripe_customer_id', customerId);
        break;
      }

      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        const { data: profile } = await getSupabase()
          .from('profiles')
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (profile) {
          await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/email`, {
            method: 'POST',
            headers: { 'x-internal-secret': process.env.INTERNAL_API_SECRET || '', 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'trial_expiring', user_id: profile.id }),
          }).catch(() => {});
        }
        break;
      }

      default:
        console.log(`Unhandled Stripe event: ${event.type}`);
    }

    return NextResponse.json({ received: true, type: event.type });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('Webhook processing error:', msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
