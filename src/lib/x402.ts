/**
 * @file x402.ts
 * x402 (HTTP 402 "Payment Required") helpers for autonomous agent micropayments.
 *
 * Flow: an agent calls a paid endpoint with no payment -> we return 402 + the
 * payment requirements. The agent's wallet pays Base USDC (Circle, 8453) and
 * retries with an `X-PAYMENT` proof header -> we verify + enforce a per-payer
 * spend cap, then serve the resource. Autonomous at runtime; the wallet must be
 * funded by a KYC'd entity and every payer is spend-capped + rate-limited.
 * `$QRON` and any governance token stay off this rail (see
 * docs/strategy/AGENT_TOKENOMICS_x402.md). Do not rebind X402_PAY_TO,
 * X402_FACILITATOR_URL, or X402_USDC_ASSET.
 *
 * Pure helpers here are fully unit-tested; settlement verification has a single
 * documented integration point (`verifyPaymentProof`) to wire to an x402
 * facilitator or an on-chain check.
 */

export interface PaymentRequirement {
  scheme: "exact";
  network: string; // e.g. 'base'
  maxAmountRequired: string; // atomic units (USDC has 6 decimals)
  resource: string; // the URL being paid for
  description: string;
  payTo: string; // receiving wallet
  asset: string; // token contract (USDC)
  mimeType: "application/json";
  maxTimeoutSeconds?: number;
  extra?: { name?: string; version?: string };
  /** x402 v1 unofficial discovery field; facilitators map this to extensions.bazaar. */
  outputSchema?: X402BazaarInfo;
}

/** Bazaar discovery `info` (HTTP POST skill). Schema must validate this object. */
export type X402BazaarInfo = {
  input: {
    type: "http";
    method: "POST";
    bodyType: "json";
    body: {
      sealId: string;
      productId?: string;
      serial?: string;
    };
  };
  output: {
    type: "json";
    example: {
      verified: boolean;
      authenticityScore: number;
      subject: string | null;
      details: { note: string };
      settlement: {
        payer: string;
        amountAtomic: string;
        txHash: string;
        trustless: boolean;
      };
    };
  };
};

export type X402BazaarExtension = {
  bazaar: {
    info: X402BazaarInfo;
    schema: Record<string, unknown>;
  };
};

/**
 * Discovery metadata for PayAI / x402 Bazaar. Declared on the unpaid 402 so a
 * compatible client can echo `extensions.bazaar` in X-PAYMENT. Do not put a
 * facilitator URL here.
 */
export function x402BazaarDiscovery(): X402BazaarExtension {
  const info: X402BazaarInfo = {
    input: {
      type: "http",
      method: "POST",
      bodyType: "json",
      body: { sealId: "demo" },
    },
    output: {
      type: "json",
      example: {
        verified: false,
        authenticityScore: 0,
        subject: "demo",
        details: {
          note: "Paid settlement accepted; registry lookup is not bound on this edge path.",
        },
        settlement: {
          payer: "0x0000000000000000000000000000000000000000",
          amountAtomic: "50000",
          txHash: "0x",
          trustless: true,
        },
      },
    },
  };
  return {
    bazaar: {
      info,
      schema: {
        type: "object",
        $schema: "https://json-schema.org/draft/2020-12/schema",
        required: ["input"],
        additionalProperties: false,
        properties: {
          input: {
            type: "object",
            required: ["type", "method", "bodyType", "body"],
            additionalProperties: false,
            properties: {
              type: { type: "string", const: "http" },
              method: {
                type: "string",
                enum: ["POST", "PUT", "PATCH"],
              },
              bodyType: {
                type: "string",
                enum: ["json", "form-data", "text"],
              },
              body: {
                type: "object",
                properties: {
                  sealId: {
                    type: "string",
                    description: "Optional seal id to verify",
                  },
                  productId: { type: "string" },
                  serial: { type: "string" },
                },
              },
            },
          },
          output: {
            type: "object",
            required: ["type"],
            properties: {
              type: { type: "string", const: "json" },
              example: { type: "object", additionalProperties: true },
            },
          },
        },
      },
    },
  };
}

export interface PaymentProof {
  scheme: string;
  network: string;
  payer: string; // payer wallet address
  amount: string; // atomic units paid
  txHash?: string; // settlement tx (on-chain) if available
  signature?: string; // authorization signature
}

export const USDC_DECIMALS = 6;

/** Official Circle USDC on Base mainnet (8453). PayAI settle needs this, not the ticker. */
export const BASE_USDC_ASSET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";

export const BASE_USDC_EIP712 = { name: "USD Coin", version: "2" } as const;

export const X402_MAX_TIMEOUT_SECONDS = 60;

/**
 * Resolve the challenge asset. A bare ticker ("USDC") is not a contract
 * address — PayAI's Base settle path needs official Base USDC.
 */
export function resolveX402Asset(network?: string, asset?: string): string {
  const explicit = asset ?? process.env.X402_USDC_ASSET;
  if (explicit && /^0x[a-fA-F0-9]{40}$/.test(explicit)) return explicit;
  const net = network ?? process.env.X402_NETWORK ?? "base";
  if (net === "base" || net === "eip155:8453") return BASE_USDC_ASSET;
  return explicit || "USDC";
}

function requirementExtra(network: string, asset: string) {
  if (
    (network === "base" || network === "eip155:8453") &&
    asset.toLowerCase() === BASE_USDC_ASSET.toLowerCase()
  ) {
    return { ...BASE_USDC_EIP712 };
  }
  return undefined;
}

/** Convert a USD dollar amount to USDC atomic units (6 decimals), as a string. */
export function usdToAtomic(usd: number): string {
  if (!Number.isFinite(usd) || usd < 0)
    throw new Error("usdToAtomic: invalid amount");
  return Math.round(usd * 10 ** USDC_DECIMALS).toString();
}

/** Map a v1 network nickname onto CAIP-2 for the v2 PAYMENT-REQUIRED header. */
export function x402Caip2Network(network: string): string {
  const n = network.trim();
  const lower = n.toLowerCase();
  if (lower === "base" || lower === "eip155:8453") return "eip155:8453";
  if (lower === "polygon" || lower === "eip155:137") return "eip155:137";
  return n;
}

/** v1 `base` and v2 `eip155:8453` are the same rail. */
export function x402NetworksEquivalent(a: string, b: string): boolean {
  if (a === b) return true;
  return x402Caip2Network(a) === x402Caip2Network(b);
}

export type PaymentRequiredV2 = {
  x402Version: 2;
  error?: string;
  resource: {
    url: string;
    description: string;
    mimeType: "application/json";
    serviceName: "AuthiChain";
    tags: string[];
  };
  accepts: Array<{
    scheme: "exact";
    network: string;
    amount: string;
    asset: string;
    payTo: string;
    maxTimeoutSeconds: number;
    extra?: { name?: string; version?: string };
  }>;
  extensions: X402BazaarExtension;
};

export function encodeX402HeaderJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value), "utf8").toString("base64");
}

export function paymentRequiredHeaders(
  v2: PaymentRequiredV2
): Record<string, string> {
  return {
    "PAYMENT-REQUIRED": encodeX402HeaderJson(v2),
    "Access-Control-Expose-Headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE",
  };
}

export function paymentResponseHeaders(opts: {
  success: boolean;
  transaction?: string | null;
  network: string;
  payer: string;
}): Record<string, string> {
  return {
    "PAYMENT-RESPONSE": encodeX402HeaderJson({
      success: opts.success,
      transaction: opts.transaction ?? "",
      network: x402Caip2Network(opts.network),
      payer: opts.payer,
    }),
    "Access-Control-Expose-Headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE",
  };
}

/** X-PAYMENT (v1) or PAYMENT-SIGNATURE (v2). Header names are case-insensitive. */
export function readPaymentProofHeader(
  getHeader: (name: string) => string | null | undefined
): string | null {
  const raw = getHeader("x-payment") || getHeader("payment-signature");
  return raw && raw.trim() ? raw.trim() : null;
}

function buildPaymentRequiredV2(opts: {
  resource: string;
  description: string;
  payTo: string;
  network: string;
  asset: string;
  amountAtomic: string;
  extra?: { name?: string; version?: string };
  extensions: X402BazaarExtension;
}): PaymentRequiredV2 {
  return {
    x402Version: 2,
    error: "X-PAYMENT or PAYMENT-SIGNATURE header is required",
    resource: {
      url: opts.resource,
      description: opts.description,
      mimeType: "application/json",
      serviceName: "AuthiChain",
      tags: ["verification", "authenticity"],
    },
    accepts: [
      {
        scheme: "exact",
        network: x402Caip2Network(opts.network),
        amount: opts.amountAtomic,
        asset: opts.asset,
        payTo: opts.payTo,
        maxTimeoutSeconds: X402_MAX_TIMEOUT_SECONDS,
        ...(opts.extra ? { extra: opts.extra } : {}),
      },
    ],
    extensions: opts.extensions,
  };
}

/** Build the 402 payment-requirements body an unpaid agent receives. */
export function buildPaymentRequired(opts: {
  resource: string;
  priceUsd: number;
  payTo: string;
  network?: string;
  asset?: string;
  description?: string;
}): {
  status: 402;
  body: {
    x402Version: number;
    accepts: PaymentRequirement[];
    extensions: X402BazaarExtension;
  };
  v2: PaymentRequiredV2;
  headers: Record<string, string>;
} {
  const network = opts.network ?? process.env.X402_NETWORK ?? "base";
  const asset = resolveX402Asset(network, opts.asset);
  const extra = requirementExtra(network, asset);
  const extensions = x402BazaarDiscovery();
  const description = opts.description ?? "AuthiChain verification";
  const amountAtomic = usdToAtomic(opts.priceUsd);
  const requirement: PaymentRequirement = {
    scheme: "exact",
    network,
    maxAmountRequired: amountAtomic,
    resource: opts.resource,
    description,
    payTo: opts.payTo,
    asset,
    mimeType: "application/json",
    maxTimeoutSeconds: X402_MAX_TIMEOUT_SECONDS,
    outputSchema: extensions.bazaar.info,
    ...(extra ? { extra } : {}),
  };
  const v2 = buildPaymentRequiredV2({
    resource: opts.resource,
    description,
    payTo: opts.payTo,
    network,
    asset,
    amountAtomic,
    extra,
    extensions,
  });
  return {
    status: 402,
    body: { x402Version: 1, accepts: [requirement], extensions },
    v2,
    headers: paymentRequiredHeaders(v2),
  };
}

/** Decode the base64-encoded JSON `X-PAYMENT` / `PAYMENT-SIGNATURE` header. */
export function parsePaymentHeader(
  header: string | null | undefined
): PaymentProof | null {
  if (!header) return null;
  try {
    const json = Buffer.from(header, "base64").toString("utf8");
    const raw = JSON.parse(json) as Record<string, unknown>;
    const accepted =
      raw.accepted && typeof raw.accepted === "object"
        ? (raw.accepted as Record<string, unknown>)
        : undefined;
    const nested =
      raw.payload && typeof raw.payload === "object"
        ? (raw.payload as Record<string, unknown>)
        : undefined;
    const auth =
      nested?.authorization && typeof nested.authorization === "object"
        ? (nested.authorization as Record<string, unknown>)
        : undefined;
    const payer = String(raw.payer ?? auth?.from ?? "");
    const amount = String(raw.amount ?? auth?.value ?? accepted?.amount ?? "");
    const network = String(raw.network ?? accepted?.network ?? "");
    if (!payer || !amount || !network) return null;
    const proof: PaymentProof = {
      scheme: String(raw.scheme ?? accepted?.scheme ?? "exact"),
      network,
      payer,
      amount,
    };
    const signature = raw.signature ?? nested?.signature;
    const txHash = raw.txHash;
    if (typeof signature === "string" && signature) proof.signature = signature;
    if (typeof txHash === "string" && txHash) proof.txHash = txHash;
    return proof;
  } catch {
    return null;
  }
}

/**
 * Verify that a payment proof satisfies a requirement.
 *
 * INTEGRATION POINT: in production, replace the structural check below with a
 * call to an x402 facilitator (`/verify`) or an on-chain settlement lookup of
 * `proof.txHash`. Until `X402_FACILITATOR_URL` is configured this runs in
 * dev/structural mode (network + amount + payer must match) so the flow is
 * exercisable end-to-end without funds.
 */
export function verifyPaymentProof(
  proof: PaymentProof,
  requirement: PaymentRequirement
): { valid: boolean; payer: string; amount: bigint; reason?: string } {
  const fail = (reason: string) => ({
    valid: false,
    payer: proof.payer ?? "",
    amount: 0n,
    reason,
  });

  if (!x402NetworksEquivalent(proof.network, requirement.network))
    return fail("network mismatch");
  let amount: bigint;
  try {
    amount = BigInt(proof.amount);
  } catch {
    return fail("bad amount");
  }
  if (amount < BigInt(requirement.maxAmountRequired)) return fail("underpaid");
  if (!/^0x[a-fA-F0-9]{40}$/.test(proof.payer))
    return fail("bad payer address");

  // Production settlement check would go here (facilitator or on-chain txHash).
  if (process.env.X402_FACILITATOR_URL && !proof.txHash && !proof.signature) {
    return fail("missing settlement proof");
  }
  return { valid: true, payer: proof.payer, amount };
}

export interface SettlementResult {
  settled: boolean;
  txHash?: string;
  reason?: string;
  trustless: boolean; // true when a facilitator actually verified+settled on-chain
}

/**
 * Settle/verify a payment via an x402 facilitator (the protocol's intended design:
 * the facilitator verifies the EIP-3009 authorization and submits
 * transferWithAuthorization on-chain — it never custodies funds).
 *
 * Set X402_FACILITATOR_URL to go trustless. Without it, this returns settled:true
 * but trustless:false (dev mode) — callers MUST refuse to treat dev-mode as paid in
 * production. The X-PAYMENT header is decoded and sent as the facilitator
 * `paymentPayload` object (PayAI / x402 v1 expect JSON, not the raw base64).
 */
export function decodeFacilitatorPaymentPayload(
  paymentHeaderB64: string
): unknown {
  try {
    return JSON.parse(Buffer.from(paymentHeaderB64, "base64").toString("utf8"));
  } catch {
    return paymentHeaderB64;
  }
}

/**
 * PayAI's live /settle path is x402 v1. A v2 PAYMENT-SIGNATURE still settles
 * there after we flatten `accepted` + `payload` into the v1 envelope.
 */
export function toFacilitatorV1Payload(decoded: unknown): unknown {
  if (!decoded || typeof decoded !== "object") return decoded;
  const raw = decoded as Record<string, unknown>;
  if (raw.x402Version !== 2) return decoded;
  const accepted =
    raw.accepted && typeof raw.accepted === "object"
      ? (raw.accepted as Record<string, unknown>)
      : {};
  const network = String(accepted.network ?? raw.network ?? "base");
  return {
    x402Version: 1,
    scheme: accepted.scheme ?? raw.scheme ?? "exact",
    network: network.toLowerCase() === "eip155:8453" ? "base" : network,
    payload: raw.payload,
  };
}

export async function settlePayment(
  paymentHeaderB64: string,
  requirement: PaymentRequirement
): Promise<SettlementResult> {
  const facilitator = process.env.X402_FACILITATOR_URL;
  if (!facilitator) {
    return {
      settled: true,
      trustless: false,
      reason: "dev_mode_no_facilitator",
    };
  }
  try {
    const paymentPayload = toFacilitatorV1Payload(
      decodeFacilitatorPaymentPayload(paymentHeaderB64)
    );
    const res = await fetch(`${facilitator.replace(/\/$/, "")}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        x402Version: 1,
        paymentPayload,
        paymentRequirements: requirement,
      }),
    });
    if (!res.ok)
      return {
        settled: false,
        trustless: true,
        reason: `facilitator_http_${res.status}`,
      };
    const j = (await res.json()) as {
      success?: boolean;
      txHash?: string;
      transaction?: string;
      errorReason?: string;
      error?: string;
    };
    if (j.success)
      return {
        settled: true,
        trustless: true,
        txHash: j.txHash ?? j.transaction,
      };
    return {
      settled: false,
      trustless: true,
      reason: j.errorReason ?? j.error ?? "settle_failed",
    };
  } catch (err) {
    return {
      settled: false,
      trustless: true,
      reason: err instanceof Error ? err.message : "settle_error",
    };
  }
}

/** Pure spend-cap check: would this payment push the payer over their window cap? */
export function wouldExceedCap(
  currentSpentAtomic: bigint,
  paymentAtomic: bigint,
  capAtomic: bigint
): boolean {
  return currentSpentAtomic + paymentAtomic > capAtomic;
}

/** Default per-payer daily spend cap in USD (override via X402_DAILY_CAP_USD). */
export function dailyCapUsd(): number {
  const v = Number(process.env.X402_DAILY_CAP_USD);
  return Number.isFinite(v) && v > 0 ? v : 10;
}

export const X402_DEFAULT_PRICE_USD = 0.05;

export function x402PriceUsd(raw?: string): number {
  const v = Number(raw ?? process.env.X402_PRICE_USD);
  return Number.isFinite(v) && v > 0 ? v : X402_DEFAULT_PRICE_USD;
}

export type X402HealthEnv = {
  X402_PAY_TO?: string;
  X402_FACILITATOR_URL?: string;
  X402_NETWORK?: string;
  X402_CHAIN_ID?: string;
  X402_USDC_ASSET?: string;
  X402_PRICE_USD?: string;
  X402_DAILY_CAP_USD?: string;
};

export type X402FacilitatorStatus = {
  configured: boolean;
  reachable: boolean;
  httpStatus?: number;
  supported?: unknown;
  error?: string;
};

export type X402HealthBody = {
  ok: boolean;
  ready: boolean;
  status: "ready" | "not_configured" | "degraded";
  mode: "trustless" | "not_configured" | "dev";
  payTo: string | null;
  network: string;
  chainId: string;
  asset: string;
  pricePerCall: { usd: number; atomic: string };
  dailyCapUsd: number;
  endpoint: string;
  aliases: string[];
  catalog: string;
  docs: string;
  facilitator: X402FacilitatorStatus;
  warnings: string[];
  timestamp: string;
};

async function facilitatorStatus(
  url: string | undefined
): Promise<X402FacilitatorStatus> {
  if (!url) return { configured: false, reachable: false };
  try {
    const res = await fetch(`${url.replace(/\/$/, "")}/supported`, {
      method: "GET",
      signal: AbortSignal.timeout(5000),
    });
    let supported: unknown;
    try {
      supported = await res.json();
    } catch {
      /* non-JSON is fine */
    }
    return {
      configured: true,
      reachable: res.ok,
      httpStatus: res.status,
      supported,
    };
  } catch (err) {
    return {
      configured: true,
      reachable: false,
      error: err instanceof Error ? err.message : "unreachable",
    };
  }
}

/**
 * Public x402 go-live report. Always safe to serve (no secrets).
 * No facilitator → HTTP 200 with `status: "not_configured"` ($0 path).
 */
export async function x402HealthReport(
  env: X402HealthEnv = process.env
): Promise<X402HealthBody> {
  const payTo =
    env.X402_PAY_TO?.trim() || process.env.X402_PAY_TO?.trim() || null;
  const facilitatorUrl =
    env.X402_FACILITATOR_URL?.trim() ||
    process.env.X402_FACILITATOR_URL?.trim();
  const facilitator = await facilitatorStatus(facilitatorUrl);
  const priceUsd = x402PriceUsd(env.X402_PRICE_USD);
  const trustless = facilitator.configured && facilitator.reachable;
  const ready = Boolean(payTo) && trustless;
  const status: X402HealthBody["status"] = !facilitator.configured
    ? "not_configured"
    : ready
      ? "ready"
      : "degraded";

  const warnings: string[] = [];
  if (!payTo)
    warnings.push("X402_PAY_TO not set — no receiving address configured.");
  if (!facilitator.configured) {
    warnings.push(
      "X402_FACILITATOR_URL not set — settlement is not trustless; paid calls stay closed."
    );
  }
  if (facilitator.configured && !facilitator.reachable) {
    warnings.push("Facilitator configured but unreachable.");
  }

  return {
    ok: ready,
    ready,
    status,
    mode: facilitator.configured ? "trustless" : "not_configured",
    payTo,
    network: env.X402_NETWORK || process.env.X402_NETWORK || "base",
    chainId: env.X402_CHAIN_ID || process.env.X402_CHAIN_ID || "8453",
    asset: resolveX402Asset(
      env.X402_NETWORK || process.env.X402_NETWORK,
      env.X402_USDC_ASSET || process.env.X402_USDC_ASSET
    ),
    pricePerCall: { usd: priceUsd, atomic: usdToAtomic(priceUsd) },
    dailyCapUsd: dailyCapUsd(),
    endpoint: "/api/v1/agent-verify",
    aliases: ["/api/x402", "/api/x402/health", "/api/v1/agent-verify"],
    catalog: "/api/x402/catalog",
    docs: "/x402",
    facilitator,
    warnings,
    timestamp: new Date().toISOString(),
  };
}

export type X402CatalogEndpoint = {
  method: "GET" | "POST";
  path: string;
  paid: boolean;
  description: string;
  priceUsd: number | null;
  priceAtomic: string | null;
  unpaidStatus?: number;
};

export type X402CatalogBody = {
  protocol: "x402";
  x402Version: 1;
  brand: "AuthiChain";
  docs: string;
  health: string;
  catalog: string;
  wellKnown: string;
  tokenomics: string;
  unitOfAccount: "USDC";
  network: string;
  chainId: string;
  asset: string;
  payTo: string | null;
  pricePerCall: { usd: number; atomic: string };
  dailyCapUsd: number;
  status: X402HealthBody["status"];
  ready: boolean;
  mode: X402HealthBody["mode"];
  endpoints: X402CatalogEndpoint[];
  humanCheckout: {
    rail: "stripe";
    passportUsd: number;
    dppUsd: number;
    source: string;
  };
  discovery: {
    bazaarDeclared: true;
    declaredOn: "POST /api/x402 402 body extensions.bazaar and PAYMENT-REQUIRED header";
    paymentRequiredHeader: true;
  };
  timestamp: string;
};

/**
 * Machine-readable catalog for MCP / OpenAPI-style discovery.
 * Price, payTo, asset, and caps are copied from x402HealthReport — never
 * a second hardcoded schedule.
 */
export async function x402Catalog(
  env: X402HealthEnv = process.env
): Promise<X402CatalogBody> {
  const health = await x402HealthReport(env);
  const paid = (path: string, description: string): X402CatalogEndpoint => ({
    method: "POST",
    path,
    paid: true,
    description,
    priceUsd: health.pricePerCall.usd,
    priceAtomic: health.pricePerCall.atomic,
    unpaidStatus: 402,
  });
  const free = (path: string, description: string): X402CatalogEndpoint => ({
    method: "GET",
    path,
    paid: false,
    description,
    priceUsd: null,
    priceAtomic: null,
  });
  return {
    protocol: "x402",
    x402Version: 1,
    brand: "AuthiChain",
    docs: "/x402",
    health: "/api/x402/health",
    catalog: "/api/x402/catalog",
    wellKnown: "/.well-known/x402.json",
    tokenomics:
      "https://github.com/undone0603/authichain-unified/blob/main/docs/strategy/AGENT_TOKENOMICS_x402.md",
    unitOfAccount: "USDC",
    network: health.network,
    chainId: health.chainId,
    asset: health.asset,
    payTo: health.payTo,
    pricePerCall: health.pricePerCall,
    dailyCapUsd: health.dailyCapUsd,
    status: health.status,
    ready: health.ready,
    mode: health.mode,
    endpoints: [
      free("/api/x402/health", "Public rail health (no secrets)"),
      free("/api/x402", "Health alias"),
      free("/api/x402/catalog", "Paid-endpoint catalog for agents and MCP"),
      free("/.well-known/x402.json", "Well-known catalog document"),
      free(
        "/api/v1/agent-verify",
        "Health alias on GET; POST is the paid skill"
      ),
      paid("/api/x402", "AuthiChain agent verification (seal / product)"),
      paid(
        "/api/v1/agent-verify",
        "AuthiChain agent verification (seal / product)"
      ),
    ],
    humanCheckout: {
      rail: "stripe",
      passportUsd: 49,
      dppUsd: 299,
      source: "src/lib/plans.ts",
    },
    discovery: {
      bazaarDeclared: true,
      declaredOn:
        "POST /api/x402 402 body extensions.bazaar and PAYMENT-REQUIRED header",
      paymentRequiredHeader: true,
    },
    timestamp: health.timestamp,
  };
}
