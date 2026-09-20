/**
 * x402 on the landing worker so GET /api/x402 and /api/x402/health go live
 * via Deploy authichain-com, without waiting for gated edge-router deploys.
 *
 * Must run BEFORE APP_PREFIXES proxy — /api is otherwise forwarded to
 * authichain-edge-router, whose unmounted GET /api/* falls through to ASSETS
 * and answers an empty 404.
 *
 * GET  /api/x402 + /api/x402/health + /api/v1/agent-verify → 200 health
 *      (not_configured is OK — GET must not 404)
 * GET  /api/x402/catalog + /.well-known/x402.json → machine catalog
 * POST /api/x402 + /api/v1/agent-verify → 503/402 until facilitator + payTo
 *
 * Do not rebind X402_PAY_TO / X402_FACILITATOR_URL / X402_USDC_ASSET.
 */
import {
  buildPaymentRequired,
  parsePaymentHeader,
  settlePayment,
  verifyPaymentProof,
  x402Catalog,
  x402HealthReport,
  x402PriceUsd,
  type X402HealthEnv,
} from "../../../src/lib/x402";

export type X402Env = X402HealthEnv;

const JSON_HEADERS = {
  "Cache-Control": "private, no-store",
  "CDN-Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
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
    p === "/api/v1/agent-verify" ||
    p === "/.well-known/x402" ||
    p === "/.well-known/x402.json"
  );
}

function isHealthPath(pathname: string): boolean {
  const p = normalizePath(pathname);
  return (
    p === "/api/x402" ||
    p === "/api/x402/health" ||
    p === "/api/v1/agent-verify"
  );
}

function isCatalogPath(pathname: string): boolean {
  const p = normalizePath(pathname);
  return (
    p === "/api/x402/catalog" ||
    p === "/.well-known/x402" ||
    p === "/.well-known/x402.json"
  );
}

function isPaidPath(pathname: string): boolean {
  const p = normalizePath(pathname);
  return p === "/api/x402" || p === "/api/v1/agent-verify";
}

function hydrateX402(env?: X402Env) {
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
  };
}

async function healthResponse(env?: X402Env): Promise<Response> {
  hydrateX402(env);
  return json(200, await x402HealthReport(healthEnv(env)));
}

async function catalogResponse(env?: X402Env): Promise<Response> {
  hydrateX402(env);
  return json(200, await x402Catalog(healthEnv(env)));
}

async function agentVerify(request: Request, env?: X402Env): Promise<Response> {
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
  const proof = parsePaymentHeader(request.headers.get("x-payment"));
  if (!proof) {
    return json(402, required.body);
  }

  const verification = verifyPaymentProof(proof, required.body.accepts[0]);
  if (!verification.valid) {
    return json(402, { ...required.body, error: verification.reason });
  }

  const settlement = await settlePayment(
    request.headers.get("x-payment") ?? "",
    required.body.accepts[0]
  );
  if (!settlement.settled || !settlement.trustless) {
    return json(402, {
      ...required.body,
      error: settlement.reason ?? "not_configured",
      status: settlement.trustless ? "unpaid" : "not_configured",
    });
  }

  let input: Record<string, unknown> = {};
  try {
    input = (await request.json()) as Record<string, unknown>;
  } catch {
    /* empty body is fine */
  }
  const subject = (input.sealId ??
    input.seal_id ??
    input.productId ??
    input.serial) as string | undefined;

  return json(200, {
    verified: false,
    authenticityScore: 0,
    subject: subject ?? null,
    details: {
      note: "Paid settlement accepted; registry lookup is not bound on this edge path.",
    },
    settlement: {
      payer: proof.payer,
      amountAtomic: verification.amount.toString(),
      txHash: settlement.txHash ?? proof.txHash ?? null,
      trustless: settlement.trustless,
    },
    timestamp: new Date().toISOString(),
  });
}

export async function tryHandleX402(
  request: Request,
  env: X402Env = {}
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!isX402Path(url.pathname)) return null;

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
    return catalogResponse(env);
  }

  if (request.method === "GET" && isHealthPath(url.pathname)) {
    return healthResponse(env);
  }

  if (request.method === "POST" && isPaidPath(url.pathname)) {
    return agentVerify(request, env);
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
