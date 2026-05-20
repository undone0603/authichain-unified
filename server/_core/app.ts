import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { createInternalRouter } from "../internal-api";
import { brandMiddleware } from "./brand-middleware";
import contactRouter from "../contact";
import gptRouter from "../gpt/router";

/**
 * Creates and configures the Express app without binding to a port.
 * Used by the standalone server (index.ts) AND the Vercel serverless function (api/server.ts).
 */
export function createApp() {
  const app = express();

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

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerOAuthRoutes(app);
    app.use("/api/contact", contactRouter);
    app.use("/api/gpt", gptRouter);

  // Internal API for gateway worker
  app.use("/api/internal", createInternalRouter());

  app.use(
    "/api/trpc",
    createExpressMiddleware({ router: appRouter, createContext }),
  );

  return app;
}
