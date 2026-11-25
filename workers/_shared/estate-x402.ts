/**
 * Unpaid x402 on sister apexes (qron.space, strainchain.io, govchain.us).
 *
 * x402scan registerFromOrigin probes `{origin}/api/x402`. OpenAPI already
 * claimed POST /api/x402; live those hosts 404'd the path. Serve the same
 * unpaid 402 v2 + PAYMENT-REQUIRED + extensions.bazaar that authichain.com
 * does, with this host as resource.url so the listing is the sister origin.
 * A body that names a non-UUID seal, or uses productId/serial as the key,
 * is 400 before that challenge. An empty body stays 402.
 *
 * payTo / asset / price come from the published AuthiChain rail
 * (X402_PUBLISHED_PAY_TO = 0x5db511706FB6317cd23A7655F67450c5AC6e6AA2, Base USDC, $0.05). Do not rebind
 * X402_FACILITATOR_URL. Do not invent a second wallet. Settle needs the
 * same secret bind as authichain-com (bind-x402-secrets.yml + Deploy
 * Workers). Without X402_FACILITATOR_URL, health is not_configured and a
 * third-party pay is a dead listing.
 */
import {
  buildPaymentRequired,
  forwardPaidVerify,
  parsePaymentHeader,
  readPaymentProofHeader,
  X402_REGISTRY_NOT_BOUND,
  X402_RESOURCE_DESCRIPTION,
  x402AgentCard,
  x402HealthReport,
  x402PaidVerifyStatus,
  x402PriceUsd,
  x402ScanFanout,
  X402_PUBLISHED_PAY_TO,
  type X402EnvVars,
  type X402HealthEnv,
  type X402PaidVerifyStatus,
  type X402VerifyBinding,
} from "../../src/lib/x402.ts";
import {
  coerceSealBody,
  unpaidSealRefusal as refuseUnpaidSeal,
} from "../../src/lib/agent-verify.ts";
import { ESTATE_BRANDS } from "./estate-landing.ts";
import {
  guardedForward,
  scopedReplayStore,
  type ReplayStore,
} from "../../src/lib/paid-seal-verify.ts";
import type { SisterDiscoveryBrand } from "./estate-agent-discovery.ts";
import {
  sisterBrandFromHost,
  sisterX402Catalog,
} from "./estate-x402-catalog.ts";

export type SisterX402Env = X402EnvVars & {
  /** Optional KV for the x402 replay guard (CFA-343/356). Unbound = 503 replay_store_unavailable (CFA-363). */
  X402_REPLAY_KV?: ReplayStore;
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

/** Linear trailing-slash strip — CodeQL flags /\/+$/ as quadratic. */
function normalizePath(pathname: string): string {
  if (pathname.length <= 1) return pathname;
  let end = pathname.length;
  while (end > 1 && pathname.charCodeAt(end - 1) === 47) end--;
  return pathname.slice(0, end);
}

export function sisterOrigin(brand: SisterDiscoveryBrand): string {
  return ESTATE_BRANDS[brand].url;
}

export function isSisterX402Path(pathname: string): boolean {
  const p = normalizePath(pathname);
  return (
    p === "/api/x402" ||
    p === "/api/x402/health" ||
    p === "/api/x402/catalog" ||
    p === "/.well-known/x402.json" ||
    p === "/.well-known/x402" ||
    isAgentCardPath(p)
  );
}

function isAgentCardPath(pathname: string): boolean {
  const p = normalizePath(pathname);
  return (
    p === "/.well-known/agent-card.json" || p === "/.well-known/agent.json"
  );
}

/**
 * A2A Agent Card on a sister host. Same skills and live x402 terms as
 * authichain.com; the A2A JSON-RPC endpoint and paid verify stay canonical on
 * authichain.com, and this host's own /mcp is listed first so an agent that
 * probed the brand can use its tools. No contact email, no ERC-8004.
 */
async function sisterAgentCardResponse(
  request: Request,
  env: SisterX402Env | undefined,
  bound: boolean
): Promise<Response> {
  hydrateX402(env);
  const url = new URL(request.url);
  const brand = sisterBrandFromHost(url.hostname);
  const base = await x402AgentCard(healthEnv(env, bound));
  if (!brand) return json(200, base);
  const site = ESTATE_BRANDS[brand];
  return json(200, {
    ...base,
    name: `${site.name} by AuthiChain`,
    provider: { organization: "AuthiChain", url: site.url },
    additionalInterfaces: [
      { url: `${site.url}/mcp`, transport: "HTTP+JSON" },
      ...base.additionalInterfaces,
    ],
  });
}

function isHealthPath(pathname: string): boolean {
  const p = normalizePath(pathname);
  return p === "/api/x402" || p === "/api/x402/health";
}

function isCatalogPath(pathname: string): boolean {
  const p = normalizePath(pathname);
  return p === "/api/x402/catalog" || p === "/.well-known/x402.json";
}

function isFanoutPath(pathname: string): boolean {
  return normalizePath(pathname) === "/.well-known/x402";
}

function isPaidPath(pathname: string): boolean {
  return normalizePath(pathname) === "/api/x402";
}

function publishedPayTo(env?: SisterX402Env): string {
  return (
    env?.X402_PAY_TO?.trim() ||
    process.env.X402_PAY_TO?.trim() ||
    X402_PUBLISHED_PAY_TO
  );
}

function hydrateX402(env?: SisterX402Env) {
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

/**
 * Sister paid-verify status. Bound means this worker forwards to
 * authichain.com's registry; sister-origin settlement is not claimed.
 */
export function sisterPaidVerifyStatus(bound: boolean): X402PaidVerifyStatus {
  const status = x402PaidVerifyStatus(bound);
  if (!status.bound) return status;
  return {
    ...status,
    detail:
      "When bound, paid verification is forwarded to authichain.com's registry.",
  };
}

function healthEnv(env?: SisterX402Env, bound = false): X402HealthEnv {
  return {
    // Bound only when a VERIFY_APP binding is present to forward paid calls.
    X402_PAID_VERIFY_PATH: bound ? "verify_app" : undefined,
    X402_PAY_TO: publishedPayTo(env),
    X402_FACILITATOR_URL:
      env?.X402_FACILITATOR_URL || process.env.X402_FACILITATOR_URL,
    X402_NETWORK: env?.X402_NETWORK || process.env.X402_NETWORK,
    X402_CHAIN_ID: env?.X402_CHAIN_ID || process.env.X402_CHAIN_ID,
    X402_USDC_ASSET: env?.X402_USDC_ASSET || process.env.X402_USDC_ASSET,
    X402_PRICE_USD: env?.X402_PRICE_USD || process.env.X402_PRICE_USD,
    X402_DAILY_CAP_USD:
      env?.X402_DAILY_CAP_USD || process.env.X402_DAILY_CAP_USD,
  };
}

function paidResourceUrl(request: Request): string {
  const url = new URL(request.url);
  return `${url.protocol}//${url.host}${normalizePath(url.pathname)}`;
}

async function healthResponse(
  env?: SisterX402Env,
  bound = false
): Promise<Response> {
  hydrateX402(env);
  const report = await x402HealthReport(healthEnv(env, bound));
  // Sisters do not serve /api/v1/agent-verify (that path 404s here).
  // Health must not advertise it; paid verify is POST /api/x402.
  return json(200, {
    ...report,
    endpoint: "/api/x402",
    aliases: report.aliases.filter(path => path !== "/api/v1/agent-verify"),
    paidVerify: sisterPaidVerifyStatus(bound),
  });
}

async function catalogResponse(
  request: Request,
  env?: SisterX402Env,
  bound = false
): Promise<Response> {
  hydrateX402(env);
  const brand = sisterBrandFromHost(new URL(request.url).hostname);
  return json(200, await sisterX402Catalog(brand, healthEnv(env, bound)));
}

const CANONICAL_AGENT_VERIFY = "https://authichain.com/api/v1/agent-verify";

function fanoutResponse(request: Request): Response {
  const url = new URL(request.url);
  const origin = `${url.protocol}//${url.host}`;
  const local = x402ScanFanout(origin);
  // This worker does not serve /api/v1/agent-verify (sisters 404 that path).
  // The seal registry is bound on authichain.com. List that absolute URL
  // first, then this origin's /api/x402 so a scanner still sees the host
  // it probed. Drop an origin-relative agent-verify entry so a shared
  // fan-out helper cannot advertise the 404.
  const resources = [CANONICAL_AGENT_VERIFY];
  for (const resource of local.resources) {
    if (resource === CANONICAL_AGENT_VERIFY) continue;
    let pathname = "";
    try {
      pathname = new URL(resource).pathname;
    } catch {
      continue;
    }
    if (pathname === "/api/v1/agent-verify") continue;
    resources.push(resource);
  }
  return json(200, { version: 1 as const, resources });
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
  request: Request
): Promise<{ status: number; body: unknown } | null> {
  return refuseUnpaidSeal(
    coerceSealBody(parseJsonObject(await request.clone().text()))
  );
}

async function agentVerify(
  request: Request,
  env?: SisterX402Env,
  verifyApp?: X402VerifyBinding,
  brand?: SisterDiscoveryBrand
): Promise<Response> {
  hydrateX402(env);
  const payTo = publishedPayTo(env);
  const resource = paidResourceUrl(request);
  const priceUsd = x402PriceUsd(env?.X402_PRICE_USD);
  const required = buildPaymentRequired({
    resource,
    priceUsd,
    payTo,
    description: X402_RESOURCE_DESCRIPTION,
  });
  const proofHeader = readPaymentProofHeader(name => request.headers.get(name));
  const proof = parsePaymentHeader(proofHeader);
  if (!proof || !proofHeader) {
    const refusal = await unpaidSealRefusal(request);
    if (refusal) return json(refusal.status, refusal.body);
    return json(402, required.v2, required.headers);
  }

  if (verifyApp) {
    const bodyText = await request.text();
    let sealId: string | null = null;
    try {
      const b = JSON.parse(bodyText) as { sealId?: unknown };
      sealId = typeof b?.sealId === "string" ? b.sealId : null;
    } catch {
      sealId = null;
    }
    return guardedForward({
      proofHeader,
      replayStore: scopedReplayStore(
        env?.X402_REPLAY_KV,
        brand ?? sisterBrandFromHost(new URL(request.url).hostname) ?? "sister"
      ),
      sealId,
      forward: () =>
        forwardPaidVerify(verifyApp, request, proofHeader, bodyText),
    });
  }
  // No registry lookup is bound here: refuse before settlePayment() so the
  // agent is never charged for an answer that cannot be real.
  return json(503, X402_REGISTRY_NOT_BOUND);
}

/**
 * Sister paid verify settles on authichain.com. The VERIFY_APP binding on a
 * sister worker points at the authichain-com Worker, which owns the bound seal
 * lookup and the authenticated facilitator settle. That Worker routes by host
 * (non-authichain hosts go to microsites first), so every forwarded request is
 * rewritten to the canonical https://authichain.com origin. The buyer's
 * EIP-3009 authorization binds amount, payTo, asset and nonce, not the URL, so
 * a payment signed against a sister 402 settles there unchanged.
 */
export function canonicalVerifyBinding(
  binding: X402VerifyBinding
): X402VerifyBinding {
  return {
    fetch(request: Request): Promise<Response> {
      const url = new URL(request.url);
      url.protocol = "https:";
      url.host = "authichain.com";
      return binding.fetch(new Request(url.toString(), request));
    },
  };
}

/** Serve GET/HEAD health + catalog and unpaid POST 402 on a sister landing. */
export async function tryHandleSisterX402(
  request: Request,
  env: SisterX402Env = {},
  verifyApp?: X402VerifyBinding,
  /** Fixed per worker; scopes replay keys. Falls back to the host's brand. */
  brand?: SisterDiscoveryBrand
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!isSisterX402Path(url.pathname)) return null;
  const canonical = verifyApp ? canonicalVerifyBinding(verifyApp) : undefined;

  if (request.method === "HEAD") {
    return new Response(null, {
      status: 204,
      headers: {
        "Cache-Control": "private, no-store",
        "CDN-Cache-Control": "no-store",
      },
    });
  }

  if (request.method === "GET" && isCatalogPath(url.pathname)) {
    return catalogResponse(request, env, !!canonical);
  }

  if (request.method === "GET" && isFanoutPath(url.pathname)) {
    return fanoutResponse(request);
  }

  if (request.method === "GET" && isAgentCardPath(url.pathname)) {
    return sisterAgentCardResponse(request, env, !!canonical);
  }

  if (request.method === "GET" && isHealthPath(url.pathname)) {
    return healthResponse(env, !!canonical);
  }

  if (request.method === "POST" && isPaidPath(url.pathname)) {
    return agentVerify(request, env, canonical, brand);
  }

  return json(405, { error: "method not allowed" });
}
