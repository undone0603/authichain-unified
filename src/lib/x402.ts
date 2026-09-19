/**
 * @file x402.ts
 * x402 (HTTP 402 "Payment Required") helpers for autonomous agent micropayments.
 *
 * Flow: an agent calls a paid endpoint with no payment -> we return 402 + the
 * payment requirements. The agent's wallet pays (USDC on Polygon / $QRON) and
 * retries with an `X-PAYMENT` proof header -> we verify + enforce a per-payer
 * spend cap, then serve the resource. Autonomous at runtime; the wallet must be
 * funded by a KYC'd entity and every payer is spend-capped + rate-limited.
 *
 * Pure helpers here are fully unit-tested; settlement verification has a single
 * documented integration point (`verifyPaymentProof`) to wire to an x402
 * facilitator or an on-chain check.
 */

export interface PaymentRequirement {
  scheme: "exact";
  network: string; // e.g. 'polygon'
  maxAmountRequired: string; // atomic units (USDC has 6 decimals)
  resource: string; // the URL being paid for
  description: string;
  payTo: string; // receiving wallet
  asset: string; // token contract (USDC)
  mimeType: "application/json";
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

/** Convert a USD dollar amount to USDC atomic units (6 decimals), as a string. */
export function usdToAtomic(usd: number): string {
  if (!Number.isFinite(usd) || usd < 0)
    throw new Error("usdToAtomic: invalid amount");
  return Math.round(usd * 10 ** USDC_DECIMALS).toString();
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
  body: { x402Version: number; accepts: PaymentRequirement[] };
} {
  const requirement: PaymentRequirement = {
    scheme: "exact",
    network: opts.network ?? process.env.X402_NETWORK ?? "base",
    maxAmountRequired: usdToAtomic(opts.priceUsd),
    resource: opts.resource,
    description: opts.description ?? "AuthiChain verification",
    payTo: opts.payTo,
    asset: opts.asset ?? process.env.X402_USDC_ASSET ?? "USDC",
    mimeType: "application/json",
  };
  return { status: 402, body: { x402Version: 1, accepts: [requirement] } };
}

/** Decode the base64-encoded JSON `X-PAYMENT` header into a PaymentProof. */
export function parsePaymentHeader(
  header: string | null | undefined
): PaymentProof | null {
  if (!header) return null;
  try {
    const json = Buffer.from(header, "base64").toString("utf8");
    const proof = JSON.parse(json) as PaymentProof;
    if (!proof.payer || !proof.amount || !proof.network) return null;
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

  if (proof.network !== requirement.network) return fail("network mismatch");
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
 * production. The raw base64 X-PAYMENT header is forwarded as the payment payload.
 */
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
    const res = await fetch(`${facilitator.replace(/\/$/, "")}/settle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        paymentPayload: paymentHeaderB64,
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
    asset: env.X402_USDC_ASSET || process.env.X402_USDC_ASSET || "USDC",
    pricePerCall: { usd: priceUsd, atomic: usdToAtomic(priceUsd) },
    dailyCapUsd: dailyCapUsd(),
    endpoint: "/api/v1/agent-verify",
    aliases: ["/api/x402", "/api/x402/health", "/api/v1/agent-verify"],
    facilitator,
    warnings,
    timestamp: new Date().toISOString(),
  };
}
