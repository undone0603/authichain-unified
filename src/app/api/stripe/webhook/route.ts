export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          user_id: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          subscription_plan: string | null;
          subscription_status: string | null;
          subscribed_at: string | null;
          last_payment_at: string | null;
          cancelled_at: string | null;
        };
        Insert: {
          id?: string;
          user_id?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_plan?: string | null;
          subscription_status?: string | null;
          subscribed_at?: string | null;
          last_payment_at?: string | null;
          cancelled_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          subscription_plan?: string | null;
          subscription_status?: string | null;
          subscribed_at?: string | null;
          last_payment_at?: string | null;
          cancelled_at?: string | null;
        };
      };
      checkout_sessions: {
        Row: { id: number; session_id: string; status: string; user_id: string };
        Insert: { id?: number; session_id: string; status: string; user_id: string };
        Update: { status?: string };
      };
      payment_history: {
        Row: { id: string; user_id: string };
        Insert: {
          user_id: string;
          stripe_invoice_id: string;
          stripe_subscription_id: string | null;
          amount: number;
          currency: string;
          status: string;
          paid_at: string;
        };
      };
      stripe_events: {
        Row: { id: string };
        Insert: { event_id: string; event_type: string; processed_at: string };
      };
    };
  };
}

// Lazy singletons — avoid build-time throw when env vars are absent.
let _stripe: Stripe | null = null;
function getStripe(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error('STRIPE_SECRET_KEY not configured');
    _stripe = new Stripe(key, { apiVersion: '2026-04-22.dahlia' as const });
  }
  return _stripe;
}

let _supabase: SupabaseClient<Database> | null = null;
function getSupabase(): SupabaseClient<Database> {
  if (!_supabase) {
    _supabase = createClient<Database>(
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

  let event: Stripe.Event;
  try {
    // 2. UPDATED: Must use constructEventAsync for Edge compatibility
    event = await stripe.webhooks.constructEventAsync(body, sig, webhookSecret);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Stripe webhook signature verification failed:', message);
    return NextResponse.json({ error: `Webhook Error: ${message}` }, { status: 400 });
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as Stripe.Checkout.Session;
        const userId = session.metadata?.user_id;
        const plan = session.metadata?.plan;
        const customerId = session.customer;
        const subscriptionId = session.subscription;

        if (userId) {
          await (getSupabase().from('profiles') as any).update({
            stripe_customer_id: customerId as string,
            stripe_subscription_id: subscriptionId as string,
            subscription_plan: plan,
            subscription_status: 'active',
            subscribed_at: new Date().toISOString(),
          }).eq('user_id', userId);

          await (getSupabase().from('checkout_sessions') as any).update({ status: 'completed' })
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
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;
        const subscriptionId = (invoice as any).subscription as string;
        const amountPaid = invoice.amount_paid / 100;

        const { data: profile } = await (getSupabase()
          .from('profiles') as any)
          .select('id, subscription_plan')
          .eq('stripe_customer_id', customerId)
          .single();

        if (profile) {
          await (getSupabase().from('profiles') as any).update({
            subscription_status: 'active',
            last_payment_at: new Date().toISOString(),
          }).eq('id', profile.id);

          await (getSupabase().from('payment_history') as any).insert({
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
        const invoice = event.data.object as Stripe.Invoice;
        const customerId = invoice.customer as string;

        const { data: profile } = await (getSupabase()
          .from('profiles') as any)
          .select('id')
          .eq('stripe_customer_id', customerId)
          .single();

        if (profile) {
          await (getSupabase().from('profiles') as any).update({
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
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        await (getSupabase().from('profiles') as any).update({
          subscription_status: 'cancelled',
          subscription_plan: 'free',
          cancelled_at: new Date().toISOString(),
        }).eq('stripe_customer_id', customerId);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;
        const status = subscription.status;

        await (getSupabase().from('profiles') as any).update({
          subscription_status: status,
          stripe_subscription_id: subscription.id,
        }).eq('stripe_customer_id', customerId);
        break;
      }

      case 'customer.subscription.trial_will_end': {
        const subscription = event.data.object as Stripe.Subscription;
        const customerId = subscription.customer as string;

        const { data: profile } = await (getSupabase()
          .from('profiles') as any)
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
    await (getSupabase().from('stripe_events') as any).insert({
      event_id: event.id,
      event_type: event.type,
      processed_at: new Date().toISOString(),
    }).select();

    return NextResponse.json({ received: true, type: event.type });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error('Webhook processing error:', message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
