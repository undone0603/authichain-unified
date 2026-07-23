import { Hono } from "hono";
import { trpcServer } from "@hono/trpc-server";
import { appRouter } from "../server/routers";
import { createWorkersContext } from "../server/_core/context.workers";
import { resolveBrand, type BrandId } from "../shared/brands";
import { getHyperdriveDb } from "../server/db";
import { timingSafeEqual as cryptoTimingSafeEqual } from "node:crypto";
import { COOKIE_NAME, ONE_YEAR_MS } from "../shared/const";
import { getSessionCookieOptions } from "../server/_core/cookies";
import { products, certificates } from "../drizzle/schema";
import { eq } from "drizzle-orm";

type Env = {
  HYPERDRIVE: Hyperdrive;
  ASSETS: Fetcher;
  SESSIONS: KVNamespace;
};

type Variables = {
  brand: BrandId;
};


// Shared timing-safe string comparison for webhook secret headers (mirrors
// the local helper in server/_core/app.ts and server/internal-api.ts).
function timingSafeEqualStrings(a: string, b: string): boolean {
  try {
    const ba = Buffer.from(a);
    const bb = Buffer.from(b);
    if (ba.length !== bb.length) return false;
    return cryptoTimingSafeEqual(ba, bb);
  } catch {
    return false;
  }
}

const app = new Hono<{ Bindings: Env; Variables: Variables }>();

// Brand resolution — same logic as src/middleware.ts and the old
// server/_core/brand-middleware.ts, ported to Hono context instead of
// Express res.locals.
app.use("*", async (c, next) => {
  const host = c.req.header("x-forwarded-host") ?? c.req.header("host") ?? "";
  const brand = resolveBrand(host);
  c.set("brand", brand);
  c.header("X-Brand", brand);
  await next();
});

app.use(
  "/api/trpc/*",
  trpcServer({
    router: appRouter,
    createContext: (opts, c) => createWorkersContext(opts, c.env),
  })
);

app.get("/api/health", (c) => c.json({ status: "ok" }));


// ─── Stripe Webhook ─────────────────────────────────────────────────────────
// handleStripeWebhook(db, rawBody, sig) is a framework-agnostic plain
// function (server/webhooks/stripe.ts) — just a new call site here.
app.post("/api/stripe/webhook", async (c) => {
  const sig = c.req.header("stripe-signature");
  if (!sig) {
    return c.json({ error: "Missing stripe-signature header" }, 400);
  }
  try {
    const { handleStripeWebhook } = await import("../server/webhooks/stripe");
    const rawBody = Buffer.from(await c.req.arrayBuffer());
    const db = getHyperdriveDb(c.env);
    const result = await handleStripeWebhook(db, rawBody, sig);
    return c.json(result);
  } catch (err: any) {
    console.error(`[Stripe Webhook] Error: ${err.message}`);
    return c.json({ error: err.message }, 400);
  }
});

// ─── Paddle Webhook ─────────────────────────────────────────────────────────
// handlePaddleWebhook(db, req, res) takes Express-shaped req/res objects
// directly (not a framework-agnostic signature like the other webhook
// handlers) — this is a minimal req/res shim rather than a rewrite of
// server/paddle/webhook.ts, which only touches req.headers, req.body, and
// res.status()/res.json().
app.post("/api/paddle/webhook", async (c) => {
  const sig = c.req.header("paddle-signature");
  if (!sig) {
    return c.json({ error: "Missing paddle-signature header" }, 400);
  }
  try {
    const { handlePaddleWebhook } = await import("../server/paddle/webhook");
    const bodyText = await c.req.text();
    const db = getHyperdriveDb(c.env);
    let statusCode = 200;
    let responseBody: unknown = null;
    const fakeReq = {
      headers: { "paddle-signature": sig },
      body: { toString: () => bodyText },
    } as any;
    const fakeRes = {
      status(code: number) { statusCode = code; return fakeRes; },
      json(body: unknown) { responseBody = body; return fakeRes; },
    } as any;
    await handlePaddleWebhook(db, fakeReq, fakeRes);
    return c.json(responseBody as any, statusCode as any);
  } catch (err: any) {
    console.error(`[Paddle Webhook] Error: ${err.message}`);
    return c.json({ error: err.message }, 400);
  }
});


// ─── Instantly.ai Webhook ───────────────────────────────────────────────────
app.post("/api/webhooks/instantly", async (c) => {
  const secret = process.env.INSTANTLY_WEBHOOK_SECRET;
  if (secret) {
    const provided = c.req.header("x-webhook-secret");
    if (!provided || !timingSafeEqualStrings(provided, secret)) {
      return c.json({ error: "Invalid webhook secret" }, 401);
    }
  }
  try {
    const { handleInstantlyWebhook } = await import("../server/webhooks/instantly");
    const payload = await c.req.json();
    const db = getHyperdriveDb(c.env);
    const result = await handleInstantlyWebhook(db, payload);
    return c.json(result);
  } catch (err: any) {
    console.error(`[Instantly Webhook] Error: ${err.message}`);
    return c.json({ error: err.message }, 500);
  }
});

// ─── DocuSign Webhook ───────────────────────────────────────────────────────
app.post("/api/webhooks/docusign", async (c) => {
  const secret = process.env.DOCUSIGN_WEBHOOK_SECRET;
  if (secret) {
    const provided = c.req.header("x-docusign-secret");
    if (!provided || !timingSafeEqualStrings(provided, secret)) {
      return c.json({ error: "Invalid webhook secret" }, 401);
    }
  }
  try {
    const { handleDocuSignWebhook } = await import("../server/webhooks/docusign");
    const payload = await c.req.json();
    const db = getHyperdriveDb(c.env);
    const result = await handleDocuSignWebhook(db, payload);
    return c.json(result);
  } catch (err: any) {
    console.error(`[DocuSign Webhook] Error: ${err.message}`);
    return c.json({ error: err.message }, 500);
  }
});


// ─── Admin ops console (client/src/pages/OpsDashboard.tsx) ─────────────────
app.get("/api/admin/ops", async (c) => {
  const { sdk } = await import("../server/_core/sdk");
  const user = await sdk.authenticateRequest(c.req.raw).catch(() => null);
  if (!user) {
    return c.json({ error: "Not signed in" }, 401);
  }
  if (user.role !== "admin") {
    return c.json({ error: "Admin only" }, 403);
  }
  try {
    const { getOpsSummary } = await import("../server/_core/db-helpers");
    const db = getHyperdriveDb(c.env);
    const summary = await getOpsSummary(db);
    return c.json(summary);
  } catch (err) {
    return c.json({ error: err instanceof Error ? err.message : "ops query failed" }, 500);
  }
});

// Static assets fallback (Vite build output, same dist/public the existing
// worker/index.ts already serves for the marketing page).
app.get("*", (c) => c.env.ASSETS.fetch(c.req.raw));

export default app;
