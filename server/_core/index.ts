import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // ─── Stripe Webhook (MUST be before express.json()) ───────────────────
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

      // Handle test events
      if (event.id.startsWith("evt_test_")) {
        console.log("[Webhook] Test event detected, returning verification response");
        return res.json({ verified: true });
      }

      const result = await processWebhookEvent(event);

      if (result.handled && result.eventType === "checkout.session.completed" && result.userId && result.plan) {
        // Update subscription in database
        const { getDb } = await import("../db");
        const db = await getDb();
        if (db) {
          const { subscriptions, users } = await import("../../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          const { getPlanQuota } = await import("../stripe-products");
          const plan = result.plan as "starter" | "professional" | "enterprise";
          // Upsert subscription
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
          // Update user's stripeCustomerId
          if (result.customerId) {
            await db.update(users).set({ stripeCustomerId: result.customerId }).where(eq(users.id, result.userId));
          }
          console.log(`[Stripe Webhook] Subscription created for user ${result.userId}: ${plan}`);
          // Auto-notification for subscription
          try {
            const { createSystemNotification } = await import("../db");
            await createSystemNotification(
              result.userId,
              `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan Activated`,
              `Your ${plan} subscription is now active. You have ${getPlanQuota(plan)} monthly authentications available.`,
              "subscription",
              "/subscriptions"
            );
          } catch (notifErr) { console.warn("[Notification] Failed to create:", notifErr); }
          // Auto-sync payment to HubSpot
          try {
            const { syncPaymentToHubSpot } = await import("../hubspot-service");
            await syncPaymentToHubSpot({
              email: result.email || "",
              name: result.customerName || undefined,
              amount: 0, // Amount comes from Stripe, we just track the deal
              plan: plan,
            });
          } catch (hsErr) { console.warn("[HubSpot] Payment sync failed:", hsErr); }
        }
      }

      if (result.handled && result.eventType === "customer.subscription.deleted" && result.subscriptionId) {
        const { getDb } = await import("../db");
        const db = await getDb();
        if (db) {
          const { subscriptions } = await import("../../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          await db.update(subscriptions).set({ status: "cancelled", cancelledAt: new Date() }).where(eq(subscriptions.stripeSubscriptionId, result.subscriptionId));
          console.log(`[Stripe Webhook] Subscription cancelled: ${result.subscriptionId}`);
        }
      }

      if (result.handled && result.eventType === "invoice.payment_failed" && result.subscriptionId) {
        const { getDb } = await import("../db");
        const db = await getDb();
        if (db) {
          const { subscriptions } = await import("../../drizzle/schema");
          const { eq } = await import("drizzle-orm");
          await db.update(subscriptions).set({ status: "past_due" }).where(eq(subscriptions.stripeSubscriptionId, result.subscriptionId));
          console.log(`[Stripe Webhook] Payment failed for subscription: ${result.subscriptionId}`);
        }
      }

      res.json({ received: true, type: event.type });
    } catch (err: any) {
      console.error(`[Stripe Webhook] Error: ${err.message}`);
      res.status(400).json({ error: err.message });
    }
  });

  // Admin utilities moved to tRPC adminProcedure (subscription.createPromoCode)

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    })
  );
  // development mode uses Vite, production mode uses static files
  if (process.env.NODE_ENV === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`Server running on http://localhost:${port}/`);
  });
}

startServer().catch(console.error);
