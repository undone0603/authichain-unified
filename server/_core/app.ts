import "dotenv/config";
import { timingSafeEqual as cryptoTimingSafeEqual } from "crypto";
import express, { type NextFunction, type Request, type Response } from "express";
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
import cors from "cors";
import { rateLimit } from "express-rate-limit";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { createInternalRouter } from "../internal-api";
import { resolveBrand } from "../../shared/brands";

function brandMiddleware(req: Request, res: Response, next: NextFunction) {
  const host = req.headers.host ?? req.hostname ?? "";
  const brand = resolveBrand(host);
  res.locals.brand = brand;
  res.setHeader("X-Brand", brand);
  next();
}
import contactRouter from "../contact";
import gptRouter from "../gpt/router";
import {
  oauthRateLimit,
  contactRateLimit,
  gptRateLimit,
  globalApiRateLimit,
} from "./rate-limit";

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

  // Trust the first hop from Vercel / Railway reverse proxies so req.ip is the real client IP
  app.set("trust proxy", 1);

  // ─── Security headers ─────────────────────────────────────────────────────
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'", "https://js.stripe.com"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "https:"],
        connectSrc: [
          "'self'",
          "https://api.stripe.com",
          "https://*.supabase.co",
          "wss://*.supabase.co",
          "https://*.thirdweb.com",
          "wss://*.thirdweb.com",
          "https://polygon-rpc.com",
          "https://*.polygon.technology",
          ...(process.env.NODE_ENV !== "production" ? ["ws://localhost:*", "http://localhost:*"] : []),
        ],
        frameSrc: ["https://js.stripe.com"],
        objectSrc: ["'none'"],
        upgradeInsecureRequests: [],
      },
    },
    crossOriginEmbedderPolicy: false,
  }));


  // ─── CORS (before all routes) ─────────────────────────────────────────────
  app.use(cors(corsOptions));
  app.options("*", cors(corsOptions));

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

<<<<<<< HEAD
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
=======
  // ─── Instantly.ai Webhook ────────────────────────────────────────────────
  app.post("/api/webhooks/instantly", async (req, res) => {
    const secret = process.env.INSTANTLY_WEBHOOK_SECRET;
    if (secret) {
      const provided = req.headers["x-webhook-secret"] as string | undefined;
      if (!provided || !timingSafeEqual(provided, secret)) {
        return res.status(401).json({ error: "Invalid webhook secret" });
      }
    }
>>>>>>> origin/add-agentz-editable
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

<<<<<<< HEAD
  // ─── Paddle config guard (startup warning, not a hard error) ────────────
  if (!process.env.PADDLE_WEBHOOK_SECRET) {
    console.warn(
      "[Paddle] PADDLE_WEBHOOK_SECRET is not set. " +
      "Register https://<your-domain>/api/paddle/webhook in the Paddle dashboard " +
      "(Developer → Notifications) and set PADDLE_WEBHOOK_SECRET to the signing secret.",
    );
  }
=======
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
>>>>>>> origin/add-agentz-editable

  // ─── Health check (used by Railway / load-balancers) ─────────────────────
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      uptime: process.uptime(),
      stripe: !!process.env.STRIPE_WEBHOOK_SECRET,
    });
  });

  // ─── Vercel Cron endpoint ────────────────────────────────────────────────
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

  // ─── OAuth callback: stricter rate limit ─────────────────────────────────
  app.use("/api/oauth", oauthRateLimit);
  registerOAuthRoutes(app);

  // ─── Contact form: 5/hr per IP ───────────────────────────────────────────
  app.use("/api/contact", contactRateLimit, contactRouter);

  // ─── GPT plugin: 60/min per IP ───────────────────────────────────────────
  app.use("/api/gpt", gptRateLimit, gptRouter);

  // ─── Email Open / Click Tracking ─────────────────────────────────────────
  app.get("/api/track/open/:token", async (req, res) => {
    try {
      const email = Buffer.from(
        req.params.token.replace(/-/g, "+").replace(/_/g, "/"),
        "base64",
      ).toString("utf-8");
      if (email.includes("@")) {
        const { recordEmailOpen } = await import("../db");
        await recordEmailOpen(email).catch(() => {});
      }
    } catch { /* ignore malformed tokens */ }
    // Return 1x1 transparent GIF
    const gif = Buffer.from("R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7", "base64");
    res.set({ "Content-Type": "image/gif", "Cache-Control": "no-store" }).send(gif);
  });

  app.get("/api/track/click/:token", async (req, res) => {
    const destination = typeof req.query.url === "string" ? decodeURIComponent(req.query.url) : null;
    try {
      const email = Buffer.from(
        req.params.token.replace(/-/g, "+").replace(/_/g, "/"),
        "base64",
      ).toString("utf-8");
      if (email.includes("@")) {
        const { recordEmailClick } = await import("../db");
        await recordEmailClick(email).catch(() => {});
      }
    } catch { /* ignore malformed tokens */ }
    if (destination && /^https?:\/\//.test(destination)) {
      return res.redirect(302, destination);
    }
    res.redirect(302, "https://authichain.com");
  });

  // ─── Autonomous Pipeline Cron ────────────────────────────────────────────
  // Called by Vercel Cron every 5 minutes. Authenticated by CRON_SECRET header.
  app.post("/api/cron/pipeline", async (req, res) => {
    const { ENV } = await import("./env");
    const auth = req.headers["authorization"];
    if (ENV.cronSecret && auth !== `Bearer ${ENV.cronSecret}`) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    try {
      const { runPipelineTick } = await import("../jobs/pipeline-tick");
      const result = await runPipelineTick();
      res.json({ ok: true, result });
    } catch (err: any) {
      console.error("[cron/pipeline]", err.message);
      res.status(500).json({ ok: false, error: err.message });
    }
  });

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
