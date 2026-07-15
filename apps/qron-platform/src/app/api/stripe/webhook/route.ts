import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  const Stripe = (await import('stripe')).default;
  const stripe = new Stripe(stripeKey, { apiVersion: '2024-06-20' });

  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  let event: any;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error('Stripe webhook signature verification failed:', err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        const userId = session.metadata?.user_id;
        const plan = session.metadata?.plan;
        const customerId = session.customer;
        const subscriptionId = session.subscription;

        if (userId) {
          await supabase.from('profiles').update({
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_plan: plan,
            subscription_status: 'active',
            subscribed_at: new Date().toISOString(),
          }).eq('id', userId);

          await supabase.from('checkout_sessions').update({ status: 'completed' })
            .eq('session_id', session.id);

          // Trigger welcome/confirmation email
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

        const { data: profile } = await supabase
          .from('profiles')
          .select('id, subscription_plan')
          .eq('stripe_customer_id', customerId)
          .single();

        if (profile) {
          await supabase.from('profiles').update({
            subscription_status: 'active',
            last_payment_at: new Date().toISOString(),
          }).eq('id', profile.id);

          await supabase.from('payment_history').insert({
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

        const { data: profile } = await supabase
          .from('profiles')
          .select('id, email:auth.users!id(email)')
          .eq('stripe_customer_id', customerId)
          .single();

        if (profile) {
          await supabase.from('profiles').update({
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

        await supabase.from('profiles').update({
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

        await supabase.from('profiles').update({
          subscription_status: status,
          stripe_subscription_id: subscription.id,
        }).eq('stripe_customer_id', customerId);
        break;
      }

      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object;
        const customerId = subscription.customer;

        const { data: profile } = await supabase
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

    // Log all events
    await supabase.from('stripe_events').insert({
      event_id: event.id,
      event_type: event.type,
      processed_at: new Date().toISOString(),
    }).select();

    return NextResponse.json({ received: true, type: event.type });
  } catch (err: any) {
    console.error('Webhook processing error:', err);
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
