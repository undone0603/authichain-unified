/**
 * AuthiChain Stripe Service
 * Handles checkout sessions, subscription management, and webhook processing
 */
import Stripe from "stripe";
import { STRIPE_PRODUCTS, type PlanKey, getPlanQuota } from "./stripe-products";
import { ENV } from "./_core/env";
import { safeOrigin } from "./_core/allowed-origins";

let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    const secretKey = ENV.stripeSecretKey;
    if (!secretKey) throw new Error("STRIPE_SECRET_KEY not configured");
    _stripe = new Stripe(secretKey, { apiVersion: "2026-05-27.dahlia" as const });
  }
  return _stripe;
}

// ─── Checkout Session Creation ──────────────────────────────────────────────

export interface CreateCheckoutParams {
  userId: number;
  userEmail: string;
  userName: string;
  plan: PlanKey;
  billing: "monthly" | "annual";
  origin: string;
  stripeCustomerId?: string;
  trialDays?: number;
  brand?: string;
  contractSetupOrderId?: string;
}

export async function createSubscriptionCheckout(params: CreateCheckoutParams): Promise<string> {
  const stripe = getStripe();
  const product = STRIPE_PRODUCTS[params.plan];
  const priceAmount = params.billing === "annual"
    ? product.priceAnnual
    : product.priceMonthly;

  const sharedMeta: Record<string, string> = {
    user_id: params.userId.toString(),
    customer_email: params.userEmail,
    customer_name: params.userName,
    plan: params.plan,
    billing: params.billing,
    ...(params.brand ? { brand: params.brand } : {}),
    ...(params.contractSetupOrderId
      ? { contract: "true", setup_order_id: params.contractSetupOrderId }
      : {}),
  };

  const sessionConfig: Stripe.Checkout.SessionCreateParams = {
    mode: "subscription",
    payment_method_types: ["card"],
    allow_promotion_codes: true,
    client_reference_id: params.userId.toString(),
    customer_email: params.stripeCustomerId ? undefined : params.userEmail,
    customer: params.stripeCustomerId || undefined,
    metadata: sharedMeta,
    // Propagate user_id onto the Subscription object so lifecycle events
    // (created, updated, deleted, invoice.payment_failed) can resolve userId
    // without a separate customer lookup.
    subscription_data: {
      metadata: sharedMeta,
      ...(params.trialDays ? { trial_period_days: params.trialDays } : {}),
    },
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: product.name,
            description: product.description,
          },
          unit_amount: priceAmount,
          recurring: {
            interval: params.billing === "annual" ? "year" : "month",
          },
        },
        quantity: 1,
      },
    ],
    success_url: `${safeOrigin(params.origin)}/subscriptions?session_id={CHECKOUT_SESSION_ID}&success=true`,
    cancel_url: `${safeOrigin(params.origin)}/subscriptions?cancelled=true`,
  };

  const session = await stripe.checkout.sessions.create(sessionConfig);
  return session.url!;
}

// ─── One-time Payment Checkout ──────────────────────────────────────────────

export interface CreatePaymentCheckoutParams {
  userId: number;
  userEmail: string;
  userName: string;
  description: string;
  amount: number; // in cents
  origin: string;
  stripeCustomerId?: string;
  metadata?: Record<string, string>;
}

export async function createPaymentCheckout(params: CreatePaymentCheckoutParams): Promise<{ url: string; sessionId: string }> {
  const stripe = getStripe();

  const session = await stripe.checkout.sessions.create({
    mode: "payment",
    payment_method_types: ["card"],
    allow_promotion_codes: true,
    client_reference_id: params.userId.toString(),
    customer_email: params.stripeCustomerId ? undefined : params.userEmail,
    customer: params.stripeCustomerId || undefined,
    metadata: {
      user_id: params.userId.toString(),
      customer_email: params.userEmail,
      customer_name: params.userName,
      ...params.metadata,
    },
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: params.description,
          },
          unit_amount: params.amount,
        },
        quantity: 1,
      },
    ],
    success_url: `${safeOrigin(params.origin)}/payments?session_id={CHECKOUT_SESSION_ID}&success=true`,
    cancel_url: `${safeOrigin(params.origin)}/payments?cancelled=true`,
  });

  return { url: session.url!, sessionId: session.id };
}

// ─── Customer Management ────────────────────────────────────────────────────

export async function getOrCreateStripeCustomer(
  userId: number,
  email: string,
  name: string,
  existingCustomerId?: string
): Promise<string> {
  const stripe = getStripe();

  if (existingCustomerId) {
    try {
      const customer = await stripe.customers.retrieve(existingCustomerId);
      if (!customer.deleted) return existingCustomerId;
    } catch {
      // Customer doesn't exist, create new
    }
  }

  const customer = await stripe.customers.create({
    email,
    name,
    metadata: { user_id: userId.toString() },
  });

  return customer.id;
}

// ─── Subscription Management ────────────────────────────────────────────────

export async function getSubscriptionDetails(subscriptionId: string) {
  const stripe = getStripe();
  return await stripe.subscriptions.retrieve(subscriptionId);
}

export async function cancelSubscription(subscriptionId: string, immediately = false) {
  const stripe = getStripe();
  if (immediately) {
    return await stripe.subscriptions.cancel(subscriptionId);
  }
  return await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

// ─── Payment History ────────────────────────────────────────────────────────

export async function getCustomerPayments(customerId: string, limit = 20) {
  const stripe = getStripe();
  const charges = await stripe.charges.list({
    customer: customerId,
    limit,
  });
  return charges.data.map((charge: any) => ({
    id: charge.id,
    amount: charge.amount,
    currency: charge.currency,
    status: charge.status,
    description: charge.description,
    created: charge.created,
    receiptUrl: charge.receipt_url,
  }));
}

export async function getCustomerInvoices(customerId: string, limit = 20) {
  const stripe = getStripe();
  const invoices = await stripe.invoices.list({
    customer: customerId,
    limit,
  });
  return invoices.data.map((inv: any) => ({
    id: inv.id,
    number: inv.number,
    amount: inv.amount_due,
    currency: inv.currency,
    status: inv.status,
    created: inv.created,
    hostedInvoiceUrl: inv.hosted_invoice_url,
    pdfUrl: inv.invoice_pdf,
  }));
}

// ─── Webhook Processing ────────────────────────────────────────────────────

export interface WebhookResult {
  eventType: string;
  handled: boolean;
  userId?: number;
  plan?: string;
  subscriptionId?: string;
  customerId?: string;
  email?: string;
  customerName?: string;
}

export async function processWebhookEvent(event: Stripe.Event): Promise<WebhookResult> {
  const result: WebhookResult = {
    eventType: event.type,
    handled: false,
  };

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      result.userId = session.metadata?.user_id ? parseInt(session.metadata.user_id) : undefined;
      result.plan = session.metadata?.plan;
      result.subscriptionId = session.subscription as string;
      result.customerId = session.customer as string;
      result.email = session.customer_email || session.metadata?.customer_email || undefined;
      result.customerName = session.metadata?.customer_name || undefined;
      result.handled = true;
      break;
    }

    case "customer.subscription.updated": {
      const subscription = event.data.object as Stripe.Subscription;
      result.subscriptionId = subscription.id;
      result.customerId = subscription.customer as string;
      result.handled = true;
      break;
    }

    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      result.subscriptionId = subscription.id;
      result.customerId = subscription.customer as string;
      result.handled = true;
      break;
    }

    case "invoice.paid": {
      const invoice = event.data.object as any;
      result.customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      result.subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
      result.handled = true;
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as any;
      result.customerId = typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
      result.subscriptionId = typeof invoice.subscription === "string" ? invoice.subscription : invoice.subscription?.id;
      result.handled = true;
      break;
    }

    default:
      result.handled = false;
  }

  return result;
}
