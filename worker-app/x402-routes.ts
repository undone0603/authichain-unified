/**
 * x402 agent micropayment routes on authichain-edge-router.
 *
 * GET  /api/x402 + /api/x402/health + /api/v1/agent-verify → public health
 *      (200, not_configured OK — GET must not 404)
 * GET  /api/x402/catalog + /.well-known/x402.json → machine catalog
 * POST /api/x402 + /api/v1/agent-verify → 402 advertisement or paid verify
 *
 * Do not rebind X402_PAY_TO / X402_FACILITATOR_URL / X402_USDC_ASSET.
 *
 * Facilitator is optional. Without X402_FACILITATOR_URL the health report is
 * `not_configured` and paid settlement stays closed ($0 path).
 */
import type { Hono } from "hono";
import {
  buildPaymentRequired,
  parsePaymentHeader,
  paymentResponseHeaders,
  readPaymentProofHeader,
  settlePayment,
  verifyPaymentProof,
  x402Catalog,
  x402HealthReport,
  x402PriceUsd,
  type X402HealthEnv,
} from "../src/lib/x402";

const NO_STORE = { "Cache-Control": "private, no-store" };

type X402Bindings = X402HealthEnv & {
  X402_PAY_TO?: string;
  NODE_ENV?: string;
};

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

async function agentVerify(c: {
  env?: X402Bindings;
  req: {
    url: string;
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
    description: "AuthiChain agent verification",
  });
  const proofHeader = readPaymentProofHeader(name => c.req.header(name));
  const proof = parsePaymentHeader(proofHeader);
  if (!proof) {
    return c.json(required.v2, 402, { ...NO_STORE, ...required.headers });
  }

  const verification = verifyPaymentProof(proof, required.body.accepts[0]);
  if (!verification.valid) {
    return c.json({ ...required.v2, error: verification.reason }, 402, {
      ...NO_STORE,
      ...required.headers,
    });
  }

  const settlement = await settlePayment(
    proofHeader ?? "",
    required.body.accepts[0]
  );
  if (!settlement.settled || !settlement.trustless) {
    return c.json(
      {
        ...required.v2,
        error: settlement.reason ?? "not_configured",
        status: settlement.trustless ? "unpaid" : "not_configured",
      },
      402,
      { ...NO_STORE, ...required.headers }
    );
  }

  const input = (await c.req.json().catch(() => ({}))) as Record<
    string,
    unknown
  >;
  const subject = (input.sealId ??
    input.seal_id ??
    input.productId ??
    input.serial) as string | undefined;

  return c.json(
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
    200,
    {
      ...NO_STORE,
      ...paymentResponseHeaders({
        success: true,
        transaction: settlement.txHash ?? proof.txHash,
        network: required.body.accepts[0].network,
        payer: proof.payer,
      }),
    }
  );
}

export function registerX402Routes<
  E extends X402Bindings,
  V extends Record<string, unknown> = Record<string, never>,
>(app: Hono<{ Bindings: E; Variables: V }>): void {
  app.get("/api/x402", c => health(c));
  app.get("/api/x402/health", c => health(c));
  app.get("/api/x402/catalog", c => catalog(c));
  app.get("/.well-known/x402", c => catalog(c));
  app.get("/.well-known/x402.json", c => catalog(c));
  app.get("/api/v1/agent-verify", c => health(c));
  app.post("/api/x402", c => agentVerify(c));
  app.post("/api/v1/agent-verify", c => agentVerify(c));
}
