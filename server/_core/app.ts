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

  // ─── DocuSign Webhook (MUST be before express.json() — HMAC over raw body) ──
  // DocuSign Connect: HMAC-SHA256(rawBody, DOCUSIGN_HMAC_KEY) → base64,
  // delivered in X-DocuSign-Signature-1. Without verification, anyone could
  // POST envelope-completed and the handler would mark a lead CLOSED_WON.
  // Fail-closed when DOCUSIGN_HMAC_KEY is set; warn-and-pass otherwise so dev
  // setups keep working (matching the Paddle pattern below).
  app.post("/api/webhooks/docusign", express.raw({ type: "application/json" }), async (req, res) => {
    try {
      const raw = req.body as Buffer;
      const required = process.env.DOCUSIGN_HMAC_KEY;
      if (required) {
        const provided = String(req.headers["x-docusign-signature-1"] ?? "");
        const { createHmac, timingSafeEqual } = await import("node:crypto");
        const expected = createHmac("sha256", required).update(raw).digest("base64");
        const a = Buffer.from(provided);
        const b = Buffer.from(expected);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return res.status(401).json({ error: "invalid webhook signature" });
        }
      } else {
        console.warn("[DocuSign Webhook] DOCUSIGN_HMAC_KEY not set — accepting unsigned payloads (insecure).");
      }
      const payload = JSON.parse(raw.toString("utf8"));
      const { handleDocuSignWebhook } = await import("../webhooks/docusign.js");
      const result = await handleDocuSignWebhook(payload);
      res.json(result);
    } catch (err: any) {
      console.error(`[DocuSign Webhook] Error: ${err.message}`);
      res.status(500).json({ error: err.message });
    }
  });

  // ─── Instantly.ai Webhook ────────────────────────────────────────────────
  // Instantly has no built-in HMAC; the recommended pattern is a shared secret
  // delivered as a custom header (configure in Instantly's webhook UI). Fails
  // closed when INSTANTLY_WEBHOOK_SECRET is set; warns otherwise.
  // express.json() inline because this route is registered before the global
  // body parser at line ~137; without this, req.body was undefined and every
  // request silently bailed with "Email missing".
  app.post("/api/webhooks/instantly", express.json(), async (req, res) => {
    try {
      const required = process.env.INSTANTLY_WEBHOOK_SECRET;
      if (required) {
        const provided = String(req.headers["x-instantly-secret"] ?? req.headers["authorization"] ?? "")
          .replace(/^Bearer\s+/i, "");
        const { timingSafeEqual } = await import("node:crypto");
        const a = Buffer.from(provided);
        const b = Buffer.from(required);
        if (a.length !== b.length || !timingSafeEqual(a, b)) {
          return res.status(401).json({ error: "invalid webhook signature" });
        }
      } else {
        console.warn("[Instantly Webhook] INSTANTLY_WEBHOOK_SECRET not set — accepting unsigned payloads (insecure).");
      }
      const { handleInstantlyWebhook } = await import("../webhooks/instantly.js");
      const result = await handleInstantlyWebhook(req.body);
      res.json(result);
    } catch (err: any) {
      console.error(`[Instantly Webhook] Error: ${err.message}`);
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
