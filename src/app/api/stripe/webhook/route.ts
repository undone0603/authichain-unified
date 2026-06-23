import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

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

  let event: any;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error('Stripe webhook signature verification failed:', err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // Idempotency: Stripe retries deliveries. Skip events we've already recorded
  // so commission accrual and other side effects run at most once per event.
  try {
    const { data: seen } = await getSupabase()
      .from('stripe_events')
      .select('event_id')
      .eq('event_id', event.id)
      .maybeSingle();
    if (seen) {
      return NextResponse.json({ received: true, duplicate: true });
    }
  } catch {
    // Dedup check unavailable — fall through and process (at-least-once).
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
          await getSupabase().from('profiles').update({
            stripe_customer_id: customerId,
            stripe_subscription_id: subscriptionId,
            subscription_plan: plan,
            subscription_status: 'active',
            subscribed_at: new Date().toISOString(),
          }).eq('id', userId);

          await getSupabase().from('checkout_sessions').update({ status: 'completed' })
            .eq('session_id', session.id);

          // Trigger welcome/confirmation email
          await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/email`, {
            method: 'POST',
            headers: { 'x-internal-secret': process.env.INTERNAL_API_SECRET || '', 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'subscription_confirmed', user_id: userId, email: session.customer_email, plan }),
          }).catch(() => {});
        }

        // Affiliate commission accrual — credit the referring affiliate's
        // pending_payout when the buyer arrived via an affiliate code.
        // Runs independently of userId (guest checkouts can still be referred).
        const affiliateCode = session.metadata?.affiliate_code;
        if (affiliateCode && typeof session.amount_total === 'number' && session.amount_total > 0) {
          try {
            const { data: aff } = await getSupabase()
              .from('affiliates')
              .select('id, pending_payout, total_referrals, total_conversions, commission_rate, status')
              .eq('affiliatecode', affiliateCode)
              .maybeSingle();

            if (aff && aff.status === 'active') {
              const gross = session.amount_total / 100;
              const rate = Number(aff.commission_rate ?? 0.1);
              const commission = Math.round(gross * rate * 100) / 100;
              if (commission > 0) {
                await getSupabase()
                  .from('affiliates')
                  .update({
                    pending_payout: Number(aff.pending_payout ?? 0) + commission,
                    total_referrals: Number(aff.total_referrals ?? 0) + 1,
                    total_conversions: Number(aff.total_conversions ?? 0) + 1,
                    updated_at: new Date().toISOString(),
                  })
                  .eq('id', aff.id)
                  .eq('pending_payout', aff.pending_payout ?? 0);
              }
            }
          } catch (e) {
            console.error('[webhook] affiliate accrual failed:', e);
          }
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

    // Log all events
    await getSupabase().from('stripe_events').insert({
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
