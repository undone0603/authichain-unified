/**
 * Stripe Webhook Handler — server/webhooks/stripe.ts
 *
 * Provides handleStripeWebhook(rawBody, sig) which:
 *  1. Verifies the Stripe signature using STRIPE_WEBHOOK_SECRET
 *  2. Handles key lifecycle events and writes to activity_log and revenue_records
 *  3. Updates subscription status in the subscriptions table
 *
 * This module is intentionally side-effect-free at import time so it can be
 * loaded by the main server and imported by tests without starting Stripe.
 *
 * Route registration (POST /webhooks/stripe) lives in server/_core/index.ts.
 * The existing /api/stripe/webhook route remains unchanged for backwards compat.
 */

import Stripe from "stripe";
import {
  logActivity,
  logAutomationAudit,
  recordRevenue,
  upsertStripeSubscription,
  setSubscriptionStatusByStripeId,
  getSubscriptionByStripeSubscriptionId,
  createSystemNotification,
  hasWebhookEventProcessed,
} from "../db";
import { getPlanQuota } from "../stripe-products";

// ─── Stripe client (lazy, uses env at call time) ─────────────────────────────

let _stripe: Stripe | null = null;

function getStripeClient(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("[stripe-webhook] STRIPE_SECRET_KEY not configured");
    _stripe = new Stripe(key, { apiVersion: "2025-03-31.basil" as any });
  }
  return _stripe;
}

// ─── Plan detection from price ID or amount ───────────────────────────────────

type Plan = "starter" | "professional" | "enterprise";

function detectPlanFromPriceId(priceId: string | null | undefined): Plan {
  if (!priceId) return "starter";
  const lower = priceId.toLowerCase();
  if (lower.includes("enterprise")) return "enterprise";
  if (lower.includes("professional") || lower.includes("pro")) return "professional";
  if (lower.includes("starter")) return "starter";
  return "starter";
}

function detectPlanFromAmount(amountCents: number): Plan {
  // $799/mo = 79900, $199/mo = 19900, $49/mo = 4900
  // Also handle annual pricing which is higher
  if (amountCents >= 70000) return "enterprise";
  if (amountCents >= 15000) return "professional";
  return "starter";
}

function detectPlan(priceId: string | null | undefined, amountCents: number): Plan {
  if (priceId) {
    const fromId = detectPlanFromPriceId(priceId);
    // If we got a non-default answer from the price ID, trust it
    if (fromId !== "starter" || priceId.toLowerCase().includes("starter")) return fromId;
  }
  return detectPlanFromAmount(amountCents);
}

// ─── Stripe → internal status mapping ────────────────────────────────────────

type SubscriptionStatus = "active" | "cancelled" | "past_due" | "trialing" | "paused";

function mapStripeStatus(s: Stripe.Subscription.Status): SubscriptionStatus {
  switch (s) {
    case "active":   return "active";
    case "trialing": return "trialing";
    case "past_due": return "past_due";
    case "canceled":
    case "unpaid":
    case "incomplete_expired": return "cancelled";
    case "incomplete": return "past_due";
    case "paused":   return "paused";
    default:         return "active";
  }
}

// ─── Helper: resolve userId from subscription or customer metadata ─────────

async function resolveUserId(
  stripe: Stripe,
  customerId: string | null | undefined,
  subscriptionMeta?: Stripe.Metadata | null,
): Promise<number | undefined> {
  if (subscriptionMeta?.user_id) {
    const id = parseInt(subscriptionMeta.user_id, 10);
    if (!isNaN(id)) return id;
  }
  if (!customerId) return undefined;
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (!customer.deleted && (customer as Stripe.Customer).metadata?.user_id) {
      const id = parseInt((customer as Stripe.Customer).metadata.user_id, 10);
      if (!isNaN(id)) return id;
    }
  } catch {
    // Best-effort; return undefined
  }
  return undefined;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

export interface StripeWebhookResult {
  received: boolean;
  type: string;
  duplicate?: boolean;
  handled?: boolean;
  error?: string;
}

export async function handleStripeWebhook(
  rawBody: Buffer,
  sig: string,
): Promise<StripeWebhookResult> {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error("[stripe-webhook] STRIPE_WEBHOOK_SECRET not configured");
  }

  const stripe = getStripeClient();
  const event = stripe.webhooks.constructEvent(rawBody, sig, webhookSecret);

  console.log(`[stripe-webhook] Received: ${event.type} (${event.id})`);

  // Allow test verification events through without idempotency check
  if (event.id.startsWith("evt_test_")) {
    console.log("[stripe-webhook] Test event, returning verified");
    return { received: true, type: event.type };
  }

  // Idempotency — atomic INSERT into webhook_events; returns true if already processed
  if (await hasWebhookEventProcessed(event.id, event.type, "stripe")) {
    console.log(`[stripe-webhook] Duplicate event ignored: ${event.id}`);
    return { received: true, type: event.type, duplicate: true };
  }

  switch (event.type) {
    // ── Subscription created / updated ──────────────────────────────────────
    case "customer.subscription.created":
    case "customer.subscription.updated": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
      const firstItem = sub.items?.data?.[0];
      const priceId = firstItem?.price?.id ?? null;
      const amountCents = firstItem?.price?.unit_amount ?? 0;
      const plan = detectPlan(priceId, amountCents);
      const status = mapStripeStatus(sub.status);
      const billingCycle = firstItem?.price?.recurring?.interval === "year" ? "annual" : "monthly";
      const userId = await resolveUserId(stripe, customerId, sub.metadata);

      if (userId) {
        // current_period_start/end removed from Stripe v22 types but still
        // present in the API payload; cast through any.
        const subAny = sub as any;
        await upsertStripeSubscription({
          userId,
          plan,
          status,
          monthlyQuota: getPlanQuota(plan),
          billingCycle,
          stripeCustomerId: customerId ?? null,
          stripeSubscriptionId: sub.id,
          currentPeriodStart: subAny.current_period_start
            ? new Date(subAny.current_period_start * 1000)
            : new Date(),
          currentPeriodEnd: subAny.current_period_end
            ? new Date(subAny.current_period_end * 1000)
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
        });
      }

      await logAutomationAudit(
        event.type === "customer.subscription.created"
          ? "billing_subscription_created"
          : "billing_subscription_updated",
        {
          eventId: event.id,
          stripeSubscriptionId: sub.id,
          stripeCustomerId: customerId ?? null,
          plan,
          status,
          billingCycle,
          userId: userId ?? null,
        },
        userId,
      );

      console.log(`[stripe-webhook] Subscription ${event.type === "customer.subscription.created" ? "created" : "updated"}: ${sub.id} → plan=${plan} status=${status}`);
      break;
    }

    // ── Subscription deleted (cancelled) ────────────────────────────────────
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
      const userId = await resolveUserId(stripe, customerId, sub.metadata);

      await setSubscriptionStatusByStripeId(sub.id, "cancelled", new Date());

      await logAutomationAudit(
        "billing_subscription_cancelled",
        {
          eventId: event.id,
          stripeSubscriptionId: sub.id,
          stripeCustomerId: customerId ?? null,
          userId: userId ?? null,
        },
        userId,
      );

      console.log(`[stripe-webhook] Subscription cancelled: ${sub.id}`);
      break;
    }

    // ── Invoice payment succeeded ────────────────────────────────────────────
    case "invoice.payment_succeeded":
    case "invoice.paid": {
      const inv = event.data.object as Stripe.Invoice;
      const invAny = inv as any;
      const customerId = typeof inv.customer === "string" ? inv.customer : (inv.customer as any)?.id;
      const subscriptionId = typeof invAny.subscription === "string"
        ? invAny.subscription
        : invAny.subscription?.id ?? null;

      // Resolve userId — try subscription metadata first, then customer
      let userId: number | undefined;
      if (subscriptionId) {
        const localSub = await getSubscriptionByStripeSubscriptionId(subscriptionId);
        userId = localSub?.userId ?? undefined;
      }
      if (!userId) {
        userId = await resolveUserId(stripe, customerId);
      }

      const amountCents = inv.amount_paid ?? 0;
      const amountUsd = amountCents / 100;
      const currency = (inv.currency ?? "usd").toUpperCase();

      // Detect plan from invoice line items (price field removed from InvoiceLineItem in v22)
      const firstLine = invAny.lines?.data?.[0];
      const priceId = firstLine?.price?.id ?? null;
      const plan = detectPlan(priceId, amountCents);

      if (amountUsd > 0) {
        await recordRevenue({
          source: "stripe",
          amount: amountUsd.toFixed(2),
          currency,
          type: "subscription",
          userId: userId ?? null,
          metadata: {
            eventId: event.id,
            invoiceId: inv.id,
            stripeSubscriptionId: subscriptionId ?? null,
            stripeCustomerId: customerId ?? null,
            plan,
          },
        });
      }

      // Mark subscription active on successful payment (handles recovery from past_due)
      if (subscriptionId) {
        await setSubscriptionStatusByStripeId(subscriptionId, "active");
      }

      await logAutomationAudit(
        "billing_invoice_paid",
        {
          eventId: event.id,
          invoiceId: inv.id,
          stripeSubscriptionId: subscriptionId ?? null,
          stripeCustomerId: customerId ?? null,
          amountUsd,
          currency,
          plan,
          userId: userId ?? null,
        },
        userId,
      );

      console.log(`[stripe-webhook] Invoice paid: ${inv.id} amount=${amountUsd} ${currency}`);
      break;
    }

    // ── Invoice payment failed ───────────────────────────────────────────────
    case "invoice.payment_failed": {
      const inv = event.data.object as Stripe.Invoice;
      const invAny2 = inv as any;
      const customerId = typeof inv.customer === "string" ? inv.customer : (inv.customer as any)?.id;
      const subscriptionId = typeof invAny2.subscription === "string"
        ? invAny2.subscription
        : invAny2.subscription?.id ?? null;

      let userId: number | undefined;
      if (subscriptionId) {
        const localSub = await getSubscriptionByStripeSubscriptionId(subscriptionId);
        userId = localSub?.userId ?? undefined;
        await setSubscriptionStatusByStripeId(subscriptionId, "past_due");

        if (userId) {
          await createSystemNotification(
            userId,
            "Payment Failed",
            "A payment for your AuthiChain subscription failed. Please update your billing details to avoid service interruption.",
            "alert",
            "/subscriptions",
          );
        }
      }

      await logAutomationAudit(
        "billing_dunning_started",
        {
          eventId: event.id,
          invoiceId: inv.id,
          stripeSubscriptionId: subscriptionId ?? null,
          stripeCustomerId: customerId ?? null,
          attemptCount: (inv as any).attempt_count ?? 1,
          dunningStep: "day_0",
          userId: userId ?? null,
        },
        userId,
      );

      console.log(`[stripe-webhook] Payment failed: invoice=${inv.id} sub=${subscriptionId}`);
      break;
    }

    // ── Checkout session completed ───────────────────────────────────────────
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id
        ? parseInt(session.metadata.user_id, 10)
        : undefined;
      const plan = (session.metadata?.plan as Plan | undefined) ?? "starter";
      const billingCycle = session.metadata?.billing === "annual" ? "annual" : "monthly";
      const amountCents = session.amount_total ?? 0;
      const amountUsd = amountCents / 100;
      const customerId = typeof session.customer === "string" ? session.customer : undefined;
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : undefined;

      // Fulfill service orders paid via one-time Stripe Checkout
      const { handleServiceOrderPayment } = await import("../services/order-payment-handler");
      const orderResult = await handleServiceOrderPayment({
        id: session.id,
        payment_intent: session.payment_intent ?? null,
      });
      if (orderResult.handled) {
        console.log(`[stripe-webhook] Service order fulfilled: orderId=${orderResult.orderId}`);
      }

      await logAutomationAudit(
        "billing_checkout_completed",
        {
          eventId: event.id,
          userId: userId ?? null,
          plan,
          billingCycle,
          amountUsd,
          stripeSubscriptionId: subscriptionId ?? null,
          stripeCustomerId: customerId ?? null,
          serviceOrderFulfilled: orderResult.handled ? orderResult.orderId : null,
        },
        userId,
      );

      console.log(`[stripe-webhook] Checkout completed: user=${userId} plan=${plan}`);
      break;
    }

    // ── Checkout session expired (abandoned) ─────────────────────────────────
    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id
        ? parseInt(session.metadata.user_id, 10)
        : undefined;
      const plan = (session.metadata?.plan as Plan | undefined) ?? "starter";
      const email = session.customer_email || session.metadata?.customer_email;
      const name = session.metadata?.customer_name || "there";

      await logAutomationAudit(
        "checkout_abandoned",
        {
          eventId: event.id,
          userId: userId ?? null,
          plan: plan ?? null,
          email: email ?? null,
        },
        userId,
      );

      if (email) {
        const { sendEmail } = await import("../email-service");
        const { STRIPE_PRODUCTS } = await import("../stripe-products");
        const product = STRIPE_PRODUCTS[plan] ?? STRIPE_PRODUCTS.starter;
        const monthlyPrice = (product.priceMonthly / 100).toFixed(0);
        await sendEmail({
          to: email,
          subject: `You left something behind — complete your AuthiChain ${product.name} setup`,
          body: `Hi ${name},\n\nWe noticed you started setting up AuthiChain ${product.name} ($${monthlyPrice}/mo) but didn't complete checkout.\n\nHere's what you're missing out on:\n${product.features.map(f => `• ${f}`).join("\n")}\n\nReady to pick up where you left off? Visit https://authichain.com/subscriptions to continue.\n\nAs a thank-you for your interest, use code COMEBACK20 at checkout for 20% off your first month.\n\nBest,\nThe AuthiChain Team\nhttps://authichain.com`,
          fromName: "AuthiChain",
        });
        console.log(`[stripe-webhook] Checkout recovery email sent to ${email}`);
      }

      console.log(`[stripe-webhook] Checkout expired/abandoned: user=${userId} plan=${plan}`);
      break;
    }

    default:
      console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
      return { received: true, type: event.type, handled: false };
  }

  return { received: true, type: event.type, handled: true };
}
