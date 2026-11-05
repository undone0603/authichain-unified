import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canonicalConversionAsset, normalizeConversionRequest,
  createConversionQuote, buildConversionPaymentRequired,
  deliverPaidConversion, BASE_CAIP2, FX_FEE_ATOMIC, CRYPTO_FEE_ATOMIC,
} from "./a2a-conversion-payments.mjs";

const req = {
  amount: "100.50", fromAsset: "fiat:USD", toAsset: "fiat:EUR",
  idempotencyKey: "fx-quote-example-2026", maxFeeAtomic: "10000",
  consentToPaidQuote: true,
};
const now = 1793894400000;
const oracle = (rate = "0.93", asOfMs = now, provider = "Test Licensed Feed",
  sourceUrl = "https://example.org/rates/fx") =>
  ({ getRate: async () => ({ rate, asOfMs, provider, sourceUrl }) });
const rejection = code => e => e?.code === code;
const policy = { humanApproved: true, oracleBound: true, facilitatorBound: true,
  durableStoreBound: true, payTo: "0x5db511706FB6317cd23A7655F67450c5AC6e6AA2",
  resourceUrl: "https://authichain.com/api/a2a/convert" };

test("supports explicit ISO fiat and canonical crypto asset identifiers", () => {
  assert.equal(canonicalConversionAsset("USD"), "fiat:USD");
  assert.equal(canonicalConversionAsset("fiat:EUR"), "fiat:EUR");
  assert.equal(canonicalConversionAsset("crypto:bitcoin"), "crypto:bitcoin");
  assert.throws(() => canonicalConversionAsset("BTC"), rejection("unsupported_asset"));
  assert.throws(() => canonicalConversionAsset("crypto:not-listed"), rejection("unsupported_asset"));
  assert.throws(() => canonicalConversionAsset("foo:USD"), rejection("unsupported_asset"));
});

test("only opt-in paid quotes, never automatic exchange", async () => {
  await assert.rejects(createConversionQuote({ ...req, consentToPaidQuote: false }, oracle(), now), rejection("consent_required"));
  assert.throws(() => normalizeConversionRequest({ ...req, fromAsset: "USD", toAsset: "fiat:USD" }), rejection("same_asset"));
});

test("accurate decimal multiplication; cents-scale quote fee distinct from principal", async () => {
  const q = await createConversionQuote(req, oracle(), now);
  assert.equal(q.indicativeOutputAmount, "93.465");
  assert.equal(q.feeAtomic, FX_FEE_ATOMIC);
  assert.equal(q.network, BASE_CAIP2);
  assert.equal(q.inputAmount, "100.50");
  assert.equal(q.executionOffered, false);
  assert.equal(q.indicativeOnly, true);
  assert.equal(q.expiresAtMs, now + 60000);
  assert.equal(q.rateSourceUrl, "https://example.org/rates/fx");
});

test("crypto pairs have a separate metered quote fee; no assumption of stablecoin peg", async () => {
  const r = { ...req, amount: "0.5", fromAsset: "crypto:bitcoin",
    toAsset: "fiat:USD", maxFeeAtomic: "20000" };
  const q = await createConversionQuote(r, oracle("63500"), now);
  assert.equal(q.indicativeOutputAmount, "31750");
  assert.equal(q.feeAtomic, CRYPTO_FEE_ATOMIC);
  assert.equal(q.executionOffered, false);
});

test("budget required, max fee strict, value never funds an actual swap", async () => {
  await assert.rejects(createConversionQuote({ ...req, maxFeeAtomic: undefined }, oracle(), now), rejection("budget_required"));
  await assert.rejects(createConversionQuote({ ...req, maxFeeAtomic: "4999" }, oracle(), now), rejection("budget_exceeded"));
  await assert.rejects(createConversionQuote({ ...req, maxFeeAtomic: "1e20" }, oracle(), now), rejection("budget_required"));
  await assert.rejects(createConversionQuote({ ...req, amount: "-100" }, oracle(), now), rejection("invalid_amount"));
});

test("requires a bound oracle and a fresh source-attributed rate", async () => {
  await assert.rejects(createConversionQuote(req, null, now), rejection("oracle_not_bound"));
  await assert.rejects(createConversionQuote(req, oracle("0.9", now, "x", "https://example.org"), now), rejection("unverified_rate_source"));
  await assert.rejects(createConversionQuote(req, oracle("0.9", now, "Test Rate", "http://example.org"), now), rejection("unverified_rate_source"));
  await assert.rejects(createConversionQuote(req, oracle("0.9", now + 12000), now), rejection("invalid_rate_timestamp"));
});

test("rejects old FX (>4 days) and crypto (>2 min) rates", async () => {
  await assert.rejects(createConversionQuote(req, oracle("0.93", now - 345600001), now), rejection("stale_rate"));
  const crypto = { ...req, fromAsset: "crypto:ethereum", maxFeeAtomic: "20000" };
  await assert.rejects(createConversionQuote(crypto, oracle("4000", now - 120001), now), rejection("stale_rate"));
});

test("rates and output amounts cannot be fabricated by invalid oracle values", async () => {
  for (const rate of ["0", "-1", "NaN", "Infinity", "1e9", "1.2.3"]) {
    await assert.rejects(createConversionQuote(req, oracle(rate), now), rejection("invalid_rate"));
  }
  await assert.rejects(createConversionQuote(req, oracle("0.000000000000000001"), now), rejection("converted_value_below_precision"));
});

test("valid x402 v2 challenge is a proposal, not a live 402 endpoint", async () => {
  const q = await createConversionQuote(req, oracle(), now);
  assert.throws(() => buildConversionPaymentRequired(q, {}, now), rejection("service_not_bound"));
  const h = buildConversionPaymentRequired(q, policy, now);
  assert.equal(h.x402Version, 2);
  assert.equal(h.accepts[0].amount, FX_FEE_ATOMIC);
  assert.equal(h.accepts[0].network, BASE_CAIP2);
  assert.equal(h.extensions["authichain-conversion-v1"].quoteDigest, q.quoteDigest);
  assert.ok(!JSON.stringify(h).includes(req.amount));
  assert.throws(() => buildConversionPaymentRequired(q, policy, now + 60000), rejection("invalid_or_expired_quote"));
  assert.throws(() => buildConversionPaymentRequired(q, { ...policy, payTo: "wrong" }, now), rejection("invalid_payee"));
  assert.throws(() => buildConversionPaymentRequired(q, { ...policy, payTo: "0x0000000000000000000000000000000000000001" }, now), rejection("invalid_payee"));
  assert.throws(() => buildConversionPaymentRequired(q, { ...policy, resourceUrl: "https://attacker.example/api/a2a/convert" }, now), rejection("invalid_resource"));
});

function fakePorts(q, opts = {}) {
  const calls = [];
  const store = {
    getQuote: async () => q,
    claim: async () => { calls.push("claim"); return "claimed"; },
    complete: async () => { calls.push("complete"); },
    hold: async (_, reason) => { calls.push("hold:" + reason); },
    ...opts.store,
  };
  const payment = {
    verify: async ({ quote }) => { calls.push("verify"); return { authorized: true, authorizationId: "mock-auth", amountAtomic: quote.feeAtomic, network: quote.network, asset: quote.asset, payTo: policy.payTo, quoteDigest: quote.quoteDigest }; },
    settle: async ({ quote }) => { calls.push("settle"); return { settled: true, amountAtomic: quote.feeAtomic, network: quote.network, asset: quote.asset, payTo: policy.payTo, transaction: "0xmock" }; },
    ...opts.payment,
  };
  return { calls, ports: { policy, store, payment } };
}
const execute = (q, ports, overrides = {}) => deliverPaidConversion({
  quoteId: q.quoteId, request: req, paymentSignature: "test-v2-signature-not-live", ports,
  nowMs: now + 1000, ...overrides,
});

test("mock verified delivery settles once and persists before release", async () => {
  const q = await createConversionQuote(req, oracle(), now);
  const { calls, ports } = fakePorts(q);
  const result = await execute(q, ports);
  assert.equal(result.conversion.indicativeOutputAmount, "93.465");
  assert.equal(result.receipt.noAssetExchangePerformed, true);
  assert.deepEqual(calls, ["verify", "claim", "settle", "complete"]);
});

test("missing services, duplicate claim and malformed payment refuse before settlement", async () => {
  const q = await createConversionQuote(req, oracle(), now);
  await assert.rejects(execute(q, {}), rejection("service_not_bound"));
  const { calls, ports } = fakePorts(q);
  await assert.rejects(execute(q, ports, { paymentSignature: "" }), rejection("payment_signature_required"));
  assert.deepEqual(calls, []);
  const dup = fakePorts(q, { store: { claim: async () => "already_claimed" } });
  await assert.rejects(execute(q, dup.ports), rejection("already_claimed_or_conflict"));
  assert.deepEqual(dup.calls, ["verify"]);
});

test("tampered quote, mismatched request and expired quote never settle", async () => {
  const q = await createConversionQuote(req, oracle(), now);
  const { calls, ports } = fakePorts({ ...q, indicativeOutputAmount: "1000000" });
  await assert.rejects(execute(q, ports), rejection("quote_tampered"));
  assert.deepEqual(calls, []);
  const clean = fakePorts(q);
  await assert.rejects(execute(q, clean.ports, { request: { ...req, amount: "102" } }), rejection("quote_mismatch_or_expired"));
  await assert.rejects(execute(q, clean.ports, { nowMs: now + 60000 }), rejection("quote_mismatch_or_expired"));
  assert.deepEqual(clean.calls, []);
});

test("bad payment proof never reaches settlement", async () => {
  const q = await createConversionQuote(req, oracle(), now);
  const { ports, calls } = fakePorts(q, { payment: { verify: async () => { calls.push("bad"); return {authorized: true, amountAtomic: "1", network: BASE_CAIP2 }; } } });
  await assert.rejects(execute(q, ports), rejection("payment_not_authorized"));
  assert.deepEqual(calls, ["bad"]);
});

test("settlement timeout remains held for manual reconciliation", async () => {
  const q = await createConversionQuote(req, oracle(), now);
  const { ports, calls } = fakePorts(q, { payment: { settle: async () => { calls.push("timeout"); throw Error("network timeout"); } } });
  await assert.rejects(execute(q, ports), /network timeout/);
  assert.deepEqual(calls, ["verify", "claim", "timeout", "hold:reconcile_settlement"]);
});

test("failed receipt persistence holds for reconciliation and never retries", async () => {
  const q = await createConversionQuote(req, oracle(), now);
  const { ports, calls } = fakePorts(q, { store: { complete: async () => { calls.push("complete-failed"); throw Error("database"); } } });
  await assert.rejects(execute(q, ports), /database/);
  assert.deepEqual(calls, ["verify", "claim", "settle", "complete-failed", "hold:reconcile_settlement"]);
});
