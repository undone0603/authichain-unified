import "dotenv/config";
import express, { type Request } from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerGmailOAuthRoutes } from "./gmail-oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { ENV } from "./env";
import { serveStatic, setupVite } from "./vite";

const processStartedAt = Date.now();

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

function createIpRateLimiter(windowMs: number, max: number) {
  const counters = new Map<string, { count: number; resetAt: number }>();
  return (req: Request, res: express.Response, next: express.NextFunction) => {
    const xff = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim();
    const key = xff || req.ip || "unknown";
    const now = Date.now();
    const current = counters.get(key);
    if (!current || current.resetAt <= now) {
      counters.set(key, { count: 1, resetAt: now + windowMs });
      return next();
    }
    if (current.count >= max) {
      const retryAfter = Math.max(1, Math.ceil((current.resetAt - now) / 1000));
      res.setHeader("Retry-After", String(retryAfter));
      return res.status(429).json({ error: "Too many requests" });
    }
    current.count += 1;
    counters.set(key, current);
    return next();
  };
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const stripeWebhookRateLimit = createIpRateLimiter(60 * 1000, 100);
  const trpcRateLimit = createIpRateLimiter(60 * 1000, 200);
  const createLeadRateLimit = createIpRateLimiter(60 * 1000, 10);

  app.set("trust proxy", 1);
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    const allowOrigin = !origin
      || !ENV.isProduction
      || ENV.corsAllowedOrigins.includes(origin);
    if (allowOrigin && origin) {
      res.setHeader("Access-Control-Allow-Origin", origin);
      res.setHeader("Vary", "Origin");
    } else if (origin) {
      return res.status(403).json({ error: "CORS blocked" });
    }
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Methods", "GET,POST,PUT,PATCH,DELETE,OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    return next();
  });

  app.get("/health", async (_req, res) => {
    let dbConnected = false;
    try {
      const { getDb } = await import("../db");
      dbConnected = !!(await getDb());
    } catch {
      dbConnected = false;
    }
    const mem = process.memoryUsage();
    return res.status(dbConnected ? 200 : 503).json({
      ok: dbConnected,
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor((Date.now() - processStartedAt) / 1000),
      database: { connected: dbConnected },
      memory: {
        rss: mem.rss,
        heapTotal: mem.heapTotal,
        heapUsed: mem.heapUsed,
        external: mem.external,
      },
    });
  });

  // ─── Stripe Webhook (MUST be before express.json()) ───────────────────
  app.post("/api/stripe/webhook", stripeWebhookRateLimit, express.raw({ type: "application/json" }), async (req, res) => {
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
      const { hasWebhookEventProcessed } = await import("../db");
      if (await hasWebhookEventProcessed(event.id)) {
        console.log(`[Stripe Webhook] Duplicate event ignored: ${event.id}`);
        return res.json({ received: true, duplicate: true, type: event.type });
      }

      if (result.handled && result.eventType === "checkout.session.completed" && result.userId && result.plan) {
        const { getPlanQuota } = await import("../stripe-products");
        const {
          createSystemNotification,
          logAutomationAudit,
          recordRevenue,
          upsertStripeSubscription,
        } = await import("../db");
        const plan = result.plan as "starter" | "professional" | "enterprise";
        const session = event.data.object as any;
        const billingCycle = session?.metadata?.billing === "annual" ? "annual" : "monthly";
        const amountUsd = session?.amount_total ? Number(session.amount_total) / 100 : 0;

        await upsertStripeSubscription({
          userId: result.userId,
          plan,
          status: "active",
          monthlyQuota: getPlanQuota(plan),
          billingCycle,
          stripeCustomerId: result.customerId || null,
          stripeSubscriptionId: result.subscriptionId || null,
          currentPeriodStart: new Date(),
          currentPeriodEnd: new Date(Date.now() + (billingCycle === "annual" ? 365 : 30) * 24 * 60 * 60 * 1000),
        });
        await logAutomationAudit("billing_checkout_completed", {
          eventId: event.id,
          userId: result.userId,
          plan,
          billingCycle,
          amountUsd,
          stripeSubscriptionId: result.subscriptionId || null,
        }, result.userId);
        if (amountUsd > 0) {
          await recordRevenue({
            source: "stripe",
            amount: amountUsd.toFixed(2),
            currency: "USD",
            type: "subscription",
            userId: result.userId,
            metadata: { eventId: event.id, plan, billingCycle },
          });
        }

        await createSystemNotification(
          result.userId,
          `${plan.charAt(0).toUpperCase() + plan.slice(1)} Plan Activated`,
          `Your ${plan} subscription is active with ${getPlanQuota(plan)} monthly authentications.`,
          "subscription",
          "/subscriptions",
        );
        console.log(`[Stripe Webhook] Subscription upserted for user ${result.userId}: ${plan}`);

        try {
          const { syncDealStageToHubSpot, syncPaymentToHubSpot } = await import("../hubspot-service");
          await syncPaymentToHubSpot({
            email: result.email || "",
            name: result.customerName || undefined,
            amount: amountUsd,
            plan,
          });
          await syncDealStageToHubSpot({
            email: result.email || "",
            name: result.customerName || undefined,
            amount: amountUsd,
            plan,
            stage: "paid",
            eventId: event.id,
          });
        } catch (hsErr) {
          console.warn("[HubSpot] Payment sync failed:", hsErr);
        }
      }

      if (result.handled && result.eventType === "customer.subscription.deleted" && result.subscriptionId) {
        const { logAutomationAudit, setSubscriptionStatusByStripeId } = await import("../db");
        await setSubscriptionStatusByStripeId(result.subscriptionId, "cancelled", new Date());
        await logAutomationAudit("billing_subscription_cancelled", {
          eventId: event.id,
          stripeSubscriptionId: result.subscriptionId,
        });
        console.log(`[Stripe Webhook] Subscription cancelled: ${result.subscriptionId}`);
      }

      if (result.handled && result.eventType === "invoice.payment_failed" && result.subscriptionId) {
        const {
          createSystemNotification,
          getSubscriptionByStripeSubscriptionId,
          logAutomationAudit,
          setSubscriptionStatusByStripeId,
        } = await import("../db");
        await setSubscriptionStatusByStripeId(result.subscriptionId, "past_due");
        const sub = await getSubscriptionByStripeSubscriptionId(result.subscriptionId);
        if (sub?.userId) {
          await createSystemNotification(
            sub.userId,
            "Payment Failed",
            "Payment failed. Dunning sequence started. Update billing details to avoid downgrade.",
            "alert",
            "/subscriptions",
          );
        }
        await logAutomationAudit("billing_dunning_started", {
          eventId: event.id,
          stripeSubscriptionId: result.subscriptionId,
          dunningStep: "day_0",
        }, sub?.userId);
        if (result.email && sub?.plan) {
          try {
            const { syncDealStageToHubSpot } = await import("../hubspot-service");
            await syncDealStageToHubSpot({
              email: result.email,
              plan: sub.plan,
              stage: "payment_failed",
              eventId: event.id,
            });
          } catch {
            // Best-effort external sync.
          }
        }
        console.log(`[Stripe Webhook] Payment failed for subscription: ${result.subscriptionId}`);
      }

      if (result.handled && result.eventType === "checkout.session.expired" && result.plan && result.email) {
        const { logAutomationAudit } = await import("../db");
        await logAutomationAudit("checkout_abandoned", {
          eventId: event.id,
          plan: result.plan,
          email: result.email,
        }, result.userId);
        try {
          const { syncDealStageToHubSpot } = await import("../hubspot-service");
          await syncDealStageToHubSpot({
            email: result.email,
            name: result.customerName,
            plan: result.plan,
            stage: "abandoned",
            eventId: event.id,
          });
        } catch {
          // Best-effort external sync.
        }
      }

      if (result.handled && result.eventType === "invoice.paid" && result.subscriptionId) {
        const { logAutomationAudit, setSubscriptionStatusByStripeId } = await import("../db");
        await setSubscriptionStatusByStripeId(result.subscriptionId, "active");
        await logAutomationAudit("billing_invoice_paid", {
          eventId: event.id,
          stripeSubscriptionId: result.subscriptionId,
        });
        console.log(`[Stripe Webhook] Invoice paid for subscription: ${result.subscriptionId}`);
      }

      res.json({ received: true, type: event.type });
    } catch (err: any) {
      console.error(`[Stripe Webhook] Error: ${err.message}`);
      res.status(400).json({ error: err.message });
    }
  });

  // ─── Stripe Webhook v2 — /webhooks/stripe ─────────────────────────────────
  // Canonical path for new Stripe webhook registrations. Delegates to the
  // extracted handler in server/webhooks/stripe.ts which writes directly to
  // activity_log, revenue_records, and subscriptions so AgentZ jobs can
  // consume real Stripe data on their next tick.
  app.post("/webhooks/stripe", stripeWebhookRateLimit, express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;
    if (!sig) {
      return res.status(400).json({ error: "Missing stripe-signature header" });
    }
    try {
      const { handleStripeWebhook } = await import("../webhooks/stripe");
      const result = await handleStripeWebhook(req.body as Buffer, sig);
      return res.json(result);
    } catch (err: any) {
      console.error(`[/webhooks/stripe] Error: ${err.message}`);
      return res.status(400).json({ error: err.message });
    }
  });

  // Admin utilities moved to tRPC adminProcedure (subscription.createPromoCode)

  // Configure body parser with larger size limit for file uploads
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  // OAuth callback under /api/oauth/callback
  registerOAuthRoutes(app);
  registerGmailOAuthRoutes(app);
  // tRPC API
  app.use(
    "/api/trpc",
    trpcRateLimit,
    (req, res, next) => {
      const trpcPath = req.path || "";
      if (trpcPath.includes("marketing.createLead")) {
        return createLeadRateLimit(req, res, next);
      }
      return next();
    },
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
