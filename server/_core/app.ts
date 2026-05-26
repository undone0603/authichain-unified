import { getBrandContext } from "./brand-context";
import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { createInternalRouter } from "../internal-api";
import { brandMiddleware } from "./brand-middleware";
import contactRouter from "../contact";
import gptRouter from "../gpt/router";

const ALLOWED_ORIGINS = [
  "https://authichain.com",
  "https://www.authichain.com",
  "https://govchain.us",
  "https://strainchain.io",
  "https://qron.io",
  ...(process.env.NODE_ENV !== "production"
    ? ["http://localhost:3000", "http://localhost:5173"]
    : []),
];

const corsOptions: cors.CorsOptions = {
  origin: (origin, cb) => {
    // Allow server-to-server (no Origin header) and known origins
    if (!origin || ALLOWED_ORIGINS.includes(origin)) return cb(null, true);
    cb(new Error(`CORS: origin not allowed — ${origin}`));
  },
  credentials: true,
};

// 100 req/min per IP for the tRPC API
const trpcLimiter = rateLimit({
  windowMs: 60_000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many requests, please slow down." },
});

// Tighter limit for auth-adjacent OAuth callbacks
const authLimiter = rateLimit({
  windowMs: 60_000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "Too many auth requests." },
});

/**
 * Creates and configures the Express app without binding to a port.
 * Used by the standalone server (index.ts) AND the Vercel serverless function (api/server.ts).
 */
export function createApp() {
  const app = express();

  // ─── CORS (before all routes) ─────────────────────────────────────────────
  app.use(cors(corsOptions));
  app.options("*", cors(corsOptions));

  // ─── Brand detection (Host → res.locals.brand + X-Brand header) ──────────
  app.use(brandMiddleware);

  // ─── Stripe Webhook (MUST be before express.json()) ───────────────────────
  // Delegates to handleStripeWebhook in server/webhooks/stripe.ts which is the
  // full handler — service orders, fulfillment, revenue recording, payment
  // confirmation email, lead-WON status, audit logging, HubSpot sync. The
  // older inline path (calling stripe-service.processWebhookEvent) only
  // handled subscriptions and silently dropped /services-page checkouts.
  app.post("/api/stripe/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["stripe-signature"] as string;
    if (!sig) {
      return res.status(400).json({ error: "Missing stripe-signature header" });
    }
    try {
      const { handleStripeWebhook } = await import("../webhooks/stripe");
      const result = await handleStripeWebhook(req.body, sig);
      res.json(result);
    } catch (err: any) {
      console.error(`[Stripe Webhook] Error: ${err.message}`);
      res.status(400).json({ error: err.message });
    }
  });

  // ─── Paddle Webhook (MUST be before express.json()) ──────────────────────
  app.post("/api/paddle/webhook", express.raw({ type: "application/json" }), async (req, res) => {
    const sig = req.headers["paddle-signature"] as string;
    if (!sig) {
      return res.status(400).json({ error: "Missing paddle-signature header" });
    }
    try {
      const { handlePaddleWebhook } = await import("../paddle/webhook");
      await handlePaddleWebhook(req, res);
    } catch (err: any) {
      console.error(`[Paddle Webhook] Error: ${err.message}`);
      res.status(400).json({ error: err.message });
    }
  });

  // ─── Instantly.ai Webhook ────────────────────────────────────────────────
  app.post("/api/webhooks/instantly", async (req, res) => {
    try {
      const { handleInstantlyWebhook } = await import("../webhooks/instantly.js");
      const result = await handleInstantlyWebhook(req.body);
      res.json(result);
    } catch (err: any) {
      console.error(`[Instantly Webhook] Error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── DocuSign Webhook ────────────────────────────────────────────────────
  app.post("/api/webhooks/docusign", async (req, res) => {
    try {
      const { handleDocuSignWebhook } = await import("../webhooks/docusign.js");
      const result = await handleDocuSignWebhook(req.body);
      res.json(result);
    } catch (err: any) {
      console.error(`[DocuSign Webhook] Error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Paddle config guard (startup warning, not a hard error) ────────────
  if (!process.env.PADDLE_WEBHOOK_SECRET) {
    console.warn(
      "[Paddle] PADDLE_WEBHOOK_SECRET is not set. " +
      "Register https://<your-domain>/api/paddle/webhook in the Paddle dashboard " +
      "(Developer → Notifications) and set PADDLE_WEBHOOK_SECRET to the signing secret.",
    );
  }

  // ─── Health check (used by Railway / load-balancers) ─────────────────────
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      uptime: process.uptime(),
      paddle: !!process.env.PADDLE_WEBHOOK_SECRET,
      stripe: !!process.env.STRIPE_WEBHOOK_SECRET,
    });
  });

  // ─── Vercel Cron endpoint ────────────────────────────────────────────────
  // Vercel calls GET /api/cron/:jobName on the configured schedule and injects
  // Authorization: Bearer <CRON_SECRET>. We validate that header so the routes
  // are not publicly triggerable. When CRON_SECRET is not set (dev) we allow
  // requests only from localhost.
  app.get("/api/cron/:jobName", async (req, res) => {
    const secret = process.env.CRON_SECRET;
    const auth = req.headers.authorization;
    const isLocalDev = !secret && (req.ip === "127.0.0.1" || req.ip === "::1" || req.ip?.startsWith("::ffff:127."));
    if (secret && auth !== `Bearer ${secret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    if (!secret && !isLocalDev) {
      return res.status(401).json({ error: "CRON_SECRET not configured" });
    }
    const { runJobManually } = await import("../scheduled-jobs");
    const jobName = req.params.jobName;
    const success = await runJobManually(jobName);
    if (!success) return res.status(404).json({ error: `Unknown job: ${jobName}` });
    res.json({ ok: true, jobName });
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerOAuthRoutes(app);
    app.use("/api/contact", contactRouter);
    app.use("/api/gpt", gptRouter);

  // Internal API for gateway worker
  app.use("/api/internal", createInternalRouter());

  app.use(
    "/api/trpc",
    trpcLimiter,
    createExpressMiddleware({ router: appRouter, createContext }),
  );

  // Apply tighter rate limit to OAuth callback paths
  app.use("/api/auth", authLimiter);

  // ─── Global error handler ─────────────────────────────────────────────────
  // Must be registered AFTER all routes. Catches errors passed via next(err)
  // and unhandled throws from synchronous route handlers.
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
    console.error("[Express error]", err);
    if (res.headersSent) return;
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}
