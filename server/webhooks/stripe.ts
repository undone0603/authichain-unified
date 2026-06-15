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

function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  return `${local?.[0] ?? ''}***@${domain}`;
}
import {
  logActivity,
  logAutomationAudit,
  recordRevenue,
  upsertStripeSubscription,
  setSubscriptionStatusByStripeId,
  getSubscriptionByStripeSubscriptionId,
  createSystemNotification,
<<<<<<< HEAD
  hasWebhookEventProcessed,
  getDb,
=======
  claimWebhookEvent,
  markWebhookEventProcessed,
>>>>>>> origin/add-agentz-editable
} from "../db";
import { getPlanQuota, STRIPE_PRODUCTS } from "../stripe-products";
import { handleServiceOrderPayment } from "../services/order-payment-handler";
import { sendEmail } from "../email-service";

// ─── Stripe client (lazy, uses env at call time) ─────────────────────────────

let _stripe: Stripe | null = null;

function getStripeClient(): Stripe {
  if (!_stripe) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) throw new Error("[stripe-webhook] STRIPE_SECRET_KEY not configured");
    _stripe = new Stripe(key, { apiVersion: "2026-04-22.dahlia" as const });
  }
  return _stripe;
}

// ─── Plan detection from price ID or amount ───────────────────────────────────

type Plan = "starter" | "professional" | "enterprise" | "medtech";

function detectPlanFromPriceId(priceId: string | null | undefined): Plan {
  if (!priceId) return "starter";
  const lower = priceId.toLowerCase();
  if (lower.includes("medtech")) return "medtech";
  if (lower.includes("enterprise")) return "enterprise";
  if (lower.includes("professional") || lower.includes("pro")) return "professional";
  if (lower.includes("starter")) return "starter";
  return "starter";
}

function detectPlanFromAmount(amountCents: number, billingCycle?: "monthly" | "annual"): Plan {
  // Normalize to monthly equivalent before comparing against monthly thresholds.
  // Annual amounts: starter=$470 (47000), pro=$1908 (190800), enterprise=$7668 (766800), medtech=$150000 (15000000)
  const monthly = billingCycle === "annual" ? Math.round(amountCents / 12) : amountCents;
  if (monthly >= 1000000) return "medtech"; // $10,000+/mo
  if (monthly >= 70000) return "enterprise";
  if (monthly >= 15000) return "professional";
  return "starter";
}

function detectPlan(
  priceId: string | null | undefined,
  amountCents: number,
  metaPlan?: string | null,
  billingCycle?: "monthly" | "annual",
): Plan {
  // Metadata plan is most reliable (set by checkout session subscription_data.metadata)
  if (metaPlan === "enterprise" || metaPlan === "professional" || metaPlan === "starter" || metaPlan === "medtech") {
    return metaPlan;
  }
  if (priceId) {
    const fromId = detectPlanFromPriceId(priceId);
    if (fromId !== "starter" || priceId.toLowerCase().includes("starter")) return fromId;
  }
  return detectPlanFromAmount(amountCents, billingCycle);
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

<<<<<<< HEAD
  // Idempotency — atomic INSERT into webhook_events; returns true if already processed
  if (await hasWebhookEventProcessed(event.id, event.type, "stripe")) {
=======
  const claimed = await claimWebhookEvent("stripe", event.id, event.type);
  if (!claimed) {
>>>>>>> origin/add-agentz-editable
    console.log(`[stripe-webhook] Duplicate event ignored: ${event.id}`);
    return { received: true, type: event.type, duplicate: true };
  }

  // Mark in-flight immediately so a concurrent duplicate delivery sees it as processed.
  await logActivity({
    userId: null,
    action: "webhook_received",
    entityType: "webhook",
    entityId: 0,
    details: { eventId: event.id, type: event.type },
  });

  switch (event.type) {
    // ── V2 Core Account Events (Thin) ───────────────────────────────────────
    case "v2.core.account.capability_status_updated" as any: {
      const accountEvent = (event as unknown as { data: { object: { account: string } } }).data.object;
      const accountId = accountEvent.account;
      console.log(`[stripe-webhook] Capability updated for account: ${accountId}`);

      try {
        const dbModule = await import("../db") as any;
        if (typeof dbModule.setVendorKycStatus === "function") {
          await dbModule.setVendorKycStatus(accountId, "completed");
        }
      } catch {
        // setVendorKycStatus may not exist in all environments — non-fatal
      }

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
      const sub = event.data.object as Stripe.Subscription & Record<string, any>;
      const customerId = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
      const firstItem = sub.items?.data?.[0];
      const priceId = firstItem?.price?.id ?? null;
      const amountCents = firstItem?.price?.unit_amount ?? 0;
      const billingCycle = firstItem?.price?.recurring?.interval === "year" ? "annual" : "monthly";
      const metaPlan = sub.metadata?.plan ?? null;
      const plan = detectPlan(priceId, amountCents, metaPlan, billingCycle);
      const status = mapStripeStatus(sub.status);
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
<<<<<<< HEAD
          currentPeriodStart: subAny.current_period_start
            ? new Date(subAny.current_period_start * 1000)
            : new Date(),
          currentPeriodEnd: subAny.current_period_end
            ? new Date(subAny.current_period_end * 1000)
=======
          currentPeriodStart: (sub as any).current_period_start
            ? new Date((sub as any).current_period_start * 1000)
            : new Date(),
          currentPeriodEnd: (sub as any).current_period_end
            ? new Date((sub as any).current_period_end * 1000)
>>>>>>> origin/add-agentz-editable
            : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          trialEndsAt: sub.trial_end ? new Date(sub.trial_end * 1000) : null,
        });

        // Send welcome email on new subscription activation
        if (
          event.type === "customer.subscription.created" &&
          (status === "active" || status === "trialing")
        ) {
          try {
            const customer = await stripe.customers.retrieve(customerId!);
            const email = !customer.deleted ? (customer as Stripe.Customer).email ?? null : null;
            const name = !customer.deleted ? ((customer as Stripe.Customer).name ?? "there") : "there";
            if (email) {
              const product = STRIPE_PRODUCTS[plan] ?? STRIPE_PRODUCTS.starter;
              await sendEmail({
                to: email,
                subject: `Welcome to AuthiChain ${product.name}`,
                body: `Hi ${name},\n\nYour AuthiChain ${product.name} subscription is now active.\n\nHere's what you get:\n${product.features.map(f => `• ${f}`).join("\n")}\n\nGet started at https://authichain.com/dashboard\n\nBest,\nThe AuthiChain Team\nhttps://authichain.com`,
                fromName: "AuthiChain",
              });
              console.log(`[stripe-webhook] Welcome email sent to ${maskEmail(email)}`);
            }
          } catch (err) {
            console.warn("[stripe-webhook] Welcome email failed (non-fatal):", err);
          }
        }
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

      // Welcome email — only on first creation.
      if (event.type === "customer.subscription.created") {
        const welcomeTo = sub.metadata?.customer_email
          || (typeof sub.customer !== "string" ? (sub.customer as Stripe.Customer | undefined)?.email : null)
          || null;
        if (welcomeTo) {
          try {
            const { sendEmail } = await import("../email-service");
            const customerName = sub.metadata?.customer_name || "there";
            const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
            await sendEmail({
              to: welcomeTo,
              subject: `Welcome to AuthiChain ${planLabel}`,
              body: [
                `Hi ${customerName},`,
                ``,
                `Your ${planLabel} subscription is now active — welcome to AuthiChain.`,
                ``,
                `Get started:`,
                `  • Add your first product: https://authichain.com/products`,
                `  • Generate a QR authentication code: https://authichain.com/qr`,
                `  • Explore your dashboard: https://authichain.com/dashboard`,
                ``,
                `Reply to this email any time with questions.`,
                ``,
                `— The AuthiChain Team`,
              ].join("\n"),
            });
          } catch (emailErr) {
            console.warn("[stripe-webhook] Welcome email failed (non-fatal):", emailErr);
          }
        }
      }

      // HubSpot deal sync — only on first creation, not updates. Non-fatal:
      // a HubSpot outage must not block billing-state writes.
      if (event.type === "customer.subscription.created") {
        try {
          const customerEmail = sub.metadata?.customer_email
            || (typeof sub.customer === "string" ? null : (sub.customer as Stripe.Customer | undefined)?.email)
            || null;
          if (customerEmail) {
            const { syncPaymentToHubSpot } = await import("../hubspot-service");
            const customerName = sub.metadata?.customer_name || undefined;
            const subscriptionAmount = (firstItem?.price?.unit_amount ?? 0) / 100;
            await syncPaymentToHubSpot({
              email: customerEmail,
              name: customerName,
              amount: subscriptionAmount,
              plan,
            });
          }
        } catch (hsErr) {
          console.warn("[HubSpot] Subscription sync failed (non-fatal):", hsErr);
        }
      }

      console.log(`[stripe-webhook] Subscription ${event.type === "customer.subscription.created" ? "created" : "updated"}: ${sub.id} → plan=${plan} status=${status}`);
      break;
    }

    // ── Subscription deleted (cancelled) ────────────────────────────────────
    case "customer.subscription.deleted": {
      const sub = event.data.object as Stripe.Subscription & Record<string, any>;
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
<<<<<<< HEAD
      const inv = event.data.object as Stripe.Invoice;
      const invAny = inv as any;
      const customerId = typeof inv.customer === "string" ? inv.customer : (inv.customer as any)?.id;
      const subscriptionId = typeof invAny.subscription === "string"
        ? invAny.subscription
        : invAny.subscription?.id ?? null;
=======
      const inv = event.data.object as any;
      const customerId = typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
      const subscriptionId = typeof inv.subscription === "string"
        ? inv.subscription
        : inv.subscription?.id;
>>>>>>> origin/add-agentz-editable

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

<<<<<<< HEAD
      // Detect plan from invoice line items (price field removed from InvoiceLineItem in v22)
      const firstLine = invAny.lines?.data?.[0];
=======
      // Detect plan from invoice line items
      const firstLine = inv.lines?.data?.[0] as any;
>>>>>>> origin/add-agentz-editable
      const priceId = firstLine?.price?.id ?? null;
      const invBillingCycle = firstLine?.price?.recurring?.interval === "year" ? "annual" : "monthly";
      const plan = detectPlan(priceId, amountCents, null, invBillingCycle);

      await Promise.all([
        amountUsd > 0 ? recordRevenue({
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
        }) : Promise.resolve(),
        subscriptionId ? setSubscriptionStatusByStripeId(subscriptionId, "active") : Promise.resolve(),
        logAutomationAudit(
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
        ),
      ]);

      console.log(`[stripe-webhook] Invoice paid: ${inv.id} amount=${amountUsd} ${currency}`);
      break;
    }

    // ── Invoice payment failed ───────────────────────────────────────────────
    case "invoice.payment_failed": {
<<<<<<< HEAD
      const inv = event.data.object as Stripe.Invoice;
      const invAny2 = inv as any;
      const customerId = typeof inv.customer === "string" ? inv.customer : (inv.customer as any)?.id;
      const subscriptionId = typeof invAny2.subscription === "string"
        ? invAny2.subscription
        : invAny2.subscription?.id ?? null;
=======
      const inv = event.data.object as any;
      const customerId = typeof inv.customer === "string" ? inv.customer : inv.customer?.id;
      const subscriptionId = typeof inv.subscription === "string"
        ? inv.subscription
        : inv.subscription?.id;
>>>>>>> origin/add-agentz-editable

      let userId: number | undefined;
      if (subscriptionId) {
        const localSub = await getSubscriptionByStripeSubscriptionId(subscriptionId);
        userId = localSub?.userId ?? undefined;
        await Promise.all([
          setSubscriptionStatusByStripeId(subscriptionId, "past_due"),
          userId ? createSystemNotification(
            userId,
            "Payment Failed",
            "A payment for your AuthiChain subscription failed. Please update your billing details to avoid service interruption.",
            "alert",
            "/subscriptions",
          ) : Promise.resolve(),
        ]);
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

<<<<<<< HEAD
      // Fulfill service orders paid via one-time Stripe Checkout
      const { handleServiceOrderPayment } = await import("../services/order-payment-handler");
      const orderResult = await handleServiceOrderPayment({
        id: session.id,
        payment_intent: session.payment_intent ?? null,
      });
      if (orderResult.handled) {
        console.log(`[stripe-webhook] Service order fulfilled: orderId=${orderResult.orderId}`);
      }

      // ── Proposal payment: mark ACCEPTED, update lead status, send welcome ──
      const leadEmail = session.metadata?.leadEmail;
      const checkoutSessionId = session.id;
      if (leadEmail) {
        try {
          const { proposals, leads } = await import("../../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          const db = await getDb();
          await db.update(proposals)
            .set({ status: "ACCEPTED", acceptedAt: new Date() })
            .where(eq(proposals.checkoutSessionId, checkoutSessionId));
          await db.update(leads)
            .set({ status: "CLOSED_WON", updatedAt: new Date() })
            .where(eq(leads.email, leadEmail.toLowerCase()));
          const { sendEmail } = await import("../email-service");
          await sendEmail({
            to: leadEmail,
            subject: "Welcome to AuthiChain — your pilot is confirmed",
            body: `Hi there,\n\nThank you for your payment — your AuthiChain pilot is confirmed and active.\n\nGet started now: https://authichain.com/dashboard\n\nYour onboarding team will be in touch within 1 business day. In the meantime, you can explore the dashboard and connect your first data source.\n\nWelcome aboard,\nThe AuthiChain Team`,
            fromName: "AuthiChain",
          });
          await logActivity({
            userId: null, action: "proposal_accepted", entityType: "proposal", entityId: 0,
            details: { checkoutSessionId, leadEmail, amountUsd },
          });
          console.log(`[stripe-webhook] Proposal accepted: ${leadEmail} $${amountUsd}`);
        } catch (err: any) {
          console.error(`[stripe-webhook] Proposal accept error:`, err.message);
        }
      }

=======
      // Record Revenue
      if (amountUsd > 0) {
        await recordRevenue({
          source: "stripe",
          amount: amountUsd.toFixed(2),
          currency: (session.currency ?? "usd").toUpperCase(),
          type: "subscription",
          userId: userId ?? null,
          metadata: {
            eventId: event.id,
            sessionId: session.id,
            stripeSubscriptionId: subscriptionId ?? null,
            stripeCustomerId: customerId ?? null,
            brand: session.metadata?.brand ?? null,
            contract: session.metadata?.contract === "true",
            setupOrderId: session.metadata?.setup_order_id ?? null,
          },
        });

        // 1. Mark service order as paid + notify customer
        try {
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

        // 3. Send a payment-confirmation email
        const confirmTo = session.customer_email
          || session.metadata?.customer_email
          || null;
        if (confirmTo) {
          try {
            const customerName = session.metadata?.customer_name || "there";
            const serviceKey = session.metadata?.service_key || session.metadata?.plan || "your purchase";
            const amountStr = `$${amountUsd.toFixed(2)} ${(session.currency ?? "usd").toUpperCase()}`;
            const body = [
              `Hi ${customerName},`,
              ``,
              `Thanks — your payment of ${amountStr} for ${serviceKey} is confirmed.`,
              ``,
              `You can track this order anytime at https://authichain.com/orders.`,
              ``,
              `If you have any questions, just reply to this email.`,
              ``,
              `— The AuthiChain Team`,
            ].join("\n");
            await sendEmail({
              to: confirmTo,
              subject: `Payment confirmed — ${serviceKey}`,
              body,
            });
          } catch (emailErr) {
            console.warn("[Email] Payment confirmation send failed:", emailErr);
          }
        }
      }


>>>>>>> origin/add-agentz-editable
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
          proposalAccepted: !!leadEmail,
        },
        userId,
      );

      if (session.metadata?.type === "one_time_service") {
        await handleServiceOrderPayment({ id: session.id, payment_intent: typeof session.payment_intent === "string" ? session.payment_intent : undefined });
      }

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
        const product = STRIPE_PRODUCTS[plan] ?? STRIPE_PRODUCTS.starter;
        const monthlyPrice = (product.priceMonthly / 100).toFixed(0);
        await sendEmail({
          to: email,
          subject: `You left something behind — complete your AuthiChain ${product.name} setup`,
          body: `Hi ${name},\n\nWe noticed you started setting up AuthiChain ${product.name} ($${monthlyPrice}/mo) but didn't complete checkout.\n\nHere's what you're missing out on:\n${product.features.map(f => `• ${f}`).join("\n")}\n\nReady to pick up where you left off? Visit https://authichain.com/subscriptions to continue.\n\nAs a thank-you for your interest, use code COMEBACK20 at checkout for 20% off your first month.\n\nBest,\nThe AuthiChain Team\nhttps://authichain.com`,
          fromName: "AuthiChain",
        });
        console.log(`[stripe-webhook] Checkout recovery email sent to ${maskEmail(email)}`);
      }

      console.log(`[stripe-webhook] Checkout expired/abandoned: user=${userId} plan=${plan}`);
      break;
    }

    default:
      console.log(`[stripe-webhook] Unhandled event type: ${event.type}`);
      await markWebhookEventProcessed("stripe", event.id);
      return { received: true, type: event.type, handled: false };
  }

  await markWebhookEventProcessed("stripe", event.id);
  return { received: true, type: event.type, handled: true };
}
