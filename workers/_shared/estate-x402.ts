/**
 * Unpaid x402 on sister apexes (qron.space, strainchain.io, govchain.us).
 *
 * x402scan registerFromOrigin probes `{origin}/api/x402`. OpenAPI already
 * claimed POST /api/x402; live those hosts 404'd the path. Serve the same
 * unpaid 402 v2 + PAYMENT-REQUIRED + extensions.bazaar that authichain.com
 * does, with this host as resource.url so the listing is the sister origin.
 *
 * payTo / asset / price come from the published AuthiChain rail
 * (X402_PUBLISHED_PAY_TO, Base USDC, $0.05). Do not rebind
 * X402_FACILITATOR_URL. Do not invent a second wallet. Settle needs the
 * same secret bind as authichain-com (bind-x402-secrets.yml + Deploy
 * Workers). Without X402_FACILITATOR_URL, health is not_configured and a
 * third-party pay is a dead listing.
 */
import {
  buildPaymentRequired,
  parsePaymentHeader,
  paymentResponseHeaders,
  readPaymentProofHeader,
  settlePayment,
  verifyPaymentProof,
  x402HealthReport,
  x402PriceUsd,
  X402_PUBLISHED_PAY_TO,
  type X402HealthEnv,
} from "../../src/lib/x402.ts";
import { ESTATE_BRANDS } from "./estate-landing.ts";
import type { SisterDiscoveryBrand } from "./estate-agent-discovery.ts";

export type SisterX402Env = X402HealthEnv;

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
  return p === "/api/x402" || p === "/api/x402/health";
}

function isHealthPath(pathname: string): boolean {
  const p = normalizePath(pathname);
  return p === "/api/x402" || p === "/api/x402/health";
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

function healthEnv(env?: SisterX402Env): X402HealthEnv {
  return {
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

async function healthResponse(env?: SisterX402Env): Promise<Response> {
  hydrateX402(env);
  return json(200, await x402HealthReport(healthEnv(env)));
}

async function agentVerify(
  request: Request,
  env?: SisterX402Env
): Promise<Response> {
  hydrateX402(env);
  const payTo = publishedPayTo(env);
  const resource = paidResourceUrl(request);
  const priceUsd = x402PriceUsd(env?.X402_PRICE_USD);
  const required = buildPaymentRequired({
    resource,
    priceUsd,
    payTo,
    description: "AuthiChain agent verification",
  });
  const proof = parsePaymentHeader(
    readPaymentProofHeader(name => request.headers.get(name))
  );
  if (!proof) {
    return json(402, required.v2, required.headers);
  }

  const verification = verifyPaymentProof(proof, required.body.accepts[0]);
  if (!verification.valid) {
    return json(
      402,
      { ...required.v2, error: verification.reason },
      required.headers
    );
  }

  const settlement = await settlePayment(
    readPaymentProofHeader(name => request.headers.get(name)) ?? "",
    required.body.accepts[0]
  );
  if (!settlement.settled || !settlement.trustless) {
    return json(
      402,
      {
        ...required.v2,
        error: settlement.reason ?? "not_configured",
        status: settlement.trustless ? "unpaid" : "not_configured",
      },
      required.headers
    );
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

  return json(
    200,
    {
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
    },
    paymentResponseHeaders({
      success: true,
      transaction: settlement.txHash ?? proof.txHash,
      network: required.body.accepts[0].network,
      payer: proof.payer,
    })
  );
}

/** Serve GET/HEAD health and unpaid POST 402 on a sister landing worker. */
export async function tryHandleSisterX402(
  request: Request,
  env: SisterX402Env = {}
): Promise<Response | null> {
  const url = new URL(request.url);
  if (!isSisterX402Path(url.pathname)) return null;

  if (request.method === "HEAD") {
    return new Response(null, {
      status: 204,
      headers: {
        "Cache-Control": "private, no-store",
        "CDN-Cache-Control": "no-store",
      },
    });
  }

  if (request.method === "GET" && isHealthPath(url.pathname)) {
    return healthResponse(env);
  }

  if (request.method === "POST" && isPaidPath(url.pathname)) {
    return agentVerify(request, env);
  }

  return json(405, { error: "method not allowed" });
}
