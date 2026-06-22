import "dotenv/config";
import { timingSafeEqual as cryptoTimingSafeEqual } from "crypto";
import express from "express";
import helmet from "helmet";

function timingSafeEqual(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return cryptoTimingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { createInternalRouter } from "../internal-api";
import { brandMiddleware } from "./brand-middleware";
import contactRouter from "../contact";
import gptRouter from "../gpt/router";
import {
  oauthRateLimit,
  contactRateLimit,
  gptRateLimit,
  globalApiRateLimit,
} from "./rate-limit";

/**
 * Creates and configures the Express app without binding to a port.
 * Used by the standalone server (index.ts) AND the Vercel serverless function (api/server.ts).
 */
export function createApp() {
  const app = express();

  // Trust the first hop from Vercel / Railway reverse proxies so req.ip is the real client IP
  app.set("trust proxy", 1);

  // ─── Security headers ─────────────────────────────────────────────────────
  app.use(helmet({
    // Webhook endpoints use raw bodies so CSP is irrelevant there; apply globally
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: ["'self'", "https:"],
        frameSrc: ["https://js.stripe.com"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false, // allow embedding for QR/verification pages
  }));

  // ─── Global API rate limit (broad DoS protection) ────────────────────────
  app.use("/api", globalApiRateLimit);

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
    const secret = process.env.INSTANTLY_WEBHOOK_SECRET;
    if (secret) {
      const provided = req.headers["x-webhook-secret"] as string | undefined;
      if (!provided || !timingSafeEqual(provided, secret)) {
        return res.status(401).json({ error: "Invalid webhook secret" });
      }
    }
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
    const secret = process.env.DOCUSIGN_WEBHOOK_SECRET;
    if (secret) {
      const provided = req.headers["x-docusign-secret"] as string | undefined;
      if (!provided || !timingSafeEqual(provided, secret)) {
        return res.status(401).json({ error: "Invalid webhook secret" });
      }
    }
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

  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ limit: "5mb", extended: true }));

  // ─── OAuth callback: stricter rate limit ─────────────────────────────────
  app.use("/api/oauth", oauthRateLimit);
  registerOAuthRoutes(app);

  // ─── Contact form: 5/hr per IP ───────────────────────────────────────────
  app.use("/api/contact", contactRateLimit, contactRouter);

  // ─── GPT plugin: 60/min per IP ───────────────────────────────────────────
  app.use("/api/gpt", gptRateLimit, gptRouter);

  // Internal API for gateway worker
  app.use("/api/internal", createInternalRouter());

  app.use(
    "/api/trpc",
    createExpressMiddleware({ router: appRouter, createContext }),
  );

  return app;
}
