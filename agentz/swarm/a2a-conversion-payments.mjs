/**
 * Source-backed, indicative FX/crypto conversion as an A2A x402 microservice.
 * No foreign-exchange order, blockchain swap, custody, transfer or live charge.
 * Uses operator-provided rate data and settlement adapters; all remain unbound.
 */
import {
  BASE_CAIP2, BASE_USDC_ASSET, TranslationRefusal, sha256Hex,
} from "./a2a-translation-payments.mjs";

export const CONVERSION_PRICE_VERSION = "conversion-usdc-v1-proposal";
export const FX_FEE_ATOMIC = "5000"; // proposed $0.005 USDC / enriched quote
export const CRYPTO_FEE_ATOMIC = "10000"; // proposed $0.01 USDC / enriched quote
export const QUOTE_TTL_MS = 60000;
export const CRYPTO_RATE_MAX_AGE_MS = 120000;
export const FX_RATE_MAX_AGE_MS = 345600000; // handles weekend reference-rate gaps

const FIAT = new Set(("USD EUR GBP JPY CAD AUD CHF CNY INR BRL MXN NGN ZAR AED SGD HKD NZD KRW SEK NOK DKK PLN TRY TWD PHP IDR THB VND PKR BDT EGP KES GHS ARS COP CLP PEN SAR ILS UAH MYR CZK HUF RON").split(" "));
const CRYPTO = new Set(("bitcoin ethereum solana usd-coin tether ripple binancecoin cardano dogecoin litecoin polkadot avalanche-2 chainlink").split(" "));
const fail = code => { throw new TranslationRefusal(code); };
const isRecord = x => x !== null && typeof x === "object" && !Array.isArray(x);

export function canonicalConversionAsset(s) {
  if (typeof s !== "string") fail("invalid_asset");
  const fiat = /^(?:fiat:)?([A-Z]{3})$/.exec(s);
  if (fiat && FIAT.has(fiat[1])) return "fiat:" + fiat[1];
  const crypto = /^crypto:([a-z][a-z0-9-]{1,48})$/.exec(s);
  if (crypto && CRYPTO.has(crypto[1])) return "crypto:" + crypto[1];
  fail("unsupported_asset");
}

function decimal(s, kind) {
  if (typeof s !== "string" ||
      !/^(?:0|[1-9][0-9]{0,14})(?:\.[0-9]{1,18})?$/.test(s)) fail("invalid_" + kind);
  const [whole, fraction = ""] = s.split(".");
  const den = 10n ** BigInt(fraction.length);
  const num = BigInt(whole) * den + BigInt(fraction || "0");
  if (num <= 0n) fail("invalid_" + kind);
  return { num, den };
}

function formatProduct(amount, rate, places) {
  const n = amount.num * rate.num;
  const d = amount.den * rate.den;
  const p = 10n ** BigInt(places);
  const rounded = (n * p + d / 2n) / d;
  if (rounded === 0n) fail("converted_value_below_precision");
  const a = (rounded / p).toString();
  const b = (rounded % p).toString().padStart(places, "0").replace(/0+$/, "");
  return b ? a + "." + b : a;
}

export function normalizeConversionRequest(raw) {
  if (!isRecord(raw)) fail("invalid_request");
  if (raw.consentToPaidQuote !== true) fail("consent_required");
  const fromAsset = canonicalConversionAsset(raw.fromAsset);
  const toAsset = canonicalConversionAsset(raw.toAsset);
  if (fromAsset === toAsset) fail("same_asset");
  decimal(raw.amount, "amount");
  if (typeof raw.idempotencyKey !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9:_-]{7,127}$/.test(raw.idempotencyKey)) fail("invalid_idempotency_key");
  const feeAtomic = fromAsset.startsWith("crypto:") || toAsset.startsWith("crypto:")
    ? CRYPTO_FEE_ATOMIC : FX_FEE_ATOMIC;
  if (typeof raw.maxFeeAtomic !== "string" ||
      !/^[1-9][0-9]{0,14}$/.test(raw.maxFeeAtomic)) fail("budget_required");
  if (BigInt(raw.maxFeeAtomic) < BigInt(feeAtomic)) fail("budget_exceeded");
  return { fromAsset, toAsset, amount: raw.amount,
    idempotencyKey: raw.idempotencyKey, feeAtomic };
}

async function digestForRequest(r) {
  return sha256Hex(JSON.stringify([
    CONVERSION_PRICE_VERSION, r.idempotencyKey, r.fromAsset, r.toAsset, r.amount, r.feeAtomic,
  ]));
}

export async function createConversionQuote(raw, oracle, nowMs = Date.now()) {
  const r = normalizeConversionRequest(raw);
  if (typeof oracle?.getRate !== "function") fail("oracle_not_bound");
  if (!Number.isSafeInteger(nowMs) || nowMs < 0) fail("invalid_clock");
  const observed = await oracle.getRate({ fromAsset: r.fromAsset, toAsset: r.toAsset });
  if (!isRecord(observed) || typeof observed.provider !== "string" ||
      !/^[\w .-]{3,80}$/.test(observed.provider) ||
      typeof observed.sourceUrl !== "string" ||
      !/^https:\/\/[A-Za-z0-9.-]+(?:\/[^\s]*)?$/.test(observed.sourceUrl)) fail("unverified_rate_source");
  if (!Number.isSafeInteger(observed.asOfMs) ||
      observed.asOfMs > nowMs + 5000 || observed.asOfMs < 0) fail("invalid_rate_timestamp");
  const hasCrypto = r.fromAsset.startsWith("crypto:") || r.toAsset.startsWith("crypto:");
  const allowedAge = hasCrypto ? CRYPTO_RATE_MAX_AGE_MS : FX_RATE_MAX_AGE_MS;
  if (nowMs - observed.asOfMs > allowedAge) fail("stale_rate");
  const computed = formatProduct(decimal(r.amount, "amount"),
    decimal(observed.rate, "rate"), r.toAsset.startsWith("crypto:") ? 12 : 8);
  const quote = {
    quoteId: crypto.randomUUID(),
    requestDigest: await digestForRequest(r),
    idempotencyKey: r.idempotencyKey,
    fromAsset: r.fromAsset, toAsset: r.toAsset, inputAmount: r.amount,
    indicativeOutputAmount: computed,
    rate: observed.rate, rateAsOfMs: observed.asOfMs,
    rateProvider: observed.provider, rateSourceUrl: observed.sourceUrl,
    feeAtomic: r.feeAtomic, currency: "USDC",
    network: BASE_CAIP2, asset: BASE_USDC_ASSET,
    createdAtMs: nowMs, expiresAtMs: nowMs + QUOTE_TTL_MS,
    priceVersion: CONVERSION_PRICE_VERSION,
    indicativeOnly: true, executionOffered: false, state: "quoted_not_paid",
  };
  return Object.freeze({ ...quote, quoteDigest: await sha256Hex(JSON.stringify(quote)) });
}

function serviceReady(policy) {
  return isRecord(policy) && policy.humanApproved === true &&
    policy.oracleBound === true && policy.facilitatorBound === true &&
    policy.durableStoreBound === true;
}

export function buildConversionPaymentRequired(quote, policy, nowMs = Date.now()) {
  if (!serviceReady(policy)) fail("service_not_bound");
  if (!isRecord(quote) || quote.priceVersion !== CONVERSION_PRICE_VERSION ||
      nowMs >= quote.expiresAtMs || quote.network !== BASE_CAIP2 ||
      quote.asset !== BASE_USDC_ASSET) fail("invalid_or_expired_quote");
  if (typeof policy.payTo !== "string" || !/^0x[a-fA-F0-9]{40}$/.test(policy.payTo)) fail("invalid_payee");
  if (typeof policy.resourceUrl !== "string" ||
      !/^https:\/\/[A-Za-z0-9.-]+\/api\/a2a\/convert$/.test(policy.resourceUrl)) fail("invalid_resource");
  return {
    x402Version: 2, error: "PAYMENT-SIGNATURE header required",
    resource: { url: policy.resourceUrl, mimeType: "application/json",
      description: "One source-attributed, non-executable conversion quote" },
    accepts: [{ scheme: "exact", network: BASE_CAIP2, amount: quote.feeAtomic,
      asset: BASE_USDC_ASSET, payTo: policy.payTo, maxTimeoutSeconds: 60,
      extra: { name: "USDC", version: "2" } }],
    extensions: { "authichain-conversion-v1": {
      quoteId: quote.quoteId, quoteDigest: quote.quoteDigest,
      priceVersion: quote.priceVersion,
    } },
  };
}

export async function deliverPaidConversion({
  quoteId, request, paymentSignature, ports, nowMs = Date.now(),
}) {
  if (!serviceReady(ports?.policy) ||
      !ports?.store?.getQuote || !ports?.store?.claim ||
      !ports?.store?.complete || !ports?.store?.hold ||
      !ports?.payment?.verify || !ports?.payment?.settle) fail("service_not_bound");
  const r = normalizeConversionRequest(request);
  if (typeof paymentSignature !== "string" || paymentSignature.length < 16) fail("payment_signature_required");
  const quote = await ports.store.getQuote(quoteId);
  if (!quote || quote.state !== "quoted_not_paid" ||
      quote.priceVersion !== CONVERSION_PRICE_VERSION ||
      quote.expiresAtMs <= nowMs || quote.network !== BASE_CAIP2 ||
      quote.asset !== BASE_USDC_ASSET ||
      quote.idempotencyKey !== r.idempotencyKey ||
      quote.fromAsset !== r.fromAsset || quote.toAsset !== r.toAsset ||
      quote.inputAmount !== r.amount || quote.feeAtomic !== r.feeAtomic ||
      quote.requestDigest !== await digestForRequest(r)) fail("quote_mismatch_or_expired");
  const { quoteDigest, ...body } = quote;
  if (quoteDigest !== await sha256Hex(JSON.stringify(body))) fail("quote_tampered");

  if ((await ports.store.claim(quoteId, quote.requestDigest)) !== "claimed") {
    fail("already_claimed_or_conflict");
  }
  let attempted = false;
  try {
    // The payment port must independently verify the v2 signature, payee,
    // exact resource, chain, fee, nonce and per-payer budget/spending cap.
    const auth = await ports.payment.verify({ quote, paymentSignature });
    if (!auth || auth.authorized !== true || !auth.authorizationId ||
        auth.amountAtomic !== quote.feeAtomic || auth.network !== quote.network) {
      fail("payment_not_authorized");
    }
    // Result and provenance already exist in the immutable quote. No transfer.
    attempted = true;
    const settled = await ports.payment.settle({ quote, auth, outputDigest: quote.quoteDigest });
    if (!settled || settled.settled !== true ||
        settled.amountAtomic !== quote.feeAtomic ||
        settled.network !== quote.network ||
        typeof settled.transaction !== "string" || !settled.transaction) fail("settlement_not_confirmed");
    const receipt = {
      quoteId, quoteDigest: quote.quoteDigest, requestDigest: quote.requestDigest,
      feeAtomic: quote.feeAtomic, currency: "USDC", network: quote.network,
      transaction: settled.transaction, priceVersion: quote.priceVersion,
      indicativeOnly: true, noAssetExchangePerformed: true,
    };
    // Persist settled result before sending output; never blindly retry.
    await ports.store.complete(quoteId, { quote, receipt });
    return { status: "delivered", conversion: quote, receipt };
  } catch (err) {
    await ports.store.hold(quoteId, attempted ? "reconcile_settlement" : "failed_before_settlement");
    throw err;
  }
}
