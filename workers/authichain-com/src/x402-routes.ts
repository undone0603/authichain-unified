/**
 * x402 on the landing worker so GET /api/x402 and /api/x402/health go live
 * via Deploy authichain-com, without waiting for gated edge-router deploys.
 *
 * Must run BEFORE APP_PREFIXES proxy — /api is otherwise forwarded to
 * authichain-edge-router, whose unmounted GET /api/* falls through to ASSETS
 * and answers an empty 404.
 *
 * GET  /api/x402/health → 200 health (not_configured is OK — GET must not
 *      404). `freeCalls` says whether the daily UUID allowance is armed. It
 *      never includes the salt or keys.
 * GET  /api/x402 + /api/v1/agent-verify → 402 advertisement when unpaid.
 *      GET-first crawlers treat a 200 here as "free" and never buy. Health
 *      stays on /api/x402/health. GET never consumes the free UUID allowance.
 *      A GET that already carries a payment proof is settled the same as
 *      POST (empty body → missing-seal evidence). Otherwise GET-paying
 *      scouts retry with a proof and receive the same 402.
 * HEAD /api/x402 + /api/v1/agent-verify → 402 with the same PAYMENT-REQUIRED
 *      header as unpaid GET and an empty body. PayAI probes HEAD first and
 *      only GET on 404/405; HEAD 204 looked alive with no paywall.
 *      Other x402 paths keep HEAD 204.
 * GET  /api/x402/catalog + /.well-known/x402.json → machine catalog
 * GET  /api/x402/listing → PayAPI-ready pack copied from health
 * GET  /api/x402/growth → directories + skills + sisters
 * GET  /.well-known/x402 → x402scan fan-out (version + resources)
 * GET  /openapi.json → OpenAPI 3.1 with x-payment-info
 * POST /api/x402 + /api/v1/agent-verify → 402 challenge when unpaid. A paid
 *      call reads auth_seals on this worker when SUPABASE_URL and a key are
 *      set (src/lib/paid-seal-verify.ts) and settles only after that read.
 *      Otherwise it forwards over VERIFY_APP. With neither, 503
 *      registry_not_bound before any settlement (X402_REGISTRY_NOT_BOUND).
 *      The bazaar example UUID and the stale PayAI sample `demo` are never a
 *      free 200: crawlers POST those bodies and treat 2xx as payability=free.
 *      Real UUIDs still get 3/IP/UTC-day. Empty unpaid POST stays 402.
 *
 * Do not rebind X402_PAY_TO away from the owner-authorized treasury
 * 0x5db511706FB6317cd23A7655F67450c5AC6e6AA2. Do not rebind
 * X402_FACILITATOR_URL / X402_USDC_ASSET.
 */
import {
  buildPaymentRequired,
  forwardPaidVerify,
  parsePaymentHeader,
  readPaymentProofHeader,
  X402_REGISTRY_NOT_BOUND,
  isDiscoveryExampleSealId,
  x402Catalog,
  x402HealthReport,
  x402OpenApiDocument,
  x402PriceUsd,
  x402ScanFanout,
  type X402EnvVars,
  type X402HealthEnv,
  type X402VerifyBinding,
} from "../../../src/lib/x402";
import { growthDiscovery, x402ListingPack } from "../../../src/lib/x402-growth";
import { sealBaseline } from "../../../src/lib/seal-baseline";
import {
  readSeal,
  guardedForward,
  scopedReplayStore,
  resolvePaidSealVerify,
  type ReplayStore,
  sealLookupCredentials,
  type SealLookupEnv,
} from "../../../src/lib/paid-seal-verify";
import {
  coerceSealBody,
  parseSealRequest,
  unpaidSealRefusal,
} from "../../../src/lib/agent-verify";
import {
  claimFreeCall,
  FREE_CALLS_HEADER,
  freeDailyCalls,
  supabaseFreeTierStore,
  type FreeTierStore,
} from "../../../src/lib/x402-free-tier";

export type X402Env = X402EnvVars &
  SealLookupEnv & {
    X402_FREE_DAILY_CALLS?: string;
    X402_FREE_IP_SALT?: string;
    /** [vars] in wrangler.toml; edge router derives the same via paidVerifyPath. */
    X402_PAID_VERIFY_PATH?: string;
    /** KV namespace for the x402 replay guard (CFA-343). */
    X402_REPLAY_KV?: ReplayStore;
  };

/** Test seams: inject the free-tier counter store and clock. */
export type X402Options = {
  freeStore?: FreeTierStore | null;
  now?: Date;
  fetchImpl?: typeof fetch;
  replayStore?: ReplayStore | null;
};

const JSON_HEADERS = {
  "Cache-Control": "private, no-store",
  "CDN-Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

function json(
  status: number,
  body: unknown,
  extraHeaders?: Record<string, string>
): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...JSON_HEADERS, ...extraHeaders },
  });
}

function normalizePath(pathname: string): string {
  if (pathname.length > 1 && pathname.endsWith("/")) {
    return pathname.replace(/\/+$/, "");
  }
  return pathname;
}

export function isX402Path(pathname: string): boolean {
  const p = normalizePath(pathname);
  return (
    p === "/api/x402" ||
    p === "/api/x402/health" ||
    p === "/api/x402/catalog" ||
    p === "/api/x402/listing" ||
    p === "/api/x402/growth" ||
    p === "/api/v1/agent-verify" ||
    p === "/.well-known/x402" ||
    p === "/.well-known/x402.json" ||
    p === "/openapi.json"
  );
}

function isHealthPath(pathname: string): boolean {
  return normalizePath(pathname) === "/api/x402/health";
}

function isCatalogPath(pathname: string): boolean {
  const p = normalizePath(pathname);
  return p === "/api/x402/catalog" || p === "/.well-known/x402.json";
}

function isListingPath(pathname: string): boolean {
  return normalizePath(pathname) === "/api/x402/listing";
}

function isGrowthPath(pathname: string): boolean {
  return normalizePath(pathname) === "/api/x402/growth";
}

function isFanoutPath(pathname: string): boolean {
  return normalizePath(pathname) === "/.well-known/x402";
}

function isOpenApiPath(pathname: string): boolean {
  return normalizePath(pathname) === "/openapi.json";
}

function isPaidPath(pathname: string): boolean {
  const p = normalizePath(pathname);
  return p === "/api/x402" || p === "/api/v1/agent-verify";
}

function hydrateX402(env?: X402Env) {
  if (!env) return;
  const keys: Array<keyof X402EnvVars> = [
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

function healthEnv(env?: X402Env): X402HealthEnv {
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
    X402_PAID_VERIFY_PATH: env?.X402_PAID_VERIFY_PATH,
  };
}

export type X402FreeCallsHealth = {
  armed: boolean;
  limit: number;
  window: "utc_day";
  requires: "sealId UUID";
};

/**
 * Public view of the daily free allowance. Armed only when this worker can
 * actually grant a call: a service-role registry, a non-empty IP salt, and
 * a positive limit. The salt and keys stay out of the JSON.
 */
export function x402FreeCallsHealth(env?: X402Env): X402FreeCallsHealth {
  const limit = freeDailyCalls(env?.X402_FREE_DAILY_CALLS);
  const salt = (env?.X402_FREE_IP_SALT || "").trim();
  const creds = sealLookupCredentials(env);
  const armed = salt.length > 0 && creds?.role === "service" && limit > 0;
  return {
    armed,
    limit: armed ? limit : 0,
    window: "utc_day",
    requires: "sealId UUID",
  };
}

async function healthResponse(env?: X402Env): Promise<Response> {
  hydrateX402(env);
  const report = await x402HealthReport(healthEnv(env));
  return json(200, { ...report, freeCalls: x402FreeCallsHealth(env) });
}

async function catalogResponse(env?: X402Env): Promise<Response> {
  hydrateX402(env);
  return json(200, await x402Catalog(healthEnv(env)));
}

async function listingResponse(env?: X402Env): Promise<Response> {
  hydrateX402(env);
  const health = await x402HealthReport(healthEnv(env));
  return json(200, x402ListingPack(health));
}

async function growthResponse(env?: X402Env): Promise<Response> {
  hydrateX402(env);
  const health = await x402HealthReport(healthEnv(env));
  return json(200, growthDiscovery(health));
}

function fanoutResponse(): Response {
  return json(200, x402ScanFanout());
}

async function openApiResponse(env?: X402Env): Promise<Response> {
  hydrateX402(env);
  return json(200, await x402OpenApiDocument(healthEnv(env)));
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

/**
 * Free daily allowance (X402_FREE_DAILY_CALLS, default 3 per client IP per
 * UTC day). Returns null when the caller must pay; never settles anything.
 */
async function tryFreeCall(
  request: Request,
  env: X402Env | undefined,
  opts: X402Options | undefined
): Promise<{ response: Response | null; remaining: number | null }> {
  const raw = coerceSealBody(parseJsonObject(await request.clone().text()));
  const refusal = unpaidSealRefusal(raw);
  if (refusal) {
    return { response: json(refusal.status, refusal.body), remaining: null };
  }
  const parsed = parseSealRequest(raw);
  if (!parsed.ok) {
    // Empty body or listing sample (`demo` / bazaar UUID): 402 so a scanner
    // can read the price. An empty body with a valid payment is settled as
    // missing-seal evidence.
    return { response: null, remaining: null };
  }
  // Listing example UUID: crawlers POST this body. A free 200 is classified
  // as payability=free so they never buy. Do not consume the real-UUID
  // allowance. Paid lookup of this id is still missing-seal evidence.
  if (isDiscoveryExampleSealId(parsed.sealId)) {
    return { response: null, remaining: null };
  }
  const limit = freeDailyCalls(env?.X402_FREE_DAILY_CALLS);
  const creds = sealLookupCredentials(env);
  if (!creds || limit <= 0)
    return { response: null, remaining: limit <= 0 ? 0 : null };
  const fetchImpl = opts?.fetchImpl ?? fetch;
  const store =
    opts && "freeStore" in opts
      ? (opts.freeStore ?? null)
      : supabaseFreeTierStore(creds, fetchImpl);
  const claim = await claimFreeCall({
    request,
    store,
    limit,
    now: opts?.now ?? new Date(),
    salt: env?.X402_FREE_IP_SALT,
  });
  if (!claim.free) return { response: null, remaining: claim.remaining };
  const headers = { [FREE_CALLS_HEADER]: String(claim.remaining) };
  const lookup = await readSeal(fetchImpl, creds, parsed.sealId);
  if (!lookup.ok) {
    return {
      response: json(
        503,
        {
          error: "registry_unavailable",
          settled: false,
          freeCallsRemaining: claim.remaining,
        },
        headers
      ),
      remaining: claim.remaining,
    };
  }
  const answer = sealBaseline(lookup.seal);
  return {
    response: json(
      200,
      {
        ...answer,
        subject: parsed.sealId,
        settlement: null,
        free: true,
        freeCallsRemaining: claim.remaining,
        timestamp: new Date().toISOString(),
      },
      headers
    ),
    remaining: claim.remaining,
  };
}

function unpaidQuote(request: Request, env?: X402Env): Response {
  hydrateX402(env);
  const payTo = (env?.X402_PAY_TO || process.env.X402_PAY_TO || "").trim();
  const resource = new URL(request.url).toString();
  const priceUsd = x402PriceUsd(env?.X402_PRICE_USD);
  if (!payTo) {
    return json(503, {
      error: "payments_not_configured",
      status: "not_configured",
      health: "/api/x402/health",
    });
  }
  const required = buildPaymentRequired({
    resource,
    priceUsd,
    payTo,
    description: "AuthiChain agent verification",
  });
  return json(402, required.v2, required.headers);
}

async function agentVerify(
  request: Request,
  env?: X402Env,
  verifyApp?: X402VerifyBinding,
  opts?: X402Options
): Promise<Response> {
  hydrateX402(env);
  const payTo = (env?.X402_PAY_TO || process.env.X402_PAY_TO || "").trim();
  const resource = new URL(request.url).toString();
  const priceUsd = x402PriceUsd(env?.X402_PRICE_USD);
  if (!payTo) {
    return json(503, {
      error: "payments_not_configured",
      status: "not_configured",
      health: "/api/x402/health",
    });
  }

  const required = buildPaymentRequired({
    resource,
    priceUsd,
    payTo,
    description: "AuthiChain agent verification",
  });
  const proofHeader = readPaymentProofHeader(name => request.headers.get(name));
  const proof = parsePaymentHeader(proofHeader);
  if (!proof || !proofHeader) {
    const free = await tryFreeCall(request, env, opts);
    if (free.response) return free.response;
    return json(402, required.v2, {
      ...required.headers,
      ...(free.remaining === null
        ? {}
        : { [FREE_CALLS_HEADER]: String(free.remaining) }),
    });
  }

  const bodyText = await request.text();
  const decision = await resolvePaidSealVerify({
    hasVerifyApp: Boolean(verifyApp),
    proofHeader,
    bodyText,
    resource,
    priceUsd,
    payTo,
    description: "AuthiChain agent verification",
    env,
    fetchImpl: opts?.fetchImpl,
    replayStore:
      opts?.replayStore ??
      scopedReplayStore(env?.X402_REPLAY_KV, "authichain-com"),
  });
  if (decision.action === "answer") {
    return json(decision.status, decision.body, decision.headers);
  }
  if (decision.action === "forward" && verifyApp) {
    const sealReq = parseSealRequest(coerceSealBody(parseJsonObject(bodyText)));
    return guardedForward({
      proofHeader,
      replayStore:
        opts?.replayStore ??
        scopedReplayStore(env?.X402_REPLAY_KV, "authichain-com"),
      sealId: sealReq.ok ? sealReq.sealId : null,
      forward: () =>
        forwardPaidVerify(verifyApp, request, proofHeader, bodyText),
    });
  }
  // No registry lookup is bound here: refuse before settlePayment() so the
  // agent is never charged for an answer that cannot be real.
  return json(503, X402_REGISTRY_NOT_BOUND);
}

export async function tryHandleX402(
  request: Request,
  env: X402Env = {},
  verifyApp?: X402VerifyBinding,
  opts?: X402Options
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!isX402Path(url.pathname)) return null;

  if (request.method === "HEAD") {
    if (isPaidPath(url.pathname)) {
      const quote = unpaidQuote(request, env);
      return new Response(null, {
        status: quote.status,
        headers: quote.headers,
      });
    }
    return new Response(null, {
      status: 204,
      headers: {
        "Cache-Control": "private, no-store",
        "CDN-Cache-Control": "no-store",
      },
    });
  }

  if (request.method === "GET" && isCatalogPath(url.pathname)) {
    return catalogResponse(env);
  }

  if (request.method === "GET" && isListingPath(url.pathname)) {
    return listingResponse(env);
  }

  if (request.method === "GET" && isGrowthPath(url.pathname)) {
    return growthResponse(env);
  }

  if (request.method === "GET" && isFanoutPath(url.pathname)) {
    return fanoutResponse();
  }

  if (request.method === "GET" && isOpenApiPath(url.pathname)) {
    return openApiResponse(env);
  }

  if (request.method === "GET" && isHealthPath(url.pathname)) {
    return healthResponse(env);
  }

  if (request.method === "GET" && isPaidPath(url.pathname)) {
    const proofHeader = readPaymentProofHeader(name =>
      request.headers.get(name)
    );
    if (proofHeader && parsePaymentHeader(proofHeader)) {
      return agentVerify(request, env, verifyApp, opts);
    }
    return unpaidQuote(request, env);
  }

  if (request.method === "POST" && isPaidPath(url.pathname)) {
    return agentVerify(request, env, verifyApp, opts);
  }

  return json(405, { error: "method not allowed" });
}

/** Brand app host root — no SPA index.html, so / must not 404. */
export function isBrandAppHostname(host: string): boolean {
  return host.split(":")[0].toLowerCase() === "app.authichain.com";
}

export function tryHandleAppHost(request: Request): Response | null {
  const url = new URL(request.url);
  const host = (request.headers.get("host") || url.hostname || "").split(
    ":"
  )[0];
  if (!isBrandAppHostname(host)) return null;
  const p = url.pathname;
  if (p !== "/" && p !== "") return null;
  return new Response(null, {
    status: 302,
    headers: {
      Location: "/dashboard",
      "Cache-Control": "private, no-store",
    },
  });
}
