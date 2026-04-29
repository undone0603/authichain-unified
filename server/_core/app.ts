import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { createInternalRouter } from "../internal-api";
import { brandMiddleware } from "./brand-middleware";

/**
 * Creates and configures the Express app without binding to a port.
 * Used by the standalone server (index.ts) AND the Vercel serverless function (api/server.ts).
 */
export function createApp() {
  const app = express();

  // ─── Brand detection (Host → res.locals.brand + X-Brand header) ──────────
  app.use(brandMiddleware);

  // ─── Stripe Webhook (MUST be before express.json()) ───────────────────────
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      console.error("[Stripe Webhook] STRIPE_WEBHOOK_SECRET not configured");
      return res.status(500).json({ error: "Webhook secret not configured" });
    }
    try {
      const { getStripe, processWebhookEvent } = await import("../stripe-service");
      const stripe = getStripe();
      const event = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);
      console.log(`[Stripe Webhook] Received event: ${event.type} (${event.id})`);

      if (event.id.startsWith("evt_test_")) {
        return res.json({ verified: true });
      }

      // Idempotency — atomic claim against UNIQUE(provider, eventId).
      // First delivery: claim returns true, side effects run.
      // Duplicate / concurrent retry: claim returns false, skip.
      // Without this, Stripe retries (up to 3 days) cause db.insert(subscriptions)
      // below to create duplicate subscription rows for one customer.
      const { claimWebhookEvent, markWebhookEventProcessed } = await import("../db");
      const claimed = await claimWebhookEvent("stripe", event.id, event.type);
      if (!claimed) {
        console.log(`[Stripe Webhook] Duplicate event ignored: ${event.id}`);
        return res.json({ received: true, type: event.type, duplicate: true });
      }

      const result = await processWebhookEvent(event);

      if (result.handled && result.eventType === "checkout.session.completed" && result.userId && result.plan) {
        const { getDb } = await import("../db");
        const db = await getDb();
        if (db) {
          const { subscriptions, users } = await import("../../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          const { getPlanQuota } = await import("../../shared/pricing");
          const plan = result.plan as "starter" | "professional" | "enterprise";
          await db.insert(subscriptions).values({
            userId: result.userId,
            plan,
            status: "active",
            monthlyQuota: getPlanQuota(plan),
            usedQuota: 0,
            stripeCustomerId: result.customerId || null,
            stripeSubscriptionId: result.subscriptionId || null,
            billingCycle: "monthly",
            currentPeriodStart: new Date(),
            currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          });
          if (result.customerId) {
            await db.update(users).set({ stripeCustomerId: result.customerId }).where(eq(users.id, result.userId));
          }
          try {
            const { createSystemNotification } = await import("../db");
            await createSystemNotification(
              result.userId,
              `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan Activated`,
              `Your ${plan} subscription is now active.`,
              "subscription",
              "/subscriptions",
            );
          } catch { /* non-fatal */ }
          try {
            const { syncPaymentToHubSpot } = await import("../hubspot-service");
            await syncPaymentToHubSpot({ email: result.email || "", name: result.customerName || undefined, amount: 0, plan });
          } catch { /* non-fatal */ }
        }
      }

      if (result.handled && result.eventType === "customer.subscription.deleted" && result.subscriptionId) {
        const { getDb } = await import("../db");
        const db = await getDb();
        if (db) {
          const { subscriptions } = await import("../../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          await db.update(subscriptions).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(subscriptions.stripeSubscriptionId, result.subscriptionId));
        }
      }

      if (result.handled && result.eventType === "invoice.payment_failed" && result.subscriptionId) {
        const { getDb } = await import("../db");
        const db = await getDb();
        if (db) {
          const { subscriptions } = await import("../../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          await db.update(subscriptions).set({ status: "past_due" }).where(eq(subscriptions.stripeSubscriptionId, result.subscriptionId));
        }
      }

      // Side effects ran without throwing — stamp the claim. Rows left with
      // processedAt = NULL indicate a handler that crashed mid-processing
      // (caught by the catch below); useful for ops alerting.
      await markWebhookEventProcessed("stripe", event.id);
      res.json({ received: true, type: event.type });
    } catch (err: any) {
      console.error(`[Stripe Webhook] Error: ${err.message}`);
      // Note: claim row stays NULL on error. Stripe retries the same event.id;
      // claim will UNIQUE-conflict and return duplicate=true, permanently
      // dropping the event. This trades "always eventually execute" for
      // "never double-execute" — the right call for billing webhooks where
      // double-execution = duplicate subscription rows / double-charged ops.
      // Stuck NULL rows surface in ops alerting for manual recovery.
      res.status(400).json({ error: err.message });
    }
  });

  // ─── Health check (used by Railway / load-balancers) ─────────────────────
  app.get("/api/health", (_req, res) => {
    res.json({ status: "ok", uptime: process.uptime() });
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerOAuthRoutes(app);

  // Internal API for gateway worker
  app.use("/api/internal", createInternalRouter());

  app.use(
    "/api/trpc",
    createExpressMiddleware({ router: appRouter, createContext }),
  );

  return app;
}
