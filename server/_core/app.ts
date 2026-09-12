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

// Shared bearer-token check for the machine-to-machine endpoints below
// (server/_core/app.ts's job-runner routes). The caller here is always the
// Next.js app's tRPC layer or the cron trigger, which has already gated on
// CRON_SECRET — a logged-in human's Clerk session never reaches this file
// directly, so this is the right auth boundary, not a weaker one.
function requireCronAuth(req: import("express").Request, res: import("express").Response): boolean {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : auth;
  if (!secret || !timingSafeEqual(token, secret)) {
    res.status(401).json({ error: "Unauthorized" });
    return false;
  }
  return true;
}
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { sdk } from "./sdk";
import { createInternalRouter } from "../internal-api";
import { brandMiddleware } from "./brand-middleware";
import contactRouter from "../contact";
import gptRouter from "../gpt/router";
import {
  oauthRateLimit,
  contactRateLimit,
  gptRateLimit,
  globalApiRateLimit,
  adminRateLimit,
} from "./rate-limit";
import { getDb } from "../db";
import { getOpsSummary } from "./db-helpers";

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

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
      // handleStripeWebhook takes (rawBody, sig) — it was migrated off the
      // server/db.ts singleton in Task 2b-4 and no longer needs a db handle.
      // This call site was not updated then, so it passed db as rawBody and
      // req.body as sig, which cannot verify a Stripe signature.
      const result = await handleStripeWebhook(req.body, sig);
      res.json(result);
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      console.error(`[Stripe Webhook] Error: ${message}`);
      res.status(400).json({ error: message });
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
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      console.error(`[Paddle Webhook] Error: ${message}`);
      res.status(400).json({ error: message });
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
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      console.error(`[Instantly Webhook] Error: ${message}`);
      res.status(500).json({ error: message });
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
    } catch (err: unknown) {
      const message = getErrorMessage(err);
      console.error(`[DocuSign Webhook] Error: ${message}`);
      res.status(500).json({ error: message });
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

  // ─── Scheduled jobs runner (moved here from the Next.js app) ─────────────
  // This used to live at src/app/api/cron/jobs/route.ts and run in-process
  // on Vercel. server/scheduled-jobs.ts transitively imports
  // server/agents/browser-vision.ts, which needs a real Chromium process via
  // playwright-core — something Cloudflare Workers cannot run at all. Rather
  // than fight the bundler, the job runner lives on this always-on Node
  // service (Railway), and the Next.js route (now on Cloudflare) just proxies
  // to it. Same CRON_SECRET bearer-token auth as before.
  app.get("/api/cron/jobs", async (req, res) => {
    if (!requireCronAuth(req, res)) return;

    const jobName = typeof req.query.job === "string" ? req.query.job : undefined;
    const started = Date.now();

    try {
      const { initializeScheduler, runJobManually, getRegisteredJobs } = await import("../scheduled-jobs");

      if (jobName) {
        const success = await runJobManually(jobName);
        if (!success) {
          const available = getRegisteredJobs().map((j) => j.name);
          return res.status(404).json({ error: `Job "${jobName}" not found`, available });
        }
        return res.json({ ok: true, job: jobName, durationMs: Date.now() - started });
      }

      await initializeScheduler();
      const jobs = getRegisteredJobs();
      res.json({
        ok: true,
        registeredJobs: jobs.length,
        jobs: jobs.map((j) => ({ name: j.name, schedule: j.schedule, enabled: j.enabled })),
        durationMs: Date.now() - started,
      });
    } catch (err) {
      console.error("[CronJobs]", getErrorMessage(err));
      res.status(500).json({ error: getErrorMessage(err), durationMs: Date.now() - started });
    }
  });

  // ─── AgentZ pipeline tick (moved here from the Next.js app) ──────────────
  // server/jobs/pipeline-tick.ts's executeTick() runs budget monitor, dunning,
  // retention, weekly/quarterly digests, organic traffic, AND the UCB1-scored
  // mission-task loop (runTask) plus runBrowserAgentJobs — both of the latter
  // transitively import server/agents/browser.ts / browser-vision.ts, i.e.
  // playwright-core, same reason as /api/cron/jobs above. The whole tick
  // shares database state (due-task scoring, PMF mission creation) across
  // those steps, so splitting "browser" from "non-browser" work across two
  // runtimes would risk inconsistent reads — it runs here as one unit instead,
  // and both src/app/api/cron/pipeline/route.ts and the pipelineTick step of
  // src/app/api/automation/cron/route.ts proxy to this endpoint.
  app.get("/api/pipeline-tick", async (req, res) => {
    if (!requireCronAuth(req, res)) return;
    const started = Date.now();
    try {
      const { runPipelineTick } = await import("../jobs/pipeline-tick");
      const force = req.query.force === "true";
      const dryRun = req.query.dryRun === "true";
      const result = await runPipelineTick({ force, dryRun });
      res.json({ ok: true, durationMs: Date.now() - started, result, timestamp: new Date().toISOString() });
    } catch (err) {
      console.error("[PipelineTick]", getErrorMessage(err));
      res.status(500).json({ error: getErrorMessage(err), durationMs: Date.now() - started });
    }
  });

  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ limit: "5mb", extended: true }));

  // ─── Scheduler admin API (backs server/routers/scheduler.ts on Cloudflare) ─
  // schedulerRouter is part of the shared appRouter, mounted both here
  // (Railway, direct calls below) and in the Cloudflare-deployed Next.js app
  // (which proxies here instead, for the same playwright-core reason as
  // /api/cron/jobs above). adminProcedure already verified the caller is a
  // logged-in admin before the Next app ever reaches this endpoint.
  app.get("/api/scheduler/jobs", async (req, res) => {
    if (!requireCronAuth(req, res)) return;
    try {
      const { getRegisteredJobs } = await import("../scheduled-jobs");
      res.json(getRegisteredJobs());
    } catch (err) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  app.get("/api/scheduler/history", async (req, res) => {
    if (!requireCronAuth(req, res)) return;
    try {
      const { getJobHistory } = await import("../scheduled-jobs");
      const jobName = typeof req.query.jobName === "string" ? req.query.jobName : undefined;
      const limit = req.query.limit ? Number(req.query.limit) : 50;
      res.json(await getJobHistory(jobName, limit));
    } catch (err) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  app.get("/api/scheduler/status", async (req, res) => {
    if (!requireCronAuth(req, res)) return;
    try {
      const { getSystemStatus } = await import("../scheduled-jobs");
      res.json(getSystemStatus());
    } catch (err) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  app.post("/api/scheduler/toggle", async (req, res) => {
    if (!requireCronAuth(req, res)) return;
    try {
      const { toggleKillSwitch } = await import("../scheduled-jobs");
      const isActive = toggleKillSwitch(!!req.body?.active);
      res.json({ success: true, isActive });
    } catch (err) {
      res.status(500).json({ error: getErrorMessage(err) });
    }
  });

  // ─── Admin ops console (client/src/pages/OpsDashboard.tsx) ───────────────
  app.get("/api/admin/ops", adminRateLimit, async (req, res) => {
    const user = await sdk.authenticateRequest(req).catch(() => null);
    if (!user || user.role !== "admin") {
      return res.status(user ? 403 : 401).json({ error: user ? "Admin only" : "Not signed in" });
    }
    try {
      // Express ops-console route (Node-only deployment path, not the
      // Workers/tRPC path — no ctx.db reachable here). Calling getDb() is a
      // documented bridge to the legacy server/db.ts singleton.
      const db = await getDb();
      const summary = await getOpsSummary(db);
      res.json(summary);
    } catch (err) {
      res.status(500).json({ error: err instanceof Error ? err.message : "ops query failed" });
    }
  });

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

