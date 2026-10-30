/**
 * x402 agent micropayment routes on authichain-edge-router.
 *
 * GET  /api/x402/health → public health (200, not_configured OK).
 * GET  /api/x402 + /api/v1/agent-verify → 402 advertisement when unpaid
 *      (same quote as POST). Query strings stay on this worker because the
 *      Cloudflare route is authichain.com/api/x402* / agent-verify*; a 200
 *      health body here made GET-first crawlers treat the paywall as free.
 * HEAD /api/x402 + /api/v1/agent-verify → 402 with PAYMENT-REQUIRED and an
 *      empty body. Other x402 paths keep their GET handlers.
 * GET  /api/x402/catalog + /.well-known/x402.json → machine catalog
 * GET  /api/x402/listing + /api/x402/growth → PayAPI pack and directory list.
 *      authichain.com/api/x402* lands on this worker, so a missing route here
 *      is a public 404 even when the apex worker implements the same path.
 * GET  /.well-known/x402 → x402scan fan-out (version + resources)
 * GET  /openapi.json → OpenAPI 3.1 with x-payment-info
 * POST /api/x402 + /api/v1/agent-verify → 402 advertisement when unpaid and
 *      the body is empty. A body that names a non-UUID seal, or uses
 *      productId/serial as the key, is 400 before any payment challenge. A
 *      paid call reads auth_seals on this worker when SUPABASE_URL and a key
 *      are set, and settles only after that read. Otherwise it is forwarded
 *      over VERIFY_APP, or refused 503 before settlement when neither is set.
 *
 * Do not rebind X402_PAY_TO away from the owner-authorized payTo EOA
 * 0x5db511706FB6317cd23A7655F67450c5AC6e6AA2. Do not rebind
 * X402_FACILITATOR_URL / X402_USDC_ASSET.
 *
 * Facilitator is optional. Without X402_FACILITATOR_URL the health report is
 * `not_configured` and paid settlement stays closed ($0 path).
 */
import type { Hono } from "hono";
import {
  buildPaymentRequired,
  forwardPaidVerify,
  parsePaymentHeader,
  readPaymentProofHeader,
  X402_REGISTRY_NOT_BOUND,
  X402_RESOURCE_DESCRIPTION,
  x402Catalog,
  x402HealthReport,
  x402OpenApiDocument,
  x402PriceUsd,
  x402ScanFanout,
  type X402HealthEnv,
  type X402VerifyBinding,
} from "../src/lib/x402";
import { parseSealRequest } from "../src/lib/agent-verify";
import {
  coerceSealBody,
  unpaidSealRefusal as refuseUnpaidSeal,
} from "../src/lib/agent-verify";
import {
  guardedForward,
  resolvePaidSealVerify,
  scopedReplayStore,
  sealLookupCredentials,
  type ReplayStore,
  type SealLookupEnv,
} from "../src/lib/paid-seal-verify";
import { growthDiscovery, x402ListingPack } from "../src/lib/x402-growth";

const NO_STORE = { "Cache-Control": "private, no-store" };

type X402Bindings = X402HealthEnv &
  SealLookupEnv & {
    X402_PAY_TO?: string;
    NODE_ENV?: string;
    /** x402 replay guard (CFA-366). Unbound = paid path returns 503. */
    X402_REPLAY_KV?: ReplayStore;
  };

/** VERIFY_APP is a Fetcher, which X402HealthEnv's string index can't hold. */
function verifyAppBinding(env: unknown): X402VerifyBinding | undefined {
  const binding = (env as { VERIFY_APP?: X402VerifyBinding } | undefined)
    ?.VERIFY_APP;
  return typeof binding?.fetch === "function" ? binding : undefined;
}

/**
 * Which registry path this worker holds for a paid verify, matching the order
 * agentVerify uses: auth_seals read first, then the VERIFY_APP forward.
 */
export function paidVerifyPath(
  env?: X402Bindings
): "seal_lookup" | "verify_app" | undefined {
  if (sealLookupCredentials(env)) return "seal_lookup";
  if (verifyAppBinding(env)) return "verify_app";
  return undefined;
}

function hydrateX402(env?: X402Bindings) {
  if (!env) return;
  const keys: Array<keyof X402HealthEnv> = [
    "X402_PAY_TO",
    "X402_FACILITATOR_URL",
    "X402_NETWORK",
    "X402_CHAIN_ID",
    "X402_USDC_ASSET",
    "X402_PRICE_USD",
    "X402_DAILY_CAP_USD",
  ];
  for (const name of keys) {
    const value = env[name];
    if (value && !process.env[name]) process.env[name] = value;
  }
}

function healthEnv(env?: X402Bindings): X402HealthEnv {
  return {
    X402_PAY_TO: env?.X402_PAY_TO || process.env.X402_PAY_TO,
    X402_FACILITATOR_URL:
      env?.X402_FACILITATOR_URL || process.env.X402_FACILITATOR_URL,
    X402_NETWORK: env?.X402_NETWORK || process.env.X402_NETWORK,
    X402_CHAIN_ID: env?.X402_CHAIN_ID || process.env.X402_CHAIN_ID,
    X402_USDC_ASSET: env?.X402_USDC_ASSET || process.env.X402_USDC_ASSET,
    X402_PRICE_USD: env?.X402_PRICE_USD || process.env.X402_PRICE_USD,
    X402_DAILY_CAP_USD:
      env?.X402_DAILY_CAP_USD || process.env.X402_DAILY_CAP_USD,
    X402_PAID_VERIFY_PATH: paidVerifyPath(env),
  };
}

async function health(c: {
  env?: X402Bindings;
  json: (
    body: unknown,
    status?: number,
    headers?: Record<string, string>
  ) => Response;
}) {
  hydrateX402(c.env);
  return c.json(await x402HealthReport(healthEnv(c.env)), 200, NO_STORE);
}

type QuoteCtx = {
  env?: X402Bindings;
  req: { url: string; header: (name: string) => string | undefined };
  json: (
    body: unknown,
    status?: number,
    headers?: Record<string, string>
  ) => Response;
};

function unpaidQuote(c: QuoteCtx): Response {
  hydrateX402(c.env);
  const payTo = (c.env?.X402_PAY_TO || process.env.X402_PAY_TO || "").trim();
  const resource = new URL(c.req.url, "https://authichain.com").toString();
  const priceUsd = x402PriceUsd(c.env?.X402_PRICE_USD);
  if (!payTo) {
    return c.json(
      {
        error: "payments_not_configured",
        status: "not_configured",
        health: "/api/x402/health",
      },
      503,
      NO_STORE
    );
  }
  const required = buildPaymentRequired({
    resource,
    priceUsd,
    payTo,
    description: X402_RESOURCE_DESCRIPTION,
  });
  return c.json(required.v2, 402, { ...NO_STORE, ...required.headers });
}

function unpaidHead(c: QuoteCtx): Response {
  hydrateX402(c.env);
  const payTo = (c.env?.X402_PAY_TO || process.env.X402_PAY_TO || "").trim();
  if (!payTo) {
    return new Response(null, { status: 503, headers: NO_STORE });
  }
  const resource = new URL(c.req.url, "https://authichain.com").toString();
  const priceUsd = x402PriceUsd(c.env?.X402_PRICE_USD);
  const required = buildPaymentRequired({
    resource,
    priceUsd,
    payTo,
    description: X402_RESOURCE_DESCRIPTION,
  });
  return new Response(null, {
    status: 402,
    headers: { ...NO_STORE, ...required.headers },
  });
}

async function unpaidOrPaidGet(c: QuoteCtx & {
  req: QuoteCtx["req"] & {
    raw: Request;
    json: () => Promise<unknown>;
  };
}): Promise<Response> {
  hydrateX402(c.env);
  const proofHeader = readPaymentProofHeader(name => c.req.header(name));
  if (proofHeader && parsePaymentHeader(proofHeader)) {
    return agentVerify(c);
  }
  return unpaidQuote(c);
}

async function listing(c: {
  env?: X402Bindings;
  json: (
    body: unknown,
    status?: number,
    headers?: Record<string, string>
  ) => Response;
}) {
  hydrateX402(c.env);
  const healthReport = await x402HealthReport(healthEnv(c.env));
  return c.json(x402ListingPack(healthReport), 200, NO_STORE);
}

async function growth(c: {
  env?: X402Bindings;
  json: (
    body: unknown,
    status?: number,
    headers?: Record<string, string>
  ) => Response;
}) {
  hydrateX402(c.env);
  const healthReport = await x402HealthReport(healthEnv(c.env));
  return c.json(growthDiscovery(healthReport), 200, NO_STORE);
}

async function catalog(c: {
  env?: X402Bindings;
  json: (
    body: unknown,
    status?: number,
    headers?: Record<string, string>
  ) => Response;
}) {
  hydrateX402(c.env);
  return c.json(await x402Catalog(healthEnv(c.env)), 200, NO_STORE);
}

async function fanout(c: {
  json: (
    body: unknown,
    status?: number,
    headers?: Record<string, string>
  ) => Response;
}) {
  return c.json(x402ScanFanout(), 200, NO_STORE);
}

async function openapi(c: {
  env?: X402Bindings;
  json: (
    body: unknown,
    status?: number,
    headers?: Record<string, string>
  ) => Response;
}) {
  hydrateX402(c.env);
  return c.json(await x402OpenApiDocument(healthEnv(c.env)), 200, NO_STORE);
}

function parseJsonObject(text: string): Record<string, unknown> {
  if (!text.trim()) return {};
  try {
    const value = JSON.parse(text) as unknown;
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

/** 400 when the body cannot be a registry key. Null keeps the 402 challenge. */
async function unpaidSealRefusal(
  rawRequest: Request
): Promise<{ status: number; body: unknown } | null> {
  const raw = parseJsonObject(await rawRequest.clone().text());
  if (Object.keys(raw).length === 0) return null;
  const parsed = parseSealRequest(raw);
  if (parsed.ok) return null;
  return { status: parsed.status, body: parsed.body };
}

async function agentVerify(c: {
  env?: X402Bindings;
  req: {
    url: string;
    raw: Request;
    header: (name: string) => string | undefined;
    json: () => Promise<unknown>;
  };
  json: (
    body: unknown,
    status?: number,
    headers?: Record<string, string>
  ) => Response;
}) {
  hydrateX402(c.env);
  const payTo = (c.env?.X402_PAY_TO || process.env.X402_PAY_TO || "").trim();
  const resource = new URL(c.req.url).toString();
  const priceUsd = x402PriceUsd(c.env?.X402_PRICE_USD);
  if (!payTo) {
    return c.json(
      {
        error: "payments_not_configured",
        status: "not_configured",
        health: "/api/x402/health",
      },
      503,
      NO_STORE
    );
  }

  const required = buildPaymentRequired({
    resource,
    priceUsd,
    payTo,
    description: X402_RESOURCE_DESCRIPTION,
  });
  const proofHeader = readPaymentProofHeader(name => c.req.header(name));
  const proof = parsePaymentHeader(proofHeader);
  if (!proof || !proofHeader) {
    const refusal = await unpaidSealRefusal(c.req.raw);
    if (refusal) return c.json(refusal.body, refusal.status, NO_STORE);
    return c.json(required.v2, 402, { ...NO_STORE, ...required.headers });
  }

  const verifyApp = verifyAppBinding(c.env);
  const bodyText = await c.req.raw.text();
  const decision = await resolvePaidSealVerify({
    hasVerifyApp: Boolean(verifyApp),
    proofHeader,
    bodyText,
    resource,
    priceUsd,
    payTo,
    description: X402_RESOURCE_DESCRIPTION,
    env: c.env,
    replayStore: scopedReplayStore(c.env?.X402_REPLAY_KV, "edge-router"),
  });
  if (decision.action === "answer") {
    return c.json(decision.body, decision.status, {
      ...NO_STORE,
      ...decision.headers,
    });
  }
  if (decision.action === "forward" && verifyApp) {
    let sealId: string | null = null;
    try {
      const b = JSON.parse(bodyText) as { sealId?: unknown };
      sealId = typeof b?.sealId === "string" ? b.sealId : null;
    } catch {
      sealId = null;
    }
    return guardedForward({
      proofHeader,
      replayStore: scopedReplayStore(c.env?.X402_REPLAY_KV, "edge-router"),
      sealId,
      forward: () =>
        forwardPaidVerify(verifyApp, c.req.raw, proofHeader, bodyText),
    });
  }
  // No registry lookup is bound here: refuse before settlePayment() so the
  // agent is never charged for an answer that cannot be real.
  return c.json(X402_REGISTRY_NOT_BOUND, 503, NO_STORE);
}

export function registerX402Routes<
  E extends X402Bindings,
  V extends Record<string, unknown> = Record<string, never>,
>(app: Hono<{ Bindings: E; Variables: V }>): void {
  app.get("/api/x402", c => unpaidOrPaidGet(c));
  app.get("/api/x402/health", c => health(c));
  app.get("/api/x402/catalog", c => catalog(c));
  app.get("/api/x402/listing", c => listing(c));
  app.get("/api/x402/growth", c => growth(c));
  app.get("/.well-known/x402", c => fanout(c));
  app.get("/.well-known/x402.json", c => catalog(c));
  app.get("/openapi.json", c => openapi(c));
  app.get("/api/v1/agent-verify", c => unpaidOrPaidGet(c));
  app.on("HEAD", "/api/x402", c => unpaidHead(c));
  app.on("HEAD", "/api/v1/agent-verify", c => unpaidHead(c));
  app.post("/api/x402", c => agentVerify(c));
  app.post("/api/v1/agent-verify", c => agentVerify(c));
}
