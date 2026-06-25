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

/**
 * POST /api/webhooks/stripe
 *
 * Stripe webhook handler for:
 * - checkout.session.completed: Record payment, tag lead as customer
 * - invoice.payment_succeeded: Update subscription status
 * - invoice.payment_failed: Alert sales team, update subscription status
 * - customer.subscription.deleted: Cancel subscription
 *
 * Validates webhook signature using STRIPE_WEBHOOK_AUTHICHAIN_SECRET.
 * Deduplicates via stripe_events table (Stripe retries, we process once).
 * Logs all events to audit_log for compliance.
 */
export async function POST(req: NextRequest) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_AUTHICHAIN_SECRET;

  if (!process.env.STRIPE_SECRET_KEY || !webhookSecret) {
    console.error('[stripe-webhook] Missing STRIPE_SECRET_KEY or STRIPE_WEBHOOK_AUTHICHAIN_SECRET');
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 500 });
  }

  const stripe = getStripe();
  const supabase = getSupabase();

  const body = await req.text();
  const sig = req.headers.get('stripe-signature')!;

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, webhookSecret);
  } catch (err: any) {
    console.error('[stripe-webhook] Signature verification failed:', err.message);
    return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
  }

  // Idempotency: Stripe retries deliveries with exponential backoff.
  // Skip events we've already recorded to ensure side effects run at most once.
  try {
    const { data: seen } = await supabase
      .from('stripe_events')
      .select('event_id')
      .eq('event_id', event.id)
      .maybeSingle();

    if (seen) {
      console.log(`[stripe-webhook] Duplicate event ${event.id}, skipping`);
      // Log dedup attempt to audit
      await logAuditEvent(supabase, event.type, event.id, 'duplicate', {
        duplicate: true,
      });
      return NextResponse.json({ received: true, duplicate: true });
    }
  } catch (err) {
    // Dedup check unavailable — fall through and process (at-least-once).
    console.warn('[stripe-webhook] Dedup check unavailable, proceeding:', err);
  }

  try {
    switch (event.type) {
      case 'checkout.session.completed': {
        await handleCheckoutSessionCompleted(supabase, event);
        break;
      }

      case 'invoice.payment_succeeded': {
        await handleInvoicePaymentSucceeded(supabase, event);
        break;
      }

      case 'invoice.payment_failed': {
        await handleInvoicePaymentFailed(supabase, event);
        break;
      }

      case 'customer.subscription.deleted': {
        await handleCustomerSubscriptionDeleted(supabase, event);
        break;
      }

      default:
        console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
    }

    // Record event as processed (idempotency guard)
    await supabase.from('stripe_events').insert({
      event_id: event.id,
      event_type: event.type,
      processed_at: new Date().toISOString(),
    });

    // Log success to audit_log
    await logAuditEvent(supabase, event.type, event.id, 'success', {});

    return NextResponse.json({ received: true, type: event.type });
  } catch (err: any) {
    console.error('[stripe-webhook] Processing error:', err);

    // Log failure to audit_log
    await logAuditEvent(supabase, event.type, event.id, 'error', {
      error: err.message,
      stack: err.stack?.split('\n').slice(0, 3).join('\n'),
    }).catch(() => {});

    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

/**
 * Handle checkout.session.completed
 * - Record payment in payments table (session_id, customer_email, amount, status='paid')
 * - Tag lead as customer in lead_captures (status='customer')
 */
async function handleCheckoutSessionCompleted(supabase: any, event: Stripe.Event) {
  const session = event.data.object as Stripe.Checkout.Session;

  const sessionId = session.id;
  const customerEmail = session.customer_email;
  const amountCents = session.amount_total || 0;
  const currency = session.currency || 'usd';

  console.log(`[stripe-webhook] checkout.session.completed: ${sessionId}, email: ${customerEmail}, amount: ${amountCents}`);

  if (!customerEmail) {
    console.warn(`[stripe-webhook] No customer_email in checkout session ${sessionId}`);
    return;
  }

  // Record payment
  const { error: paymentError } = await supabase.from('payments').insert({
    session_id: sessionId,
    customer_email: customerEmail,
    amount_cents: amountCents,
    currency,
    status: 'paid',
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  if (paymentError) {
    console.error('[stripe-webhook] Failed to insert payment:', paymentError);
    throw paymentError;
  }

  console.log(`[stripe-webhook] Payment recorded for ${customerEmail}`);

  // Tag lead as customer (match by email)
  const { error: updateError } = await supabase
    .from('lead_captures')
    .update({
      status: 'customer',
      updated_at: new Date().toISOString(),
    })
    .eq('email', customerEmail);

  if (updateError) {
    console.error('[stripe-webhook] Failed to update lead status:', updateError);
    // Don't throw — payment is recorded, lead tagging is supplementary
  } else {
    console.log(`[stripe-webhook] Lead tagged as customer: ${customerEmail}`);
  }
}

/**
 * Handle invoice.payment_succeeded
 * - Update subscriptions table (status='active', next_billing_date)
 */
async function handleInvoicePaymentSucceeded(supabase: any, event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;

  const customerId = invoice.customer as string;
  // Stripe SDK v18 removed `subscription` from the top-level Invoice type
  // (it now lives on invoice lines / parent), but the field is still present
  // on the wire for subscription invoices. Read it defensively via a cast.
  const subscriptionId = (invoice as unknown as { subscription?: string }).subscription as string;
  const periodEndTs = invoice.period_end;

  console.log(`[stripe-webhook] invoice.payment_succeeded: ${invoice.id}, subscription: ${subscriptionId}`);

  if (!subscriptionId) {
    console.warn(`[stripe-webhook] No subscription_id in invoice ${invoice.id}`);
    return;
  }

  // Calculate next billing date from period_end
  const nextBillingDate = new Date(periodEndTs * 1000).toISOString();

  // First, fetch subscription to get customer email
  const { data: subscriptionData, error: fetchError } = await supabase
    .from('subscriptions')
    .select('customer_email')
    .eq('subscription_id', subscriptionId)
    .maybeSingle();

  if (fetchError) {
    console.error('[stripe-webhook] Failed to fetch subscription:', fetchError);
    throw fetchError;
  }

  // If subscription doesn't exist yet (first payment), use customer_id
  // This will be handled by the Stripe API call to get customer email
  let customerEmail = subscriptionData?.customer_email;

  if (!customerEmail && customerId) {
    // Fetch customer from Stripe to get email
    try {
      const stripe = getStripe();
      const customer = await stripe.customers.retrieve(customerId);
      customerEmail = (customer as Stripe.Customer).email || undefined;
    } catch (err) {
      console.error('[stripe-webhook] Failed to fetch Stripe customer:', err);
    }
  }

  if (!customerEmail) {
    console.warn(`[stripe-webhook] No customer email found for subscription ${subscriptionId}`);
    // Still update subscription if we have it
  }

  // Update subscription status
  const { error: updateError } = await supabase
    .from('subscriptions')
    .update({
      status: 'active',
      next_billing_date: nextBillingDate,
      updated_at: new Date().toISOString(),
    })
    .eq('subscription_id', subscriptionId);

  if (updateError && updateError.code !== 'PGRST116') {
    // PGRST116 = no rows matched (subscription doesn't exist yet — insert it)
    if (updateError.code !== 'PGRST116') {
      console.error('[stripe-webhook] Failed to update subscription:', updateError);
      throw updateError;
    }
  }

  // If subscription didn't exist, insert it
  if (updateError?.code === 'PGRST116' && customerEmail) {
    const { error: insertError } = await supabase.from('subscriptions').insert({
      subscription_id: subscriptionId,
      customer_email: customerEmail,
      product_id: null, // Will be populated from Stripe metadata if needed
      status: 'active',
      next_billing_date: nextBillingDate,
      canceled_at: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });

    if (insertError) {
      console.error('[stripe-webhook] Failed to insert subscription:', insertError);
      throw insertError;
    }

    console.log(`[stripe-webhook] Subscription created: ${subscriptionId}`);
  } else {
    console.log(`[stripe-webhook] Subscription updated: ${subscriptionId}`);
  }
}

/**
 * Handle invoice.payment_failed
 * - Update subscriptions table (status='payment_failed')
 * - Insert alert for sales team
 */
async function handleInvoicePaymentFailed(supabase: any, event: Stripe.Event) {
  const invoice = event.data.object as Stripe.Invoice;

  const customerId = invoice.customer as string;
  // See note above: read `subscription` defensively across Stripe SDK v18.
  const subscriptionId = (invoice as unknown as { subscription?: string }).subscription as string;
  const invoiceId = invoice.id;

  console.log(`[stripe-webhook] invoice.payment_failed: ${invoiceId}, subscription: ${subscriptionId}`);

  if (!subscriptionId) {
    console.warn(`[stripe-webhook] No subscription_id in invoice ${invoiceId}`);
    return;
  }

  // Fetch customer email
  let customerEmail = '';
  try {
    const stripe = getStripe();
    const customer = await stripe.customers.retrieve(customerId);
    customerEmail = (customer as Stripe.Customer).email || '';
  } catch (err) {
    console.error('[stripe-webhook] Failed to fetch Stripe customer:', err);
  }

  // Update subscription status
  const { error: updateError } = await supabase
    .from('subscriptions')
    .update({
      status: 'payment_failed',
      updated_at: new Date().toISOString(),
    })
    .eq('subscription_id', subscriptionId);

  if (updateError && updateError.code !== 'PGRST116') {
    console.error('[stripe-webhook] Failed to update subscription:', updateError);
    throw updateError;
  }

  // Insert alert for sales team
  const { error: alertError } = await supabase.from('alerts').insert({
    type: 'payment_failed',
    message: `Payment failed for subscription ${subscriptionId}. Invoice: ${invoiceId}`,
    customer_email: customerEmail,
    metadata: {
      invoice_id: invoiceId,
      subscription_id: subscriptionId,
      customer_id: customerId,
    },
    created_at: new Date().toISOString(),
  });

  if (alertError) {
    console.error('[stripe-webhook] Failed to insert alert:', alertError);
    throw alertError;
  }

  console.log(`[stripe-webhook] Alert created for failed payment: ${invoiceId}`);
}

/**
 * Handle customer.subscription.deleted
 * - Update subscriptions table (status='canceled', canceled_at)
 */
async function handleCustomerSubscriptionDeleted(supabase: any, event: Stripe.Event) {
  const subscription = event.data.object as Stripe.Subscription;

  const subscriptionId = subscription.id;
  const canceledAtTs = subscription.canceled_at;

  console.log(`[stripe-webhook] customer.subscription.deleted: ${subscriptionId}`);

  const canceledAt = canceledAtTs
    ? new Date(canceledAtTs * 1000).toISOString()
    : new Date().toISOString();

  // Update subscription status
  const { error: updateError } = await supabase
    .from('subscriptions')
    .update({
      status: 'canceled',
      canceled_at: canceledAt,
      updated_at: new Date().toISOString(),
    })
    .eq('subscription_id', subscriptionId);

  if (updateError && updateError.code !== 'PGRST116') {
    console.error('[stripe-webhook] Failed to update subscription:', updateError);
    throw updateError;
  }

  console.log(`[stripe-webhook] Subscription canceled: ${subscriptionId}`);
}

/**
 * Log event to audit_log table for compliance and debugging
 */
async function logAuditEvent(
  supabase: any,
  eventType: string,
  eventId: string,
  status: 'success' | 'error' | 'duplicate',
  payload: any,
) {
  try {
    await supabase.from('audit_log').insert({
      event_type: `stripe_webhook.${eventType}`,
      event_id: eventId,
      status,
      payload: JSON.stringify(payload),
      created_at: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[stripe-webhook] Failed to log to audit_log:', err);
    // Don't throw — audit logging is supplementary
  }
}
