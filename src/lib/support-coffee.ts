/**
 * AuthiChain Proof-of-Support (Coffee) — zero platform-cut tip rail.
 *
 * Dual path on https://authichain.com/coffee:
 *   GET  Accept: text/html  → HTML 1-tap fiat
 *   GET  Accept: application/json | ?rail=x402 → HTTP 402 Base USDC
 *   POST /coffee or /api/coffee/checkout → Stripe Checkout Session
 *     (mode: payment, metadata.kind = coffee_support) or the live Payment
 *     Link fallback when STRIPE_SECRET_KEY is absent.
 *
 * Compliance: AuthiChain is an operating brand of Zachary Kietzman, sole
 * proprietor. Never an Inc. corporate entity. Never 501(c)(3) / tax-deductible.
 * Receipts mint only after Stripe payment_status === "paid" && status ===
 * "complete" && metadata.kind === "coffee_support", or a settled x402 pay.
 *
 * The bundled Ed25519 key in protocol/samples/coffee-receipt-demo.* is a
 * dedicated SAMPLE signer. It is not the live passport issuer. Do not add
 * it to /.well-known/jwks.json. Bind COFFEE_RECEIPT_PRIVATE_JWK in production.
 */
import {
  applyHostedCheckoutRecovery,
  hostedCheckoutRecoveryParams,
} from "./checkout-recovery";
import { checkoutReturnOrigin } from "./checkout-gate";
import { CHECKOUT_REDIRECT_HEADERS } from "./checkout-email";
import {
  BASE_USDC_ASSET,
  X402_PUBLISHED_PAY_TO,
  encodeX402HeaderJson,
} from "./x402";
import sampleCoffeeJwksJson from "../../protocol/samples/coffee-receipt-demo.jwks.json";
import sampleCoffeePrivateJwkJson from "../../protocol/samples/coffee-receipt-demo.private.jwk.json";

export const COFFEE_UNIT_CENTS = 500;
export const COFFEE_PRESETS = Object.freeze([1, 3, 5] as const);
export const MIN_SUPPORT_CENTS = 300;
export const MAX_SUPPORT_CENTS = 50000;
export const HANDLE_MAX = 40;
export const MESSAGE_MAX = 140;

export const NON_TAX_DEDUCTIBLE_DISCLOSURE =
  "Voluntary commercial support for AuthiChain software development (Zachary Kietzman, sole proprietor). Not a charitable donation and not tax-deductible; confers no equity, tokens, credits, or SLA.";

export const SUPPORT_SKU = "proof_of_support_coffee";
export const SUPPORT_KIND = "coffee_support";
export const SUPPORT_PRODUCT_NAME = "Buy AuthiChain a Coffee";
export const RECEIPT_TYPE = "authichain.proof_of_coffee.v1";

/** Live Stripe product on acct_1SXIyEGqTruSqV8T. */
export const COFFEE_PRODUCT_ID = "prod_VZzV7sMrcp0RPu";
/** Live custom-amount Price ($5 preset, $3–$500 bounds). */
export const COFFEE_PRICE_ID = "price_1UYpWwGqTruSqV8Te1I5kliJ";
/** Hosted Payment Link — fail-safe when STRIPE_SECRET_KEY is absent. */
export const COFFEE_PAYMENT_LINK_URL =
  "https://buy.stripe.com/8x24gz4Vb6BgdOGePO1NE09";
export const COFFEE_PAYMENT_LINK_ID = "plink_1UYpXCGqTruSqV8Tba11G9SQ";

export const COFFEE_PATH = "/coffee";
export const COFFEE_CHECKOUT_PATH = "/api/coffee/checkout";
export const COFFEE_JWKS_PATH = "/coffee/jwks.json";
export const COFFEE_SAMPLE_RECEIPT_PATH = "/coffee/sample-receipt.json";
export const COFFEE_ORIGIN = "https://authichain.com";
export const COFFEE_CANONICAL = `${COFFEE_ORIGIN}${COFFEE_PATH}`;

export const THANKS_COPY = "Thanks for the coffee";
export const THANKS_BADGE = "Thanks for the coffee ☕";
export const BUY_ANOTHER_COPY = "Buy another coffee";
export const BUY_HEADING = "Buy AuthiChain a coffee";
export const FREE_PREVIEW_V1 = "FREE-PREVIEW-V1";

/** Non-PII returning-supporter flag. HttpOnly=false so widgets can read it. */
export const COFFEE_THANKS_COOKIE = "ac_coffee_thanks";
export const COFFEE_THANKS_STORAGE_KEY = "ac_coffee_thanks";

export const SAMPLE_COFFEE_JWKS = sampleCoffeeJwksJson as {
  keys: CoffeeJwk[];
};
export const SAMPLE_COFFEE_PRIVATE_JWK =
  sampleCoffeePrivateJwkJson as CoffeePrivateJwk;
export const SAMPLE_COFFEE_KID = String(
  SAMPLE_COFFEE_JWKS.keys[0]?.kid || "support-receipt-sample"
);

export const COFFEE_PROMISES = Object.freeze({
  equity: false,
  tokens: false,
  sla: false,
  productEntitlement: false,
  taxDeductible: false,
  charity: false,
});

const URL_RE =
  /(?:https?:\/\/|www\.|[a-z0-9-]+\.(?:com|io|net|org|xyz|co|ai|app|dev|gg|me|info|biz)\b)/gi;
const HANDLE_SAFE = /[^a-zA-Z0-9_\-.\s@]/g;
const WHITESPACE = /\s+/g;

export type CoffeeJwk = {
  kty: string;
  crv: string;
  x: string;
  kid?: string;
  use?: string;
  alg?: string;
  d?: string;
};

export type CoffeePrivateJwk = CoffeeJwk & {
  d: string;
  purpose?: string;
};

export type CoffeeEnv = {
  STRIPE_SECRET_KEY?: string;
  COFFEE_PAYMENT_LINK_URL?: string;
  COFFEE_RECEIPT_PRIVATE_JWK?: string;
};

export type SupportAmount =
  | { ok: true; cents: number; units: number | null; label: string }
  | { ok: false; error: string };

export type CoffeePageMode = "buy" | "paid_thanks" | "returning_thanks";

export type CoffeeThanksFlag = { receiptId: string; ts: number };

const JSON_HEADERS = {
  "Cache-Control": "private, no-store",
  "CDN-Cache-Control": "no-store",
  "Content-Type": "application/json; charset=utf-8",
};

export function coffeePaymentLinkUrl(env?: CoffeeEnv): string {
  const fromEnv = (env?.COFFEE_PAYMENT_LINK_URL || "").trim();
  return fromEnv || COFFEE_PAYMENT_LINK_URL;
}

export function stripUrls(value: unknown): string {
  return String(value ?? "")
    .replace(URL_RE, "")
    .replace(WHITESPACE, " ")
    .trim();
}

export function sanitizeSupporterFields(
  input: { handle?: unknown; message?: unknown } = {}
): { handle: string | null; message: string | null } {
  const handle = stripUrls(input.handle)
    .replace(HANDLE_SAFE, "")
    .trim()
    .slice(0, HANDLE_MAX);
  const message = stripUrls(input.message).slice(0, MESSAGE_MAX);
  return {
    handle: handle || null,
    message: message || null,
  };
}

export function resolveSupportAmount(
  input: {
    units?: unknown;
    customUsd?: unknown;
    customCents?: unknown;
    amount_cents?: unknown;
    amountCents?: unknown;
  } = {}
): SupportAmount {
  const unitsRaw = input.units;
  const customCentsRaw =
    input.customCents ?? input.amount_cents ?? input.amountCents;
  const customUsdRaw = input.customUsd;

  if (unitsRaw !== undefined && unitsRaw !== null && unitsRaw !== "") {
    const units = Number(unitsRaw);
    if (
      !Number.isInteger(units) ||
      !(COFFEE_PRESETS as readonly number[]).includes(units)
    ) {
      return {
        ok: false,
        error: `units must be one of ${COFFEE_PRESETS.join(", ")}`,
      };
    }
    const cents = units * COFFEE_UNIT_CENTS;
    return {
      ok: true,
      cents,
      units,
      label: `${units}× coffee ($${(cents / 100).toFixed(2)})`,
    };
  }

  let cents: number | null = null;
  const centsInput = customCentsRaw;
  if (centsInput !== undefined && centsInput !== null && centsInput !== "") {
    cents = Number(centsInput);
  } else if (
    customUsdRaw !== undefined &&
    customUsdRaw !== null &&
    customUsdRaw !== ""
  ) {
    const usd = Number(customUsdRaw);
    if (!Number.isFinite(usd)) {
      return { ok: false, error: "customUsd must be a finite number" };
    }
    cents = Math.round(usd * 100);
  } else {
    return {
      ok: false,
      error: "Provide units (1|3|5) or customUsd / customCents",
    };
  }

  if (!Number.isInteger(cents)) {
    return { ok: false, error: "amount must resolve to whole cents" };
  }
  if (cents < MIN_SUPPORT_CENTS) {
    return {
      ok: false,
      error: `minimum support is $${(MIN_SUPPORT_CENTS / 100).toFixed(2)}`,
    };
  }
  if (cents > MAX_SUPPORT_CENTS) {
    return {
      ok: false,
      error: `maximum support is $${(MAX_SUPPORT_CENTS / 100).toFixed(2)}`,
    };
  }

  return {
    ok: true,
    cents,
    units: null,
    label: `custom ($${(cents / 100).toFixed(2)})`,
  };
}

export function negotiateSupportRail(
  input: { accept?: string | null; rail?: string | null } = {}
): "html" | "x402" {
  const rail = String(input.rail ?? "")
    .trim()
    .toLowerCase();
  if (rail === "x402" || rail === "agent" || rail === "usdc") return "x402";
  const accept = String(input.accept ?? "").toLowerCase();
  if (
    accept.includes("application/json") ||
    accept.includes("application/x402") ||
    accept.includes("application/payment-required")
  ) {
    return "x402";
  }
  return "html";
}

export function centsToUsdcAtomic(cents: number): string {
  if (!Number.isInteger(cents) || cents < 0) {
    throw new Error("cents must be a non-negative integer");
  }
  return String(BigInt(cents) * 10000n);
}

export function buildStripeCheckoutPayload(
  opts: {
    units?: unknown;
    customUsd?: unknown;
    customCents?: unknown;
    amount_cents?: unknown;
    handle?: unknown;
    message?: unknown;
    origin?: string;
    brand?: string;
  } = {}
):
  | { ok: false; error: string }
  | {
      ok: true;
      amount: Extract<SupportAmount, { ok: true }>;
      fields: { handle: string | null; message: string | null };
      disclosure: string;
      session: Record<string, unknown>;
    } {
  const amount = resolveSupportAmount(opts);
  if (!amount.ok) return { ok: false, error: amount.error };

  const fields = sanitizeSupporterFields(opts);
  const origin = String(opts.origin || COFFEE_ORIGIN)
    .replace(/\/$/, "")
    .replace(/\/coffee$/i, "");
  const brand = String(opts.brand || "authichain").slice(0, 32);
  const recovery = hostedCheckoutRecoveryParams("payment");

  const session = {
    mode: "payment" as const,
    submit_type: "pay" as const,
    billing_address_collection: "auto" as const,
    automatic_payment_methods: { enabled: true },
    ...recovery,
    line_items: [
      {
        quantity: 1,
        price_data: {
          currency: "usd",
          unit_amount: amount.cents,
          product_data: {
            name: SUPPORT_PRODUCT_NAME,
            description: NON_TAX_DEDUCTIBLE_DISCLOSURE,
            metadata: {
              sku: SUPPORT_SKU,
              kind: SUPPORT_KIND,
              coffee_unit_cents: String(COFFEE_UNIT_CENTS),
              units: amount.units === null ? "custom" : String(amount.units),
              stripe_product_id: COFFEE_PRODUCT_ID,
            },
          },
        },
      },
    ],
    success_url: `${origin}${COFFEE_PATH}?thanks=1&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${origin}${COFFEE_PATH}`,
    metadata: {
      sku: SUPPORT_SKU,
      kind: SUPPORT_KIND,
      brand,
      rail: "fiat",
      amount_cents: String(amount.cents),
      units: amount.units === null ? "custom" : String(amount.units),
      non_tax_deductible: "true",
      stripe_product_id: COFFEE_PRODUCT_ID,
      stripe_price_id: COFFEE_PRICE_ID,
      ...(fields.handle ? { supporter_handle: fields.handle } : {}),
      ...(fields.message ? { supporter_message: fields.message } : {}),
      disclosure: "commercial_tip_not_charity",
    },
    payment_intent_data: {
      description: `AuthiChain Proof-of-Support — ${amount.label}`,
      metadata: {
        sku: SUPPORT_SKU,
        kind: SUPPORT_KIND,
        brand,
        amount_cents: String(amount.cents),
        non_tax_deductible: "true",
      },
      statement_descriptor_suffix: "SUPPORT",
    },
    custom_text: {
      submit: {
        message: NON_TAX_DEDUCTIBLE_DISCLOSURE,
      },
    },
  };

  return {
    ok: true,
    amount,
    fields,
    disclosure: NON_TAX_DEDUCTIBLE_DISCLOSURE,
    session,
  };
}

export function buildX402SupportChallenge(
  opts: {
    units?: unknown;
    customUsd?: unknown;
    customCents?: unknown;
    amount_cents?: unknown;
    origin?: string;
    resource?: string;
    payTo?: string;
  } = {}
):
  | { ok: false; error: string }
  | {
      ok: true;
      status: 402;
      amount: Extract<SupportAmount, { ok: true }>;
      payTo: string;
      asset: string;
      network: string;
      body: Record<string, unknown>;
      v2: Record<string, unknown>;
      headers: Record<string, string>;
      disclosure: string;
    } {
  const hasAmount =
    opts.units != null && opts.units !== ""
      ? true
      : opts.customUsd != null && opts.customUsd !== ""
        ? true
        : opts.customCents != null && opts.customCents !== ""
          ? true
          : opts.amount_cents != null && opts.amount_cents !== "";
  const amount = resolveSupportAmount(hasAmount ? opts : { units: 1 });
  if (!amount.ok) return { ok: false, error: amount.error };

  const origin = String(opts.origin || COFFEE_ORIGIN)
    .replace(/\/$/, "")
    .replace(/\/coffee$/i, "");
  const resource = String(opts.resource || `${origin}${COFFEE_PATH}`);
  const payTo = String(opts.payTo || X402_PUBLISHED_PAY_TO);
  const asset = BASE_USDC_ASSET;
  const network = "base";
  const maxAmountRequired = centsToUsdcAtomic(amount.cents);

  const requirement = {
    scheme: "exact" as const,
    network,
    maxAmountRequired,
    resource,
    description:
      "AuthiChain Proof-of-Support micro-tip (USDC). Commercial tip only — not tax-deductible, no equity/tokens/SLA.",
    mimeType: "application/json" as const,
    payTo,
    maxTimeoutSeconds: 60,
    asset,
    extra: {
      name: "USD Coin",
      version: "2",
      sku: SUPPORT_SKU,
      kind: SUPPORT_KIND,
      amount_cents: amount.cents,
      units: amount.units,
      chainId: 8453,
      non_tax_deductible: true,
    },
  };

  const v1 = { x402Version: 1, accepts: [requirement] };
  const v2 = {
    x402Version: 2,
    error: "Payment required for Proof-of-Support",
    accepts: [{ ...requirement, network: "eip155:8453" }],
  };
  const headers = {
    "Content-Type": "application/json; charset=utf-8",
    "PAYMENT-REQUIRED": encodeX402HeaderJson(v2),
    "Access-Control-Expose-Headers": "PAYMENT-REQUIRED, PAYMENT-RESPONSE",
    "Cache-Control": "no-store",
  };

  return {
    ok: true,
    status: 402,
    amount,
    payTo,
    asset,
    network,
    body: v1,
    v2,
    headers,
    disclosure: NON_TAX_DEDUCTIBLE_DISCLOSURE,
  };
}

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(value as Record<string, unknown>).sort()) {
      out[k] = sortKeys((value as Record<string, unknown>)[k]);
    }
    return out;
  }
  return value;
}

export function canonicalJson(obj: unknown): string {
  return JSON.stringify(sortKeys(obj));
}

function b64url(bytes: ArrayBuffer | Uint8Array | Buffer): string {
  const buf = Buffer.from(bytes as ArrayBuffer);
  return buf.toString("base64url");
}

function b64urlJson(obj: unknown): string {
  return b64url(Buffer.from(JSON.stringify(obj), "utf8"));
}

function signingJwkFromPrivate(jwk: CoffeePrivateJwk): JsonWebKey {
  return {
    kty: "OKP",
    crv: "Ed25519",
    x: jwk.x,
    d: jwk.d,
    ext: true,
    key_ops: ["sign"],
  };
}

function publicJwkFromPrivate(jwk: CoffeePrivateJwk, kid: string): CoffeeJwk {
  return {
    kty: "OKP",
    crv: "Ed25519",
    x: jwk.x,
    kid,
    use: "sig",
    alg: "EdDSA",
  };
}

export async function generateSupportReceiptKeypair(): Promise<{
  kid: string;
  publicJwk: CoffeeJwk;
  privateJwk: CoffeePrivateJwk;
}> {
  const pair = (await crypto.subtle.generateKey({ name: "Ed25519" }, true, [
    "sign",
    "verify",
  ])) as CryptoKeyPair;
  const pub = (await crypto.subtle.exportKey(
    "jwk",
    pair.publicKey
  )) as CoffeeJwk;
  const priv = (await crypto.subtle.exportKey(
    "jwk",
    pair.privateKey
  )) as CoffeePrivateJwk;
  const digest = await crypto.subtle.digest(
    "SHA-256",
    Buffer.from(String(pub.x), "base64url")
  );
  const kid = `support-receipt-${Buffer.from(digest).toString("hex").slice(0, 16)}`;
  return {
    kid,
    publicJwk: { ...pub, kid, use: "sig", alg: "EdDSA" },
    privateJwk: {
      ...priv,
      kid,
      use: "sig",
      alg: "EdDSA",
      purpose: "generated demo key — not a live passport issuer",
    },
  };
}

function parsePrivateJwk(raw: string | CoffeePrivateJwk | undefined): {
  jwk: CoffeePrivateJwk;
  sample: boolean;
} {
  if (raw && typeof raw === "object" && raw.d && raw.x) {
    return { jwk: raw, sample: false };
  }
  const text = typeof raw === "string" ? raw.trim() : "";
  if (text) {
    try {
      const parsed = JSON.parse(text) as CoffeePrivateJwk;
      if (parsed?.d && parsed?.x && parsed?.kty === "OKP") {
        return { jwk: parsed, sample: false };
      }
    } catch {
      /* fall through to sample */
    }
  }
  return { jwk: SAMPLE_COFFEE_PRIVATE_JWK, sample: true };
}

export function coffeeJwksForEnv(env?: CoffeeEnv): {
  keys: CoffeeJwk[];
  sample: boolean;
  kid: string;
} {
  const { jwk, sample } = parsePrivateJwk(env?.COFFEE_RECEIPT_PRIVATE_JWK);
  const kid = String(jwk.kid || SAMPLE_COFFEE_KID);
  return {
    keys: [publicJwkFromPrivate(jwk, kid)],
    sample,
    kid,
  };
}

export type ProofOfCoffeeRecord = {
  type: string;
  receiptId: string;
  issuedAt: string;
  brand: string;
  sku: string;
  rail: "fiat" | "x402";
  amount: { currency: string; cents: number; display: string };
  payment: {
    status: string;
    provider: string;
    reference: string | null;
    network: string | null;
  };
  supporter: { handle: string | null; message: string | null };
  promises: typeof COFFEE_PROMISES;
  disclosure: string;
  note: string;
  signer: {
    kind: "live_secret" | "bundled_sample_ed25519";
    kid: string;
    sample: boolean;
  };
};

export async function mintProofOfCoffeeReceipt(
  input: {
    rail: "fiat" | "x402";
    paymentStatus: string;
    amountCents: number;
    handle?: unknown;
    message?: unknown;
    paymentReference?: string;
    brand?: string;
    kid?: string;
    issuedAt?: string;
    receiptId?: string;
    privateJwk?: string | CoffeePrivateJwk;
  },
  privateKeySource?: string | CoffeePrivateJwk
): Promise<{
  record: ProofOfCoffeeRecord;
  jws: string;
  jwks: { keys: CoffeeJwk[] };
  sampleSigner: boolean;
  verification: {
    alg: "EdDSA";
    kid: string;
    canonical: string;
    offline: true;
  };
}> {
  const paymentStatus = String(input.paymentStatus || "").toLowerCase();
  const rail = input.rail;
  if (rail === "fiat" && paymentStatus !== "paid") {
    throw new Error('fiat rail requires paymentStatus === "paid"');
  }
  if (
    rail === "x402" &&
    paymentStatus !== "settled" &&
    paymentStatus !== "paid"
  ) {
    throw new Error('x402 rail requires paymentStatus "settled" or "paid"');
  }

  const amountCents = Number(input.amountCents);
  if (!Number.isInteger(amountCents) || amountCents < MIN_SUPPORT_CENTS) {
    throw new Error("amountCents below minimum or not an integer");
  }
  if (amountCents > MAX_SUPPORT_CENTS) {
    throw new Error("amountCents above maximum");
  }

  const { jwk, sample } = parsePrivateJwk(input.privateJwk || privateKeySource);
  const kid = input.kid || String(jwk.kid || SAMPLE_COFFEE_KID);
  const fields = sanitizeSupporterFields({
    handle: input.handle,
    message: input.message,
  });
  const issuedAt = input.issuedAt || new Date().toISOString();
  const receiptId =
    input.receiptId || `poc_${crypto.randomUUID().replace(/-/g, "")}`;

  const record: ProofOfCoffeeRecord = {
    type: RECEIPT_TYPE,
    receiptId,
    issuedAt,
    brand: String(input.brand || "authichain").slice(0, 32),
    sku: SUPPORT_SKU,
    rail,
    amount: {
      currency: rail === "x402" ? "USDC" : "USD",
      cents: amountCents,
      display: `$${(amountCents / 100).toFixed(2)}`,
    },
    payment: {
      status: paymentStatus,
      provider: rail === "x402" ? "x402" : "stripe",
      reference: String(input.paymentReference || "").slice(0, 128) || null,
      network: rail === "x402" ? "base" : null,
    },
    supporter: {
      handle: fields.handle,
      message: fields.message,
    },
    promises: { ...COFFEE_PROMISES },
    disclosure: NON_TAX_DEDUCTIBLE_DISCLOSURE,
    note: sample
      ? "SAMPLE Proof-of-Coffee signed by the bundled demonstration Ed25519 key. Not the live passport issuer. Offline-verifiable. Thanks for the support."
      : "Proof-of-Coffee. Offline-verifiable Ed25519 receipt. Thanks for the support.",
    signer: {
      kind: sample ? "bundled_sample_ed25519" : "live_secret",
      kid,
      sample,
    },
  };

  const payloadBytes = Buffer.from(canonicalJson(record), "utf8");
  const key = await crypto.subtle.importKey(
    "jwk",
    signingJwkFromPrivate(jwk),
    { name: "Ed25519" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign(
    { name: "Ed25519" },
    key,
    payloadBytes
  );
  const jwsHeader = { alg: "EdDSA", typ: "POC+JSON", kid };
  const jws = `${b64urlJson(jwsHeader)}.${b64url(payloadBytes)}.${b64url(signature)}`;
  const jwks = { keys: [publicJwkFromPrivate(jwk, kid)] };

  return {
    record,
    jws,
    jwks,
    sampleSigner: sample,
    verification: {
      alg: "EdDSA",
      kid,
      canonical: "json-sort-keys-utf8",
      offline: true,
    },
  };
}

export async function verifyProofOfCoffeeReceipt(
  jws: string,
  jwksOrJwk: { keys: CoffeeJwk[] } | CoffeeJwk
): Promise<
  | {
      ok: true;
      record: ProofOfCoffeeRecord;
      header: { alg: string; kid?: string };
    }
  | { ok: false; error: string }
> {
  const parts = String(jws).split(".");
  if (parts.length !== 3) return { ok: false, error: "jws must have 3 parts" };

  let header: { alg?: string; kid?: string };
  try {
    header = JSON.parse(Buffer.from(parts[0], "base64url").toString("utf8"));
  } catch {
    return { ok: false, error: "invalid jws header" };
  }
  if (header.alg !== "EdDSA") return { ok: false, error: "alg must be EdDSA" };

  const payloadBytes = Buffer.from(parts[1], "base64url");
  let record: ProofOfCoffeeRecord;
  try {
    record = JSON.parse(payloadBytes.toString("utf8")) as ProofOfCoffeeRecord;
  } catch {
    return { ok: false, error: "invalid jws payload" };
  }
  if (record?.type !== RECEIPT_TYPE) {
    return { ok: false, error: "unexpected receipt type" };
  }
  if (canonicalJson(record) !== payloadBytes.toString("utf8")) {
    return { ok: false, error: "payload is not canonical JSON" };
  }

  const keys = Array.isArray((jwksOrJwk as { keys?: CoffeeJwk[] }).keys)
    ? (jwksOrJwk as { keys: CoffeeJwk[] }).keys
    : [jwksOrJwk as CoffeeJwk];
  const jwk =
    keys.find(k => k.kid && header.kid && k.kid === header.kid) || keys[0];
  if (!jwk?.x) return { ok: false, error: "no verifying key" };

  try {
    const publicKey = await crypto.subtle.importKey(
      "jwk",
      { kty: "OKP", crv: "Ed25519", x: jwk.x },
      { name: "Ed25519" },
      false,
      ["verify"]
    );
    const valid = await crypto.subtle.verify(
      { name: "Ed25519" },
      publicKey,
      Buffer.from(parts[2], "base64url"),
      payloadBytes
    );
    if (!valid) return { ok: false, error: "invalid signature" };
  } catch {
    return { ok: false, error: "invalid signature" };
  }

  return { ok: true, record, header: { alg: "EdDSA", kid: header.kid } };
}

export function isStripeCheckoutSessionId(id: string): boolean {
  return /^cs_(test|live)_[A-Za-z0-9]+$/.test(id) && id.length <= 256;
}

export function isCoffeePaidSession(session: {
  payment_status?: string | null;
  status?: string | null;
  metadata?: Record<string, string> | null;
}): boolean {
  return (
    session.payment_status === "paid" &&
    session.status === "complete" &&
    session.metadata?.kind === SUPPORT_KIND
  );
}

export type StripeCoffeeSession = {
  id?: string;
  payment_status?: string | null;
  status?: string | null;
  amount_total?: number | null;
  metadata?: Record<string, string> | null;
  error?: { message?: string };
};

export async function retrieveCoffeeCheckoutSession(
  stripeSecretKey: string,
  sessionId: string,
  fetchImpl: typeof fetch = fetch
): Promise<StripeCoffeeSession | null> {
  if (!stripeSecretKey || !isStripeCheckoutSessionId(sessionId)) return null;
  try {
    const res = await fetchImpl(
      `https://api.stripe.com/v1/checkout/sessions/${encodeURIComponent(sessionId)}`,
      {
        method: "GET",
        headers: { Authorization: `Bearer ${stripeSecretKey}` },
      }
    );
    const data = (await res.json()) as StripeCoffeeSession;
    if (!res.ok) return null;
    return data;
  } catch {
    return null;
  }
}

export function parseCoffeeThanksCookie(
  cookieHeader: string | null | undefined
): CoffeeThanksFlag | null {
  const raw = String(cookieHeader || "");
  const parts = raw.split(";");
  for (const part of parts) {
    const trimmed = part.trim();
    if (!trimmed.startsWith(`${COFFEE_THANKS_COOKIE}=`)) continue;
    const value = decodeURIComponent(
      trimmed.slice(`${COFFEE_THANKS_COOKIE}=`.length)
    );
    return parseCoffeeThanksFlag(value);
  }
  return null;
}

export function parseCoffeeThanksFlag(
  value: string | null | undefined
): CoffeeThanksFlag | null {
  const raw = String(value || "").trim();
  if (!raw) return null;
  if (raw.startsWith("{")) {
    try {
      const parsed = JSON.parse(raw) as {
        receiptId?: string;
        ts?: number;
        v?: number;
      };
      if (
        parsed.receiptId &&
        /^poc_[a-zA-Z0-9]+$/.test(parsed.receiptId) &&
        Number.isFinite(Number(parsed.ts))
      ) {
        return { receiptId: parsed.receiptId, ts: Number(parsed.ts) };
      }
    } catch {
      return null;
    }
    return null;
  }
  const [receiptId, tsRaw] = raw.split("|");
  if (!receiptId || !/^poc_[a-zA-Z0-9]+$/.test(receiptId)) return null;
  const ts = Number(tsRaw);
  if (!Number.isFinite(ts)) return null;
  return { receiptId, ts };
}

export function serializeCoffeeThanksCookie(flag: CoffeeThanksFlag): string {
  const value = encodeURIComponent(`${flag.receiptId}|${flag.ts}`);
  return `${COFFEE_THANKS_COOKIE}=${value}; Path=/; Max-Age=31536000; SameSite=Lax`;
}

export function resolveCoffeePageMode(input: {
  thanksQuery?: boolean;
  sessionId?: string | null;
  paidSession?: boolean;
  cookieFlag?: CoffeeThanksFlag | null;
}): CoffeePageMode {
  const sessionId = String(input.sessionId || "").trim();
  if (sessionId) {
    return input.paidSession ? "paid_thanks" : "buy";
  }
  if (input.thanksQuery) return "buy";
  if (input.cookieFlag?.receiptId) return "returning_thanks";
  return "buy";
}

function checkoutBodyFromPayload(
  payload: Extract<ReturnType<typeof buildStripeCheckoutPayload>, { ok: true }>
): URLSearchParams {
  const session = payload.session as {
    mode: string;
    submit_type: string;
    billing_address_collection: string;
    success_url: string;
    cancel_url: string;
    metadata: Record<string, string>;
    payment_intent_data: {
      description: string;
      metadata: Record<string, string>;
      statement_descriptor_suffix: string;
    };
    custom_text: { submit: { message: string } };
    line_items: Array<{
      quantity: number;
      price_data: {
        currency: string;
        unit_amount: number;
        product_data: {
          name: string;
          description: string;
          metadata: Record<string, string>;
        };
      };
    }>;
  };
  const body = new URLSearchParams();
  body.set("mode", session.mode);
  body.set("submit_type", session.submit_type);
  body.set("billing_address_collection", session.billing_address_collection);
  body.set("automatic_payment_methods[enabled]", "true");
  body.set("line_items[0][quantity]", String(session.line_items[0].quantity));
  body.set(
    "line_items[0][price_data][currency]",
    session.line_items[0].price_data.currency
  );
  body.set(
    "line_items[0][price_data][unit_amount]",
    String(session.line_items[0].price_data.unit_amount)
  );
  body.set(
    "line_items[0][price_data][product_data][name]",
    session.line_items[0].price_data.product_data.name
  );
  body.set(
    "line_items[0][price_data][product_data][description]",
    session.line_items[0].price_data.product_data.description
  );
  const productMeta = session.line_items[0].price_data.product_data.metadata;
  for (const [k, v] of Object.entries(productMeta)) {
    body.set(`line_items[0][price_data][product_data][metadata][${k}]`, v);
  }
  body.set("success_url", session.success_url);
  body.set("cancel_url", session.cancel_url);
  for (const [k, v] of Object.entries(session.metadata)) {
    body.set(`metadata[${k}]`, v);
  }
  body.set(
    "payment_intent_data[description]",
    session.payment_intent_data.description
  );
  body.set(
    "payment_intent_data[statement_descriptor_suffix]",
    session.payment_intent_data.statement_descriptor_suffix
  );
  for (const [k, v] of Object.entries(session.payment_intent_data.metadata)) {
    body.set(`payment_intent_data[metadata][${k}]`, v);
  }
  body.set("custom_text[submit][message]", session.custom_text.submit.message);
  applyHostedCheckoutRecovery(body, "payment");
  return body;
}

export async function createCoffeeCheckoutSession(opts: {
  request?: Request;
  stripeSecretKey?: string;
  paymentLinkUrl?: string;
  origin?: string;
  units?: unknown;
  customUsd?: unknown;
  customCents?: unknown;
  amount_cents?: unknown;
  handle?: unknown;
  message?: unknown;
  fetchImpl?: typeof fetch;
}): Promise<
  | {
      ok: true;
      url: string;
      via: "stripe" | "payment_link";
      amountCents?: number;
    }
  | { ok: false; status: 400; error: string }
> {
  const payload = buildStripeCheckoutPayload({
    units: opts.units,
    customUsd: opts.customUsd,
    customCents: opts.customCents,
    amount_cents: opts.amount_cents,
    handle: opts.handle,
    message: opts.message,
    origin:
      opts.origin ||
      (opts.request ? checkoutReturnOrigin(opts.request) : COFFEE_ORIGIN),
  });
  if (!payload.ok) return { ok: false, status: 400, error: payload.error };

  const fallback = (opts.paymentLinkUrl || COFFEE_PAYMENT_LINK_URL).trim();
  const key = (opts.stripeSecretKey || "").trim();
  if (!key) {
    return { ok: true, url: fallback, via: "payment_link" };
  }

  try {
    const fetchImpl = opts.fetchImpl || fetch;
    const stripeRes = await fetchImpl(
      "https://api.stripe.com/v1/checkout/sessions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: checkoutBodyFromPayload(payload),
      }
    );
    const data = (await stripeRes.json()) as {
      url?: string;
      error?: { message?: string };
    };
    if (!stripeRes.ok || !data.url) {
      return { ok: true, url: fallback, via: "payment_link" };
    }
    return {
      ok: true,
      url: data.url,
      via: "stripe",
      amountCents: payload.amount.cents,
    };
  } catch {
    return { ok: true, url: fallback, via: "payment_link" };
  }
}

export function wantsCoffeeJson(request: Request): boolean {
  const accept = (request.headers.get("accept") || "").toLowerCase();
  const contentType = (request.headers.get("content-type") || "").toLowerCase();
  if (contentType.includes("application/json")) return true;
  if (accept.includes("application/json") && !accept.includes("text/html")) {
    return true;
  }
  return false;
}

export async function readCoffeeCheckoutFields(
  request: Request
): Promise<Record<string, unknown>> {
  const url = new URL(request.url);
  const fromQuery: Record<string, unknown> = {
    units: url.searchParams.get("units") || undefined,
    customUsd: url.searchParams.get("customUsd") || undefined,
    customCents:
      url.searchParams.get("customCents") ||
      url.searchParams.get("amount_cents") ||
      undefined,
    handle: url.searchParams.get("handle") || undefined,
    message: url.searchParams.get("message") || undefined,
  };
  const contentType = (request.headers.get("content-type") || "").toLowerCase();
  if (request.method === "GET" || request.method === "HEAD") return fromQuery;
  try {
    if (contentType.includes("application/json")) {
      const body = (await request.json()) as Record<string, unknown>;
      return { ...fromQuery, ...body };
    }
    if (
      contentType.includes("application/x-www-form-urlencoded") ||
      contentType.includes("multipart/form-data")
    ) {
      const form = await request.formData();
      const body: Record<string, unknown> = {};
      form.forEach((value, key) => {
        if (typeof value === "string") body[key] = value;
      });
      return { ...fromQuery, ...body };
    }
  } catch {
    /* empty body */
  }
  return fromQuery;
}

export async function coffeeCheckoutResponse(
  request: Request,
  env: CoffeeEnv = {},
  fetchImpl: typeof fetch = fetch
): Promise<Response> {
  if (request.method === "HEAD") {
    return new Response(null, {
      status: 204,
      headers: CHECKOUT_REDIRECT_HEADERS,
    });
  }
  if (request.method === "GET") {
    return new Response(
      JSON.stringify({
        ok: true,
        methods: ["POST"],
        path: COFFEE_CHECKOUT_PATH,
        page: COFFEE_CANONICAL,
        payment_link: coffeePaymentLinkUrl(env),
        note: "GET never creates a Stripe session. POST creates one or falls back to the Payment Link.",
      }),
      { status: 200, headers: JSON_HEADERS }
    );
  }
  if (request.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...JSON_HEADERS, Allow: "GET, HEAD, POST" },
    });
  }

  const fields = await readCoffeeCheckoutFields(request);
  const json = wantsCoffeeJson(request);
  const result = await createCoffeeCheckoutSession({
    request,
    stripeSecretKey: env.STRIPE_SECRET_KEY,
    paymentLinkUrl: coffeePaymentLinkUrl(env),
    units: fields.units,
    customUsd: fields.customUsd,
    customCents: fields.customCents ?? fields.amount_cents,
    handle: fields.handle,
    message: fields.message,
    fetchImpl,
  });
  if (!result.ok) {
    return new Response(JSON.stringify({ error: result.error }), {
      status: 400,
      headers: JSON_HEADERS,
    });
  }
  if (json) {
    return new Response(JSON.stringify({ url: result.url, via: result.via }), {
      status: 200,
      headers: JSON_HEADERS,
    });
  }
  return new Response(null, {
    status: 303,
    headers: {
      Location: result.url,
      ...CHECKOUT_REDIRECT_HEADERS,
    },
  });
}

export async function buildSampleCoffeeReceipt(now = new Date()): Promise<{
  sampleOnly: true;
  signer: {
    kind: "bundled_sample_ed25519";
    kid: string;
    note: string;
  };
  record: ProofOfCoffeeRecord;
  jws: string;
  jwks: { keys: CoffeeJwk[] };
}> {
  const minted = await mintProofOfCoffeeReceipt({
    rail: "fiat",
    paymentStatus: "paid",
    amountCents: 500,
    handle: "sample",
    message: "SAMPLE receipt only",
    paymentReference: "cs_test_sample_not_a_live_session",
    issuedAt: now.toISOString(),
    receiptId: "poc_sample_demo",
    privateJwk: SAMPLE_COFFEE_PRIVATE_JWK,
  });
  return {
    sampleOnly: true,
    signer: {
      kind: "bundled_sample_ed25519",
      kid: SAMPLE_COFFEE_KID,
      note: "Signed by the bundled demonstration Ed25519 key. The live AuthiChain passport issuer keys were not used. Do not add this key to /.well-known/jwks.json.",
    },
    record: minted.record,
    jws: minted.jws,
    jwks: minted.jwks,
  };
}
