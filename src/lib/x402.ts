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
 * docs/strategy/AGENT_TOKENOMICS_x402.md). Wallets vs rails:
 * docs/strategy/WEB3_IDENTITY.md. Do not rebind X402_PAY_TO away from
 * the owner-authorized treasury 0x5db511706FB6317cd23A7655F67450c5AC6e6AA2.
 * Do not rebind X402_FACILITATOR_URL or X402_USDC_ASSET. payTo is the
 * owner's tokenomics EOA (0x5db511706FB6317cd23A7655F67450c5AC6e6AA2, also the $QRON holder), not
 * the NFT deployer EOA (0xbad4…), and not the Coinbase Smart Wallet.
 *
 * Pure helpers here are fully unit-tested; settlement verification has a single
 * documented integration point (`verifyPaymentProof`) to wire to an x402
 * facilitator or an on-chain check.
 */

import { BASE_USDC, TOKENOMICS_PAY_TO } from "../../scripts/lib/evm-chains";
import {
  catalogOffers,
  planPaymentLink,
  planUsd,
  type CatalogOffer,
} from "./plans";

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

/**
 * HTTP 200 body after a paid missing-seal check (the advertised bazaar
 * example UUID). Crawlers that walk `accepts[0].outputSchema.output` as
 * the response template compare these keys to the JSON they paid for.
 * Never include `authenticityScore`. A valid signature is not claimed.
 */
export type X402PaidHttpBodyExample = {
  registered: boolean;
  status: string;
  checks: {
    registry: string;
    signature: string;
    revocation: string;
  };
  details: {
    verdict: string;
    reasons: string[];
  };
  verified: false;
  baseline: {
    version: "1";
    scope: "signature-and-validity";
    checkedAt: string;
    verdict: string;
    reasons: string[];
    checks: Record<string, unknown>;
    evidence: { record: null; anchor: null };
    unknowns: string[];
  };
  subject: string;
  settlement: {
    payer: string;
    amountAtomic: string;
    txHash: string;
    trustless: boolean;
  };
  timestamp: string;
};

/** Bazaar discovery `info` (HTTP POST skill). Schema must validate this object. */
export type X402BazaarInfo = {
  input: {
    type: "http";
    method: "POST";
    bodyType: "json";
    body: {
      sealId: string;
    };
  };
  output: {
    type: "json";
    example: X402PaidHttpBodyExample;
  };
};

/**
 * v2 `accepts[0].outputSchema`. Keep `input` so PayAI can catalog the
 * skill. Put the unwrapped HTTP body on `output` so field-check crawlers
 * (Settled `basis=example`) do not treat bazaar `{type, example}` wrapper
 * keys as promised response fields.
 */
export type X402V2OutputSchema = {
  input: X402BazaarInfo["input"];
  output: X402PaidHttpBodyExample;
};

export type X402BazaarExtension = {
  bazaar: {
    info: X402BazaarInfo;
    schema: Record<string, unknown>;
  };
};

/**
 * Placeholder UUID in 402 bazaar/example bodies. Discovery crawlers POST this
 * as the listing example. It is not a real seal and must not take the free
 * daily allowance — a 200 on this UUID is classified as payability=free.
 */
export const X402_DISCOVERY_EXAMPLE_SEAL_ID =
  "00000000-0000-4000-8000-000000000000";

/**
 * PayAI still lists `/api/v1/agent-verify` with `sealId: "demo"` (cached
 * 2026-10-17). Crawlers POST that body and treat HTTP 400 as "POST does not
 * pay". Accept it as a listing sample only: unpaid 402, paid missing-seal
 * evidence, never a free 200. Do not advertise `demo` on new 402s.
 */
export const X402_STALE_DISCOVERY_SEAL_ID = "demo";

/** Lumi Watch-trial domain proof. Public verification string, not a secret. */
export const LUMI_MONITOR_VERIFY_LINE =
  "lumi-monitor-verify=a3d5185455e49db093ba4e9b37f7e460";

export function isDiscoveryExampleSealId(sealId: string): boolean {
  const id = sealId.trim().toLowerCase();
  return (
    id === X402_DISCOVERY_EXAMPLE_SEAL_ID || id === X402_STALE_DISCOVERY_SEAL_ID
  );
}

/** Stable ISO-ms timestamp in the advertised sample (length matches live). */
export const X402_PAID_OUTPUT_EXAMPLE_CHECKED_AT = "2026-01-01T00:00:00.000Z";

/**
 * Paid missing-seal JSON the Worker actually returns (plus settlement
 * receipt). Used as bazaar `output.example` and as v2 `outputSchema.output`.
 */
export function x402PaidOutputExample(): X402PaidHttpBodyExample {
  return {
    registered: false,
    status: "not_registered",
    checks: {
      registry: "not_found",
      signature: "not_checked",
      revocation: "not_available",
    },
    details: {
      verdict: "unsigned",
      reasons: ["seal_not_found"],
    },
    verified: false,
    baseline: {
      version: "1",
      scope: "signature-and-validity",
      checkedAt: X402_PAID_OUTPUT_EXAMPLE_CHECKED_AT,
      verdict: "unsigned",
      reasons: ["seal_not_found"],
      checks: {},
      evidence: { record: null, anchor: null },
      unknowns: [
        "issuer_identity_not_authenticated",
        "registry_subject_binding_not_verified",
        "revocation_not_checked",
        "anchor_not_queried",
        "physical_authenticity_not_inspected",
      ],
    },
    subject: X402_DISCOVERY_EXAMPLE_SEAL_ID,
    settlement: {
      payer: "0x0000000000000000000000000000000000000000",
      amountAtomic: "50000",
      txHash: "0x",
      trustless: true,
    },
    timestamp: X402_PAID_OUTPUT_EXAMPLE_CHECKED_AT,
  };
}

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
      body: { sealId: "00000000-0000-4000-8000-000000000000" },
    },
    output: {
      type: "json",
      example: x402PaidOutputExample(),
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
                    format: "uuid",
                    description:
                      "Required seal UUID. productId and serial are not registry keys.",
                  },
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

/** Official Circle USDC on Base mainnet (8453). PayAI settle needs this, not the ticker. Do not rebind. $QRON is not this asset. */
export const BASE_USDC_ASSET = BASE_USDC;

/**
 * Live published X402_PAY_TO — owner-authorized treasury / tokenomics EOA
 * 0x5db511706FB6317cd23A7655F67450c5AC6e6AA2. Never the $QRON
 * ERC-20 contract (0xAebf…E437) or the NFT deployer EOA (0xbad4…). Canonical map:
 * docs/strategy/WEB3_IDENTITY.md. Do not rebind away from this address.
 * Runtime health still reads the Worker/env binding; this constant
 * documents the live value. It is NOT a fallback when X402_PAY_TO is
 * unset (that stays 503).
 */
export const X402_PUBLISHED_PAY_TO = TOKENOMICS_PAY_TO;

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
    /** PayAI catalogs `input`; Settled walks `output` as the HTTP body sample. */
    outputSchema: X402V2OutputSchema;
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

/** PayAI Bazaar indexes description + tags. Keep "evidence" so search matches. */
export const X402_RESOURCE_DESCRIPTION =
  "Paid evidence check for agents: signed record, machine-readable verification result, explicit unknowns, and a settlement receipt. A valid signature is not real-world truth.";

export const X402_RESOURCE_TAGS = [
  "verification",
  "authenticity",
  "evidence",
] as const;

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
      tags: [...X402_RESOURCE_TAGS],
    },
    accepts: [
      {
        scheme: "exact",
        network: x402Caip2Network(opts.network),
        amount: opts.amountAtomic,
        asset: opts.asset,
        payTo: opts.payTo,
        maxTimeoutSeconds: X402_MAX_TIMEOUT_SECONDS,
        outputSchema: {
          input: opts.extensions.bazaar.info.input,
          output: x402PaidOutputExample(),
        },
        ...(opts.extra ? { extra: opts.extra } : {}),
      },
    ],
    extensions: opts.extensions,
  };
}

/**
 * Build the 402 payment-requirements an unpaid agent receives.
 *
 * HTTP JSON is `v2` (CDP Bazaar validate reads the JSON body's
 * `x402Version`; a v1 body is rejected as "expected 2"). The unpaid
 * `accepts[0]` carries `outputSchema.input` (`type` + `method`) so Bazaar
 * can catalog from the 402 body, not only from a later `/settle`.
 * v2 `outputSchema.output` is the unwrapped paid HTTP body sample.
 * `body` stays the v1 requirement PayAI `/settle` still posts
 * (`outputSchema` = bazaar.info, including `{type, example}`).
 * Do not rebind `X402_FACILITATOR_URL` to chase CDP listing.
 */
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
  const description = opts.description ?? X402_RESOURCE_DESCRIPTION;
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
  const facilitator: Record<string, unknown> = {
    x402Version: 1,
    scheme: accepted.scheme ?? raw.scheme ?? "exact",
    network: network.toLowerCase() === "eip155:8453" ? "base" : network,
    payload: raw.payload,
  };
  const bazaar = bazaarExtensionFrom(raw);
  if (bazaar !== undefined) {
    facilitator.extensions = { bazaar };
  }
  return facilitator;
}

/** Copy only a client-supplied `extensions.bazaar`. Never invent one. */
function bazaarExtensionFrom(
  raw: Record<string, unknown>
): unknown | undefined {
  const extensions = raw.extensions;
  if (
    !extensions ||
    typeof extensions !== "object" ||
    Array.isArray(extensions)
  ) {
    return undefined;
  }
  if (!("bazaar" in extensions)) return undefined;
  return (extensions as Record<string, unknown>).bazaar;
}

/**
 * Bazaar catalogs attach metadata to `paymentPayload.resource`. Clients often
 * omit it; copy the 402 requirement URL so PayAI/CDP have a row key.
 */
export function attachResourceToPaymentPayload(
  payload: unknown,
  resource: string
): unknown {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return payload;
  }
  const raw = payload as Record<string, unknown>;
  if (typeof raw.resource === "string" && raw.resource.length > 0) {
    return payload;
  }
  return { ...raw, resource };
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
    const paymentPayload = attachResourceToPaymentPayload(
      toFacilitatorV1Payload(decodeFacilitatorPaymentPayload(paymentHeaderB64)),
      requirement.resource
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

/**
 * Refusal for a paid verify call on a path with no seal-registry lookup behind
 * it. Served with HTTP 503.
 *
 * The edge copies of POST /api/x402 (landing, sister landings, both MCP
 * bridges, worker-app) used to settle the $0.05 and then answer
 * `verified: false` with a note admitting the lookup was not bound: the agent
 * paid for an answer that could never be real. Until a registry lookup is bound
 * on those paths they return this as soon as a payment proof arrives, before
 * settlePayment() runs, so no USDC moves. The unpaid 402 challenge stays so
 * discovery still works. The bound implementation is
 * src/app/api/v1/agent-verify/route.ts; an edge worker with a VERIFY_APP
 * binding forwards to it (forwardPaidVerify) instead of refusing.
 */
export const X402_REGISTRY_NOT_BOUND = {
  error: "registry_not_bound",
  status: "unavailable",
  settled: false,
  detail:
    "Seal registry lookup is not bound on this path, so a paid call cannot return a real verification. Refused before settlement; no payment was taken.",
} as const;

/**
 * Whether discovery should advertise that a paid call gets an answer.
 * forwardPaidVerify exists (#1247) but this stays false until a live paid
 * POST on the public edge returns 200 with VERIFY_APP bound. Flip it in the
 * same change that proves that. Health.ready still means "rail configured".
 */
export const X402_PAID_VERIFY_BOUND: boolean = false;

/** True only for the two registry paths the paid route really implements. */
export function x402PaidVerifyPathBound(path?: string): boolean {
  return path === "seal_lookup" || path === "verify_app";
}

export type X402PaidVerifyStatus = {
  bound: boolean;
  status: "bound" | "registry_not_bound";
  detail: string;
};

export function x402PaidVerifyStatus(
  bound: boolean = X402_PAID_VERIFY_BOUND
): X402PaidVerifyStatus {
  return bound
    ? {
        bound: true,
        status: "bound",
        detail: "Paid calls are answered from the seal registry.",
      }
    : {
        bound: false,
        status: "registry_not_bound",
        detail:
          "The payment rail is live, but no seal registry lookup is bound on the public paid paths yet. A paid call is refused with HTTP 503 registry_not_bound before settlement, so no payment is taken. The unpaid 402 challenge stays for discovery.",
      };
}

/**
 * Cloudflare service binding to the Next app worker (`authichain-app`, see
 * wrangler.app.jsonc). Edge workers bind it as `VERIFY_APP`.
 */
export interface X402VerifyBinding {
  fetch(request: Request): Promise<Response>;
}

/** The registry-backed paid verify route (src/app/api/v1/agent-verify). */
export const X402_BOUND_VERIFY_PATH = "/api/v1/agent-verify";

/**
 * Hand a paid verify call to the Next route, which does the auth_seals lookup
 * and settles only when it can return a real answer (every refusal there is
 * before settlement). The edge copies of POST /api/x402 have no registry of
 * their own; without a binding they keep answering X402_REGISTRY_NOT_BOUND.
 *
 * The public host is kept so the Next route builds the same resource URL the
 * agent was challenged with. No timeout: aborting after the facilitator has
 * settled would take the agent's money and drop the answer.
 */
export function forwardPaidVerify(
  binding: X402VerifyBinding,
  request: Request,
  proofHeader: string,
  body: string
): Promise<Response> {
  const url = new URL(request.url);
  url.pathname = X402_BOUND_VERIFY_PATH;
  url.search = "";
  return binding.fetch(
    new Request(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-PAYMENT": proofHeader,
      },
      body,
    })
  );
}

/**
 * MCP `tools/call verify` over forwardPaidVerify. A settled answer comes back
 * as a JSON-RPC result carrying the PAYMENT-RESPONSE header; any refusal
 * (402, 400, 429, 503) passes through as HTTP, the same way the unpaid 402
 * already does on /mcp.
 */
export async function forwardPaidVerifyMcp(
  binding: X402VerifyBinding,
  request: Request,
  proofHeader: string,
  args: Record<string, unknown>,
  id: unknown
): Promise<Response> {
  const upstream = await forwardPaidVerify(
    binding,
    request,
    proofHeader,
    JSON.stringify(args)
  );
  if (!upstream.ok) return upstream;
  const result = (await upstream.json()) as unknown;
  const headers: Record<string, string> = {
    "Cache-Control": "private, no-store",
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Expose-Headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE",
  };
  const paymentResponse = upstream.headers.get("PAYMENT-RESPONSE");
  if (paymentResponse) headers["PAYMENT-RESPONSE"] = paymentResponse;
  return new Response(
    JSON.stringify({
      jsonrpc: "2.0",
      id: id ?? null,
      result: {
        content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
        structuredContent: result,
      },
    }),
    { status: 200, headers }
  );
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
  /**
   * Runtime-derived, never a configured secret: the worker sets this per
   * request to "seal_lookup" or "verify_app" when it actually holds a registry
   * path for paid verify. Absent = registry_not_bound.
   */
  X402_PAID_VERIFY_PATH?: string;
  // Index signature so Node's ProcessEnv (the default arg) stays assignable.
  // Types-only: no runtime behavior change.
  [key: string]: string | undefined;
};

/**
 * The named x402 vars without the index signature, for a worker's own Env:
 * that Env also holds bindings (VERIFY_APP), which a string index rejects.
 */
export type X402EnvVars = Pick<
  X402HealthEnv,
  | "X402_PAY_TO"
  | "X402_FACILITATOR_URL"
  | "X402_NETWORK"
  | "X402_CHAIN_ID"
  | "X402_USDC_ASSET"
  | "X402_PRICE_USD"
  | "X402_DAILY_CAP_USD"
>;

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
  paidVerify: X402PaidVerifyStatus;
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
  const paidVerify = x402PaidVerifyStatus(
    X402_PAID_VERIFY_BOUND || x402PaidVerifyPathBound(env.X402_PAID_VERIFY_PATH)
  );
  if (!paidVerify.bound) warnings.push(paidVerify.detail);

  return {
    ok: ready,
    ready,
    paidVerify,
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

export type X402CatalogAccept = {
  scheme: "exact";
  network: string;
  payTo: string;
  asset: string;
  amount: string;
  extra?: { name?: string; version?: string };
};

export type X402CatalogEndpoint = {
  method: "GET" | "POST";
  path: string;
  paid: boolean;
  description: string;
  priceUsd: number | null;
  priceAtomic: string | null;
  unpaidStatus?: number;
  answersPaidCalls?: boolean;
  /** Absolute URL so Saylor/CDP well-known parsers can list this endpoint. */
  url?: string;
  resource?: string;
  accepts?: X402CatalogAccept[];
  tags?: string[];
};

export type X402CatalogBody = {
  protocol: "x402";
  /** Unpaid HTTP JSON version (v2). PayAI /settle still uses the v1 requirement. */
  x402Version: 2;
  brand: "AuthiChain";
  docs: string;
  health: string;
  catalog: string;
  wellKnown: string;
  tokenomics: string;
  identity: string;
  unitOfAccount: "USDC";
  network: string;
  chainId: string;
  asset: string;
  payTo: string | null;
  pricePerCall: { usd: number; atomic: string };
  dailyCapUsd: number;
  status: X402HealthBody["status"];
  ready: boolean;
  paidVerify: X402PaidVerifyStatus;
  mode: X402HealthBody["mode"];
  endpoints: X402CatalogEndpoint[];
  humanCheckout: {
    rail: "stripe";
    passportUsd: number;
    dppUsd: number;
    farmUsd: number;
    starterUsd: number;
    creatorUsd: number;
    passportPaymentLink?: string;
    dppPaymentLink?: string;
    farmPaymentLink?: string;
    starterPaymentLink?: string;
    creatorPaymentLink?: string;
    offers: CatalogOffer[];
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
  const bound = health.paidVerify.bound;
  const origin = "https://authichain.com";
  const paid = (
    path: string,
    description: string,
    method: "GET" | "POST" = "POST"
  ): X402CatalogEndpoint => {
    const url = `${origin}${path}`;
    const accepts: X402CatalogAccept[] | undefined = health.payTo
      ? [
          {
            scheme: "exact",
            network: x402Caip2Network(health.network),
            payTo: health.payTo,
            asset: health.asset,
            amount: health.pricePerCall.atomic,
            extra: { name: "USD Coin", version: "2" },
          },
        ]
      : undefined;
    return {
      method,
      path,
      paid: true,
      description: bound
        ? description
        : `${description}. Not answering yet: a paid call is refused with 503 registry_not_bound before settlement; no payment is taken.`,
      priceUsd: health.pricePerCall.usd,
      priceAtomic: health.pricePerCall.atomic,
      unpaidStatus: 402,
      answersPaidCalls: bound,
      url,
      resource: url,
      accepts,
      tags: [...X402_RESOURCE_TAGS],
    };
  };
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
    x402Version: 2,
    brand: "AuthiChain",
    docs: "/x402",
    health: "/api/x402/health",
    catalog: "/api/x402/catalog",
    wellKnown: "/.well-known/x402.json",
    tokenomics:
      "https://github.com/undone0603/authichain-unified/blob/main/docs/strategy/AGENT_TOKENOMICS_x402.md",
    identity:
      "https://github.com/undone0603/authichain-unified/blob/main/docs/strategy/WEB3_IDENTITY.md",
    unitOfAccount: "USDC",
    network: x402Caip2Network(health.network),
    chainId: health.chainId,
    asset: health.asset,
    payTo: health.payTo,
    pricePerCall: health.pricePerCall,
    dailyCapUsd: health.dailyCapUsd,
    status: health.status,
    ready: health.ready,
    paidVerify: health.paidVerify,
    mode: health.mode,
    endpoints: [
      free("/api/x402/health", "Public rail health (no secrets)"),
      free("/api/x402/catalog", "Paid-endpoint catalog for agents and MCP"),
      free("/.well-known/x402.json", "Well-known catalog document"),
      free("/.well-known/x402", "x402scan fan-out (version + resources)"),
      free("/openapi.json", "OpenAPI 3.1 with x-payment-info for x402scan"),
      paid(
        "/api/x402",
        `${X402_RESOURCE_DESCRIPTION} Unpaid GET is 402.`,
        "GET"
      ),
      paid(
        "/api/v1/agent-verify",
        `${X402_RESOURCE_DESCRIPTION} Unpaid GET is 402.`,
        "GET"
      ),
      paid("/api/x402", X402_RESOURCE_DESCRIPTION),
      paid("/api/v1/agent-verify", X402_RESOURCE_DESCRIPTION),
      paid("/mcp", "MCP tools/call verify (GET is free discovery)"),
      paid("/api/mcp", "MCP tools/call verify alias"),
    ],
    humanCheckout: {
      rail: "stripe",
      passportUsd: planUsd("strainchain_passport"),
      dppUsd: planUsd("dpp_readiness"),
      farmUsd: planUsd("strainchain_farm"),
      starterUsd: planUsd("starter"),
      creatorUsd: planUsd("creator"),
      passportPaymentLink: planPaymentLink("strainchain_passport"),
      dppPaymentLink: planPaymentLink("dpp_readiness"),
      farmPaymentLink: planPaymentLink("strainchain_farm"),
      starterPaymentLink: planPaymentLink("starter"),
      creatorPaymentLink: planPaymentLink("creator"),
      offers: catalogOffers(),
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

export type X402AgentCardSkill = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  examples?: string[];
};

export type X402AgentCard = {
  name: "AuthiChain";
  description: string;
  url: string;
  version: string;
  documentationUrl: string;
  provider: { organization: "AuthiChain"; url: string };
  capabilities: {
    streaming: false;
    pushNotifications: false;
    extendedAgentCard: false;
  };
  defaultInputModes: string[];
  defaultOutputModes: string[];
  supportedInterfaces: Array<{
    url: string;
    protocolBinding: string;
    protocolVersion: string;
  }>;
  additionalInterfaces: Array<{ url: string; transport: string }>;
  skills: X402AgentCardSkill[];
  x402: {
    scheme: "exact";
    network: string;
    payTo: string | null;
    asset: string;
    amount: string;
    priceUsd: number;
    extra: { name: "USD Coin"; version: "2" };
    accepts?: X402CatalogAccept[];
    resources: string[];
  };
};

/**
 * A2A Agent Card at `/.well-known/agent-card.json`.
 * Identity + skills + x402 payment metadata for Trust Passport probes.
 * This host has no A2A JSON-RPC and no ERC-8004 registration — do not claim either.
 * A valid signature is not real-world truth. Do not add contact email.
 */
export async function x402AgentCard(
  env: X402HealthEnv = process.env
): Promise<X402AgentCard> {
  const catalog = await x402Catalog(env);
  const paid = catalog.endpoints.filter(e => e.paid);
  const resources = [
    ...new Set(
      paid.map(e => e.url || e.resource).filter((u): u is string => Boolean(u))
    ),
  ];
  const accepts = paid.find(e => e.accepts && e.accepts.length > 0)?.accepts;
  return {
    name: "AuthiChain",
    description: X402_RESOURCE_DESCRIPTION,
    url: "https://authichain.com/mcp",
    version: "1.3.2",
    documentationUrl: "https://authichain.com/x402",
    provider: {
      organization: "AuthiChain",
      url: "https://authichain.com",
    },
    capabilities: {
      streaming: false,
      pushNotifications: false,
      extendedAgentCard: false,
    },
    defaultInputModes: ["application/json"],
    defaultOutputModes: ["application/json"],
    supportedInterfaces: [
      {
        url: "https://authichain.com/mcp",
        protocolBinding: "HTTP",
        protocolVersion: "2025-03-26",
      },
    ],
    additionalInterfaces: [
      { url: "https://authichain.com/mcp", transport: "HTTP+JSON" },
      {
        url: "https://authichain.com/api/v1/agent-verify",
        transport: "HTTP+JSON",
      },
    ],
    skills: [
      {
        id: "paid-evidence-check",
        name: "Paid evidence check",
        description: X402_RESOURCE_DESCRIPTION,
        tags: [...X402_RESOURCE_TAGS],
        examples: [
          "POST https://authichain.com/api/v1/agent-verify with an X-PAYMENT header",
          "Run the independent verifier on the signed record; leftover unknowns stay unknown",
        ],
      },
    ],
    x402: {
      scheme: "exact",
      network: catalog.network,
      payTo: catalog.payTo,
      asset: catalog.asset,
      amount: catalog.pricePerCall.atomic,
      priceUsd: catalog.pricePerCall.usd,
      extra: { name: "USD Coin", version: "2" },
      accepts,
      resources,
    },
  };
}

/**
 * x402scan compatibility fan-out (`GET /.well-known/x402`). Keep this
 * document tiny — scanners expect `version` + `resources`, not the catalog.
 * Rich catalog stays at `/.well-known/x402.json`.
 */
export type X402ScanFanout = {
  version: 1;
  resources: string[];
};

export function x402ScanFanout(
  origin = "https://authichain.com"
): X402ScanFanout {
  const base = origin.replace(/\/+$/, "") || "https://authichain.com";
  return {
    version: 1,
    resources: [`${base}/api/v1/agent-verify`, `${base}/api/x402`],
  };
}

type X402OpenApiDocument = {
  openapi: "3.1.0";
  info: { title: string; version: string; description: string };
  servers: Array<{ url: string }>;
  paths: Record<string, unknown>;
};

/**
 * OpenAPI-first discovery for x402scan. Price comes from the same health
 * report as the catalog — never a second schedule. Do not list GET checkout.
 * GET /api/x402 and GET /api/v1/agent-verify are the paid paywall (HTTP 402);
 * free health is GET /api/x402/health. The Living QR scan is a free Decision
 * v1 GET and has no x-payment-info.
 */
export async function x402OpenApiDocument(
  env: X402HealthEnv = process.env,
  origin = "https://authichain.com"
): Promise<X402OpenApiDocument> {
  const health = await x402HealthReport(env);
  const amount = String(health.pricePerCall.usd);
  const paymentInfo = {
    protocols: ["x402"],
    price: { mode: "fixed", currency: "USD", amount },
  };
  const jsonBody = {
    type: "object",
    properties: {
      sealId: {
        type: "string",
        format: "uuid",
        description:
          "Required seal UUID. productId and serial are not registry keys.",
      },
    },
  };
  const paidResponses = {
    "402": { description: "Payment required (x402)" },
    ...(health.paidVerify.bound
      ? { "200": { description: "Paid verification result" } }
      : {
          "503": {
            description:
              "registry_not_bound: a paid call is refused before settlement; no payment is taken",
          },
        }),
  };
  const paidGet = {
    summary: "AuthiChain agent verification",
    "x-payment-info": paymentInfo,
    responses: paidResponses,
  };
  const paidPost = {
    operationId: "agentVerify",
    summary: "AuthiChain agent verification",
    "x-payment-info": paymentInfo,
    requestBody: {
      required: false,
      content: { "application/json": { schema: jsonBody } },
    },
    responses: {
      "400": {
        description:
          "A sealId that is not a UUID is refused before payment. Quote JSON without sealId is HTTP 402.",
      },
      ...paidResponses,
    },
  };
  return {
    openapi: "3.1.0",
    info: {
      title: "AuthiChain x402",
      version: "1.0.0",
      description: health.paidVerify.bound
        ? "Canonical paid verify is POST /api/v1/agent-verify. sealId must be a UUID. An empty body or quote JSON without sealId is HTTP 402. A sealId that is not a UUID is HTTP 400 before payment. Human SKUs are Stripe Payment Links on /pricing."
        : `Canonical paid verify is POST /api/v1/agent-verify. sealId must be a UUID. An empty body or quote JSON without sealId is HTTP 402. A sealId that is not a UUID is HTTP 400 before payment. ${health.paidVerify.detail} Human SKUs are Stripe Payment Links on /pricing.`,
    },
    servers: [{ url: origin.replace(/\/+$/, "") || "https://authichain.com" }],
    paths: {
      "/api/x402": {
        get: { ...paidGet, operationId: "agentVerifyGet" },
        post: paidPost,
      },
      "/api/v1/agent-verify": {
        get: { ...paidGet, operationId: "agentVerifyGetAlias" },
        post: { ...paidPost, operationId: "agentVerifyAlias" },
      },
      "/battery-passport": {
        get: {
          summary: "Battery passport gap map (free)",
          description:
            "E-bike and other light means of transport (LMT) batteries, plus industrial and EV batteries over 2 kWh, need a battery passport from 18 February 2027 under Regulation (EU) 2023/1542. This page is that gap map, with a worked example on a fictional e-bike pack at /battery-passport/sample-audit.",
          responses: {
            "200": {
              description: "HTML gap map. Not an x402 payment endpoint.",
            },
          },
        },
      },
      "/qron/r/{object_id}": {
        get: {
          operationId: "livingQrScan",
          summary:
            "Living QR Decision v1. This host verifies the signature. Not an x402 payment endpoint.",
          parameters: [
            {
              name: "object_id",
              in: "path",
              required: true,
              schema: { type: "string" },
              description:
                "Stored presentation id. Canonical form is qron:url: plus 8 hex characters.",
            },
          ],
          responses: {
            "200": {
              description:
                "AuthiChain Verification Decision v1 when the presentation verifies.",
            },
            "404": { description: "presentation_not_found" },
          },
        },
      },
    },
  };
}
