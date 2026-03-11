import "dotenv/config";
import { fetchRequestHandler } from "@trpc/server/adapters/fetch";
import { COOKIE_NAME, ONE_YEAR_MS } from "@shared/const";
import { appRouter } from "../server/routers";
import {
  createWorkerContext,
  authenticateWorkerContext,
  buildSetCookieHeaders,
  type WorkerTrpcContext,
} from "./context";
import { sdk } from "../server/_core/sdk";
import * as db from "../server/db";
import { runPipelineTick } from "../server/jobs/pipeline-tick";

export interface Env {
  ASSETS: Fetcher;
  [key: string]: string | Fetcher | undefined;
}
// ─── Helpers ──────────────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// ─── OAuth callback ───────────────────────────────────────────────────────────

async function handleOAuthCallback(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");

  if (!code || !state) {
    return jsonResponse({ error: "code and state are required" }, 400);
  }

  try {
    const tokenResponse = await sdk.exchangeCodeForToken(code, state);
    const userInfo = await sdk.getUserInfo(tokenResponse.accessToken);

    if (!userInfo.openId) {
      return jsonResponse({ error: "openId missing from user info" }, 400);
    }

    await db.upsertUser({
      openId: userInfo.openId,
      name: userInfo.name || null,
      email: userInfo.email ?? null,
      loginMethod: userInfo.loginMethod ?? userInfo.platform ?? null,
      lastSignedIn: new Date(),
    });

    const sessionToken = await sdk.createSessionToken(userInfo.openId, {
      name: userInfo.name || "",
      expiresInMs: ONE_YEAR_MS,
    });

    const cookieHeader = `${COOKIE_NAME}=${sessionToken}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${Math.round(ONE_YEAR_MS / 1000)}; Secure`;

    return new Response(null, {
      status: 302,
      headers: {
        Location: "/",
        "Set-Cookie": cookieHeader,
      },
    });
  } catch (error) {
    console.error("[OAuth] Callback failed", error);
    return jsonResponse({ error: "OAuth callback failed" }, 500);
  }
}

// ─── Stripe webhook ───────────────────────────────────────────────────────────

async function handleStripeWebhook(
  request: Request,
  path: string
): Promise<Response> {
  const sig = request.headers.get("stripe-signature");
  if (!sig) {
    return jsonResponse({ error: "Missing stripe-signature header" }, 400);
  }

  try {
    const rawBody = await request.arrayBuffer();
    const bodyBuffer = Buffer.from(rawBody);

    if (path === "/webhooks/stripe") {
      const { handleStripeWebhook: handleWebhook } = await import(
        "../server/webhooks/stripe"
      );
      const result = await handleWebhook(bodyBuffer, sig);
      return jsonResponse(result);
    }

    // Legacy /api/stripe/webhook path
    const { getStripe, processWebhookEvent } = await import(
      "../server/stripe-service"
    );
    const stripe = getStripe();
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!webhookSecret) {
      return jsonResponse({ error: "Webhook secret not configured" }, 500);
    }
    const event = stripe.webhooks.constructEvent(bodyBuffer, sig, webhookSecret);
    const result = await processWebhookEvent(event);
    return jsonResponse({ received: true, type: event.type, handled: result.handled });
  } catch (err: any) {
    console.error("[Stripe Webhook] Error:", err.message);
    return jsonResponse({ error: err.message }, 400);
  }
}

// ─── Health ───────────────────────────────────────────────────────────────────

async function handleHealth(): Promise<Response> {
  let dbConnected = false;
  try {
    dbConnected = !!(await db.getDb());
  } catch {
    dbConnected = false;
  }
  return jsonResponse({
    ok: dbConnected,
    timestamp: new Date().toISOString(),
    database: { connected: dbConnected },
  }, dbConnected ? 200 : 503);
}

// ─── Worker export ────────────────────────────────────────────────────────────

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Populate process.env from Worker bindings so existing code works unchanged
    for (const [k, v] of Object.entries(env)) {
      if (v !== undefined && !process.env[k]) {
        (process.env as any)[k] = v;
      }
    }

    const url = new URL(request.url);
    const path = url.pathname;

    // CORS preflight
    if (request.method === "OPTIONS") {
      return new Response(null, {
        status: 204,
        headers: {
          "Access-Control-Allow-Origin": request.headers.get("Origin") ?? "*",
          "Access-Control-Allow-Methods": "GET,POST,PUT,PATCH,DELETE,OPTIONS",
          "Access-Control-Allow-Headers": "Content-Type, Authorization",
          "Access-Control-Allow-Credentials": "true",
        },
      });
    }

    // Health
    if (path === "/health" || path === "/api/health") {
      return handleHealth();
    }

    // OAuth
    if (path === "/api/oauth/callback") {
      return handleOAuthCallback(request);
    }

    // Stripe webhooks (raw body)
    if (path === "/api/stripe/webhook" || path === "/webhooks/stripe") {
      return handleStripeWebhook(request, path);
    }

    // tRPC
    if (path.startsWith("/api/trpc/")) {
      const ctx = createWorkerContext(request);
      await authenticateWorkerContext(ctx);

      const response = await fetchRequestHandler({
        endpoint: "/api/trpc",
        req: request,
        router: appRouter,
        createContext: () => ctx as WorkerTrpcContext,
        responseMeta: ({ ctx: rCtx }) => {
          const c = rCtx as WorkerTrpcContext | undefined;
          if (!c?._pendingCookies?.length) return {};
          return {
            headers: { "Set-Cookie": buildSetCookieHeaders(c) as any },
          };
        },
        onError: ({ error, path: p }) => {
          console.error(`[tRPC] ${p}:`, error.message);
        },
      });

      // Attach CORS headers
      const origin = request.headers.get("Origin");
      if (origin) {
        response.headers.set("Access-Control-Allow-Origin", origin);
        response.headers.set("Access-Control-Allow-Credentials", "true");
        response.headers.set("Vary", "Origin");
      }
      return response;
    }

    // Delegate to static assets (serves dist/public, SPA fallback for unknown routes)
    return env.ASSETS.fetch(request);
  },

  async scheduled(
    _event: ScheduledEvent,
    env: Env,
    ctx: ExecutionContext
  ): Promise<void> {
    // Populate process.env
    for (const [k, v] of Object.entries(env)) {
      if (v !== undefined && !process.env[k]) {
        (process.env as any)[k] = v;
      }
    }

    ctx.waitUntil(
      runPipelineTick()
        .then((result) =>
          console.log("[AgentZ cron] Tick:", JSON.stringify(result))
        )
        .catch((err) => console.error("[AgentZ cron] Failed:", err))
    );
  },
};
