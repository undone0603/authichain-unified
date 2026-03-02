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

  // ─── Temporary Admin Utilities ─────────────────
  app.get("/api/admin/stripe-mode", async (_req, res) => {
    const key = process.env.STRIPE_SECRET_KEY || "";
    res.json({ mode: key.startsWith("sk_live_") ? "live" : key.startsWith("sk_test_") ? "test" : "unknown", keyPrefix: key.slice(0, 12) });
  });

  app.get("/api/admin/coupon-details/:id", async (req, res) => {
    try {
      const secretKey = process.env.STRIPE_SECRET_KEY;
      if (!secretKey) return res.status(500).json({ error: "No key" });
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(secretKey);
      const coupon = await stripe.coupons.retrieve(req.params.id);
      res.json(coupon);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/admin/list-promos", async (_req, res) => {
    try {
      const secretKey = process.env.STRIPE_SECRET_KEY;
      if (!secretKey) return res.status(500).json({ error: "No key" });
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(secretKey);
      const promos = await stripe.promotionCodes.list({ limit: 10, active: true });
      // Return raw data for debugging
      res.json(promos.data.map((p: any) => JSON.parse(JSON.stringify(p))));
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/create-promo", express.json(), async (req, res) => {
    try {
      const { code, percentOff = 99 } = req.body;
      if (!code) return res.status(400).json({ error: "code is required" });
      const secretKey = process.env.STRIPE_SECRET_KEY;
      if (!secretKey) return res.status(500).json({ error: "STRIPE_SECRET_KEY not configured" });
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(secretKey);
      const coupon = await stripe.coupons.create({
        percent_off: percentOff,
        duration: "forever" as const,
        name: `AuthiChain ${percentOff}% Off`,
      });
      // Use legacy coupon field for maximum compatibility
      const promo = await (stripe.promotionCodes as any).create({
        coupon: coupon.id,
        code,
        active: true,
      });
      res.json({ success: true, code: promo.code, id: promo.id, couponId: coupon.id, percentOff });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.post("/api/admin/deactivate-promo", express.json(), async (req, res) => {
    try {
      const { promoId } = req.body;
      if (!promoId) return res.status(400).json({ error: "promoId is required" });
      const secretKey = process.env.STRIPE_SECRET_KEY;
      if (!secretKey) return res.status(500).json({ error: "STRIPE_SECRET_KEY not configured" });
      const Stripe = (await import("stripe")).default;
      const stripe = new Stripe(secretKey);
      const promo = await stripe.promotionCodes.update(promoId, { active: false });
      res.json({ success: true, id: promo.id, active: promo.active });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

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
