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

  // Idempotency — skip if we already processed this event
  if (await hasWebhookEventProcessed(event.id)) {
    console.log(`[stripe-webhook] Duplicate event ignored: ${event.id}`);
    return { received: true, type: event.type, duplicate: true };
  }

  const eventType = event.type as string;

  switch (eventType) {
    // ── V2 Core Account Events (Thin) ───────────────────────────────────────
    case "v2.core.account.capability_status_updated": {
      const accountEvent = (event as unknown as { data: { object: { account: string } } }).data.object;
      const accountId = accountEvent.account;
      console.log(`[stripe-webhook] Capability updated for account: ${accountId}`);
      
      const { setVendorKycStatus } = await import("../db");
      await setVendorKycStatus(accountId, "completed");

      await logAutomationAudit(
        "vendor_kyc_completed",
        {
          eventId: event.id,
          stripeAccountId: accountId,
        }
      );
      break;
    }

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
        await upsertStripeSubscription({
          userId,
          plan,
          status,
          monthlyQuota: getPlanQuota(plan),
          billingCycle,
          stripeCustomerId: customerId ?? null,
          stripeSubscriptionId: sub.id,
          currentPeriodStart: (sub as any).current_period_start
            ? new Date((sub as any).current_period_start * 1000)
            : new Date(),
          currentPeriodEnd: (sub as any).current_period_end
            ? new Date((sub as any).current_period_end * 1000)
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
      const customerId = typeof inv.customer === "string" ? inv.customer : (inv.customer as any)?.id;
      const subscriptionId = typeof (inv as any).subscription === "string"
        ? (inv as any).subscription
        : ((inv as any).subscription as any)?.id;

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

      // Detect plan from invoice line items
      const firstLine = inv.lines?.data?.[0];
      const priceId = (firstLine as any)?.price?.id ?? null;
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
      const customerId = typeof inv.customer === "string" ? inv.customer : (inv.customer as any)?.id;
      const subscriptionId = typeof (inv as any).subscription === "string"
        ? (inv as any).subscription
        : ((inv as any).subscription as any)?.id;

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
      const leadEmail = session.customer_email || session.metadata?.leadEmail;
      const segment = session.metadata?.segment;
      const plan = (session.metadata?.plan as Plan | undefined) ?? (segment === 'API_STARTER' ? 'starter' : 'starter');
      const billingCycle = session.metadata?.billing === "annual" ? "annual" : "monthly";
      const amountCents = session.amount_total ?? 0;
      const amountUsd = amountCents / 100;
      const customerId = typeof session.customer === "string" ? session.customer : undefined;
      const subscriptionId = typeof session.subscription === "string" ? session.subscription : undefined;

      // Record Pilot / Enterprise Revenue
      if (amountUsd > 0) {
        await recordRevenue({
          source: "stripe",
          amount: amountUsd.toFixed(2),
          currency: (session.currency ?? "usd").toUpperCase(),
          type: segment ? "pilot_program" : "subscription",
          userId: userId ?? null,
          metadata: {
            eventId: event.id,
            sessionId: session.id,
            segment,
            leadEmail,
            stripeSubscriptionId: subscriptionId ?? null,
            stripeCustomerId: customerId ?? null,
          },
        });

        // 1. Mark service order as paid + notify customer (idempotent —
        //    no-op if order already past pending). Done before fulfillment
        //    so downstream fulfillment runs on a paid order, not a pending one.
        try {
          const { handleServiceOrderPayment } = await import("../services/order-payment-handler");
          await handleServiceOrderPayment(session);
        } catch (orderErr) {
          console.warn("[ServiceOrder] Mark-paid failed:", orderErr);
        }

        // 2. Trigger Physical Fulfillment Bridge (Security Seals)
        try {
          const { triggerFulfillmentFromPayment } = await import("../fulfillment-service");
          await triggerFulfillmentFromPayment(session.id);
        } catch (fillErr) {
          console.warn("[Fulfillment] Trigger failed:", fillErr);
        }

        // 3. If it's a pilot lead, update status to WON
        if (leadEmail) {
          const { updateLeadStatusByEmail } = await import("../db");
          await updateLeadStatusByEmail(leadEmail, "won");
          
          await logActivity({
            userId: userId ?? null,
            action: 'lead_closed_won',
            entityType: 'lead',
            details: { leadEmail, segment, amountUsd, sessionId: session.id }
          });
        }
      }

      await logAutomationAudit(
        "billing_checkout_completed",
        {
          eventId: event.id,
          userId: userId ?? null,
          plan,
          segment,
          billingCycle,
          amountUsd,
          stripeSubscriptionId: subscriptionId ?? null,
          stripeCustomerId: customerId ?? null,
        },
        userId,
      );

      console.log(`[stripe-webhook] Checkout completed: user=${userId} plan=${plan} segment=${segment} amount=${amountUsd}`);
      break;
    }

    // ── Checkout session expired (abandoned) ─────────────────────────────────
    case "checkout.session.expired": {
      const session = event.data.object as Stripe.Checkout.Session;
      const userId = session.metadata?.user_id
        ? parseInt(session.metadata.user_id, 10)
        : undefined;
      const plan = session.metadata?.plan;
      const email = session.customer_email || session.metadata?.customer_email;

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

      console.log(`[stripe-webhook] Checkout expired/abandoned: user=${userId} plan=${plan}`);
      break;
    }

    default:
      console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
      return { received: true, type: event.type, handled: false };
  }

  return { received: true, type: event.type, handled: true };
}
