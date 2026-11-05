/**
 * Opt-in A2A language translation, metering, and x402 v2 authorization seam.
 * Offline/test-only until an operator independently approves every adapter.
 * This module does not translate, verify a payment, charge a wallet, or deploy.
 */
export const TRANSLATION_PRICE_VERSION = "translation-usdc-v1-proposal";
export const BASE_CAIP2 = "eip155:8453";
export const BASE_USDC_ASSET = "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913";
export const PRICE_PER_1000_CODEPOINTS = 10000; // 0.01 USDC, 6 decimals
export const MAX_CODEPOINTS = 10000;
export const QUOTE_TTL_MS = 300000;
export const APPROVED_MICROSERVICE_PAY_TO = "0x5db511706FB6317cd23A7655F67450c5AC6e6AA2";
export const APPROVED_A2A_ORIGIN = "https://authichain.com";

export class TranslationRefusal extends Error {
  constructor(code) {
    super(code);
    this.name = "TranslationRefusal";
    this.code = code;
  }
}
const fail = code => { throw new TranslationRefusal(code); };
const isObject = x => x !== null && typeof x === "object" && !Array.isArray(x);

export function canonicalLanguage(tag) {
  if (typeof tag !== "string" || tag.length < 2 || tag.length > 35) fail("invalid_language");
  if (!/^[A-Za-z0-9-]+$/.test(tag) || /(?:^|-)x(?:-|$)/i.test(tag)) fail("invalid_language");
  let canonical;
  try {
    canonical = Intl.getCanonicalLocales(tag)[0];
  } catch {
    fail("invalid_language");
  }
  if (!canonical || canonical.toLowerCase() === "und") fail("invalid_language");
  return canonical;
}

export function normalizeTranslationRequest(raw) {
  if (!isObject(raw)) fail("invalid_request");
  if (raw.consentToMachineTranslation !== true) fail("consent_required");
  if (typeof raw.text !== "string" || !raw.text.trim()) fail("empty_text");
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/u.test(raw.text)) fail("invalid_text");
  const codepoints = [...raw.text].length;
  if (codepoints > MAX_CODEPOINTS) fail("too_many_characters");
  const sourceLanguage = canonicalLanguage(raw.sourceLanguage);
  const targetLanguage = canonicalLanguage(raw.targetLanguage);
  if (sourceLanguage.toLowerCase() === targetLanguage.toLowerCase()) fail("no_translation_needed");
  if (typeof raw.idempotencyKey !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$/.test(raw.idempotencyKey)) fail("invalid_idempotency_key");
  if (typeof raw.maxAmountAtomic !== "string" ||
      !/^[1-9][0-9]{0,14}$/.test(raw.maxAmountAtomic)) fail("budget_required");
  const amountAtomic = String(Math.ceil(codepoints / 1000) * PRICE_PER_1000_CODEPOINTS);
  if (BigInt(amountAtomic) > BigInt(raw.maxAmountAtomic)) fail("budget_exceeded");
  return {
    text: raw.text,
    codepoints,
    sourceLanguage,
    targetLanguage,
    idempotencyKey: raw.idempotencyKey,
    maxAmountAtomic: raw.maxAmountAtomic,
    amountAtomic,
  };
}

export async function sha256Hex(value) {
  const data = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest("SHA-256", data);
  return [...new Uint8Array(hash)].map(n => n.toString(16).padStart(2, "0")).join("");
}

async function requestDigest(request) {
  return sha256Hex(JSON.stringify([
    TRANSLATION_PRICE_VERSION,
    request.idempotencyKey,
    request.sourceLanguage,
    request.targetLanguage,
    request.text,
  ]));
}

export async function createTranslationQuote(raw, nowMs = Date.now()) {
  const r = normalizeTranslationRequest(raw);
  if (!Number.isFinite(nowMs) || nowMs < 0) fail("invalid_clock");
  return Object.freeze({
    quoteId: crypto.randomUUID(),
    requestDigest: await requestDigest(r),
    idempotencyKey: r.idempotencyKey,
    sourceLanguage: r.sourceLanguage,
    targetLanguage: r.targetLanguage,
    characters: r.codepoints,
    amountAtomic: r.amountAtomic,
    currency: "USDC",
    asset: BASE_USDC_ASSET,
    network: BASE_CAIP2,
    priceVersion: TRANSLATION_PRICE_VERSION,
    createdAtMs: nowMs,
    expiresAtMs: nowMs + QUOTE_TTL_MS,
    state: "quoted_not_paid",
  });
}

function isReady(config) {
  return isObject(config) &&
    config.humanApproved === true &&
    config.translatorBound === true &&
    config.facilitatorBound === true &&
    config.durableStoreBound === true;
}

/** x402 v2 challenge *object*, for an operator-authorized adapter to encode. */
export function buildTranslationPaymentRequired(quote, config, nowMs = Date.now()) {
  if (!isReady(config)) fail("service_not_bound");
  if (!isObject(quote) || quote.priceVersion !== TRANSLATION_PRICE_VERSION ||
      nowMs >= quote.expiresAtMs || quote.network !== BASE_CAIP2 ||
      quote.asset !== BASE_USDC_ASSET) fail("invalid_or_expired_quote");
  if (typeof config.payTo !== "string" ||
      config.payTo.toLowerCase() !== APPROVED_MICROSERVICE_PAY_TO.toLowerCase()) fail("invalid_payee");
  if (config.resourceUrl !== APPROVED_A2A_ORIGIN + "/api/a2a/translate") fail("invalid_resource");
  return {
    x402Version: 2,
    resource: {
      url: config.resourceUrl,
      description: "One consented, non-authoritative machine translation",
      mimeType: "application/json",
    },
    accepts: [{
      scheme: "exact",
      network: BASE_CAIP2,
      amount: quote.amountAtomic,
      asset: BASE_USDC_ASSET,
      payTo: config.payTo,
      maxTimeoutSeconds: 60,
      extra: { name: "USDC", version: "2" },
    }],
    extensions: {
      "authichain-translation-v1": {
        quoteId: quote.quoteId,
        requestDigest: quote.requestDigest,
        priceVersion: quote.priceVersion,
      },
    },
  };
}

/**
 * Durable ports are mandatory. store.claim MUST be atomic and permanently
 * single-use per quoteId. After a settlement attempt begins, no automatic
 * release/retry is safe; a reconciliation operator owns uncertain outcomes.
 */
export async function deliverPaidTranslation({ quoteId, request, paymentSignature, ports, nowMs = Date.now() }) {
  if (!isReady(ports?.policy) ||
      !ports?.store?.getQuote || !ports?.store?.claim ||
      !ports?.store?.complete || !ports?.store?.hold ||
      !ports?.payment?.verify || !ports?.payment?.settle ||
      !ports?.translator?.translate || !ports?.translator?.check) fail("service_not_bound");
  const r = normalizeTranslationRequest(request);
  if (typeof paymentSignature !== "string" || paymentSignature.length < 16) fail("payment_signature_required");
  const quote = await ports.store.getQuote(quoteId);
  if (!quote || quote.state !== "quoted_not_paid" ||
      quote.priceVersion !== TRANSLATION_PRICE_VERSION ||
      quote.expiresAtMs <= nowMs || quote.network !== BASE_CAIP2 ||
      quote.asset !== BASE_USDC_ASSET ||
      quote.idempotencyKey !== r.idempotencyKey ||
      quote.sourceLanguage !== r.sourceLanguage ||
      quote.targetLanguage !== r.targetLanguage ||
      quote.characters !== r.codepoints ||
      quote.amountAtomic !== r.amountAtomic ||
      quote.requestDigest !== await requestDigest(r)) fail("quote_mismatch_or_expired");

  // First VERIFY (no charge). Unverified requests must not burn/lock a quote.
  // A trusted v2 facilitator must verify the signature, payer, nonce and spend cap.
  const auth = await ports.payment.verify({ quote, paymentSignature });
  if (!auth || auth.authorized !== true ||
      auth.amountAtomic !== quote.amountAtomic ||
      auth.network !== quote.network || !auth.authorizationId ||
      auth.asset?.toLowerCase() !== BASE_USDC_ASSET.toLowerCase() ||
      auth.payTo?.toLowerCase() !== APPROVED_MICROSERVICE_PAY_TO.toLowerCase() ||
      auth.requestDigest !== quote.requestDigest) fail("payment_not_authorized");
  // Only a validated authorization may atomically claim the single-use quote.
  const claimed = await ports.store.claim(quoteId, quote.requestDigest);
  if (claimed !== "claimed") fail("already_claimed_or_conflict");
  let settlementAttempted = false;
  try {
    const translated = await ports.translator.translate({
      text: r.text, sourceLanguage: r.sourceLanguage, targetLanguage: r.targetLanguage,
    });
    if (typeof translated !== "string" || !translated.trim() ||
        [...translated].length > MAX_CODEPOINTS * 3 ||
        !(await ports.translator.check({ source: r.text, output: translated,
          sourceLanguage: r.sourceLanguage, targetLanguage: r.targetLanguage }))) {
      fail("translation_not_validated");
    }

    const outputDigest = await sha256Hex(translated);
    settlementAttempted = true;
    const settled = await ports.payment.settle({ quote, auth, outputDigest });
    if (!settled || settled.settled !== true ||
        settled.network !== quote.network ||
        settled.amountAtomic !== quote.amountAtomic ||
        settled.asset?.toLowerCase() !== BASE_USDC_ASSET.toLowerCase() ||
        settled.payTo?.toLowerCase() !== APPROVED_MICROSERVICE_PAY_TO.toLowerCase() ||
        typeof settled.transaction !== "string" || !settled.transaction) fail("settlement_not_confirmed");
    const receipt = {
      quoteId, requestDigest: quote.requestDigest, outputDigest,
      amountAtomic: quote.amountAtomic, currency: "USDC", network: quote.network,
      transaction: settled.transaction, priceVersion: quote.priceVersion,
      sourceLanguage: r.sourceLanguage, targetLanguage: r.targetLanguage,
      machineTranslation: true, semanticFidelityNotIndependentlyGuaranteed: true,
    };
    // Persist an immutable successful result BEFORE revealing paid content.
    // If persistence fails, hold for reconciliation; do not auto-settle again.
    await ports.store.complete(quoteId, { receipt, translated });
    return { status: "delivered", translation: translated, receipt };
  } catch (err) {
    await ports.store.hold(quoteId, settlementAttempted ? "reconcile_settlement" : "failed_before_settlement");
    throw err;
  }
}
