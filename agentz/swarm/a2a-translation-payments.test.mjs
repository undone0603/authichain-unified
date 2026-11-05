import assert from "node:assert/strict";
import { test } from "node:test";
import {
  canonicalLanguage, createTranslationQuote, buildTranslationPaymentRequired,
  deliverPaidTranslation,
} from "./a2a-translation-payments.mjs";
const req = {
  text: "Hello world", sourceLanguage: "en", targetLanguage: "es",
  idempotencyKey: "lang-quote-example-2026",
  consentToMachineTranslation: true, maxAmountAtomic: "50000",
};
const t = 1793894400000;
const rejection = code => error => error?.code === code;
const policy = {
  humanApproved: true, translatorBound: true, facilitatorBound: true, durableStoreBound: true,
  payTo: "0x5db511706FB6317cd23A7655F67450c5AC6e6AA2",
  resourceUrl: "https://authichain.com/api/a2a/translate",
};

test("language tags are canonical and source/target always explicit", () => {
  assert.equal(canonicalLanguage("zh-hans-cn"), "zh-Hans-CN");
  assert.equal(canonicalLanguage("pt-br"), "pt-BR");
  assert.equal(canonicalLanguage("ar"), "ar");
  assert.throws(() => canonicalLanguage("en-x-private"), rejection("invalid_language"));
});

test("translation quote is one USDC cent per 1000 code points", async () => {
  const q = await createTranslationQuote(req, t);
  assert.equal(q.amountAtomic, "10000");
  assert.equal(q.characters, 11);
  assert.equal(q.state, "quoted_not_paid");
  assert.ok(!JSON.stringify(q).includes("Hello world"));
});

test("emoji counts once, 1001 code points billed in second block", async () => {
  const q = await createTranslationQuote({ ...req, text: "a".repeat(1000) + "🧪" }, t);
  assert.equal(q.characters, 1001);
  assert.equal(q.amountAtomic, "20000");
});

test("rejects too-long text, no consent and same language", async () => {
  await assert.rejects(createTranslationQuote({ ...req, text: "x".repeat(10001) }, t), rejection("too_many_characters"));
  await assert.rejects(createTranslationQuote({ ...req, consentToMachineTranslation: false }, t), rejection("consent_required"));
  await assert.rejects(createTranslationQuote({ ...req, targetLanguage: "EN" }, t), rejection("no_translation_needed"));
});

test("prevents absent budget, low budget, invalid text and idempotency", async () => {
  await assert.rejects(createTranslationQuote({ ...req, maxAmountAtomic: undefined }, t), rejection("budget_required"));
  await assert.rejects(createTranslationQuote({ ...req, maxAmountAtomic: "9999" }, t), rejection("budget_exceeded"));
  await assert.rejects(createTranslationQuote({ ...req, text: "a\0b" }, t), rejection("invalid_text"));
  await assert.rejects(createTranslationQuote({ ...req, idempotencyKey: "../" }, t), rejection("invalid_idempotency_key"));
});

test("payment challenge only after all operational and human gates", async () => {
  const q = await createTranslationQuote(req, t);
  assert.throws(() => buildTranslationPaymentRequired(q, {}), rejection("service_not_bound"));
  const result = buildTranslationPaymentRequired(q, policy, t + 1000);
  assert.equal(result.x402Version, 2);
  assert.equal(result.accepts[0].amount, "10000");
  assert.equal(result.accepts[0].network, "eip155:8453");
  assert.throws(() => buildTranslationPaymentRequired(q, policy, t + 300000), rejection("invalid_or_expired_quote"));
  assert.throws(() => buildTranslationPaymentRequired(q, { ...policy, payTo: "fake" }, t), rejection("invalid_payee"));
  assert.throws(() => buildTranslationPaymentRequired(q, { ...policy, payTo: "0x0000000000000000000000000000000000000001" }, t), rejection("invalid_payee"));
  assert.throws(() => buildTranslationPaymentRequired(q, { ...policy, resourceUrl: "https://attacker.example/api/a2a/translate" }, t), rejection("invalid_resource"));
});

const fake = (q, override = {}) => {
  const calls = [];
  const ports = {
    policy,
    store: {
      getQuote: async () => q,
      claim: async () => { calls.push("claim"); return "claimed"; },
      complete: async () => { calls.push("complete"); },
      hold: async (_, reason) => { calls.push("hold:" + reason); },
      ...override.store,
    },
    payment: {
      verify: async ({ quote }) => { calls.push("verify"); return { authorized: true, amountAtomic: quote.amountAtomic, network: quote.network, asset: quote.asset, payTo: policy.payTo, requestDigest: quote.requestDigest, authorizationId: "mock" }; },
      settle: async ({ quote }) => { calls.push("settle"); return { settled: true, amountAtomic: quote.amountAtomic, network: quote.network, asset: quote.asset, payTo: policy.payTo, transaction: "0xmock" }; },
      ...override.payment,
    },
    translator: {
      translate: async () => { calls.push("translate"); return "Hola mundo"; },
      check: async () => { calls.push("quality"); return true; },
      ...override.translator,
    },
  };
  return { ports, calls };
};
const execute = (quote, ports, options = {}) => deliverPaidTranslation({
  quoteId: quote.quoteId, request: req,
  paymentSignature: "test-signature-not-a-real-payment",
  nowMs: t + 1000, ports, ...options,
});

test("mock authorized translation settles exactly once and persists before response", async () => {
  const q = await createTranslationQuote(req, t);
  const { ports, calls } = fake(q);
  const response = await execute(q, ports);
  assert.equal(response.translation, "Hola mundo");
  assert.equal(response.receipt.semanticFidelityNotIndependentlyGuaranteed, true);
  assert.deepEqual(calls, ["verify", "claim", "translate", "quality", "settle", "complete"]);
});

test("missing service or signature never incurs a charge", async () => {
  const q = await createTranslationQuote(req, t);
  await assert.rejects(execute(q, {}), rejection("service_not_bound"));
  const { ports, calls } = fake(q);
  await assert.rejects(execute(q, ports, { paymentSignature: "" }), rejection("payment_signature_required"));
  assert.deepEqual(calls, []);
});

test("tampered text, unpaid amount, expired quote never reach wallet", async () => {
  const q = await createTranslationQuote(req, t);
  const { ports, calls } = fake({ ...q, amountAtomic: "0" });
  await assert.rejects(execute(q, ports), rejection("quote_mismatch_or_expired"));
  const good = fake(q);
  await assert.rejects(execute(q, good.ports, { request: { ...req, text: "changed" } }), rejection("quote_mismatch_or_expired"));
  await assert.rejects(execute(q, good.ports, { nowMs: t + 300000 }), rejection("quote_mismatch_or_expired"));
  assert.deepEqual(calls, []);
});

test("duplicate claims, bad authorization and quality rejection refuse settlement", async () => {
  const q = await createTranslationQuote(req, t);
  const dup = fake(q, { store: { claim: async () => "already_claimed" } });
  await assert.rejects(execute(q, dup.ports), rejection("already_claimed_or_conflict"));
  const bad = fake(q, { payment: { verify: async () => ({ authorized: true, amountAtomic: "1" }) } });
  await assert.rejects(execute(q, bad.ports), rejection("payment_not_authorized"));
  assert.ok(!bad.calls.includes("settle"));
  const quality = fake(q, { translator: { check: async () => false } });
  await assert.rejects(execute(q, quality.ports), rejection("translation_not_validated"));
  assert.ok(!quality.calls.includes("settle"));
});

test("uncertain settlement holds for reconciliation, never exposes translation", async () => {
  const q = await createTranslationQuote(req, t);
  const { ports, calls } = fake(q, { payment: { settle: async () => { calls.push("timeout"); throw Error("offline"); } } });
  await assert.rejects(execute(q, ports), /offline/);
  assert.ok(calls.includes("hold:reconcile_settlement"));
  assert.ok(!calls.includes("complete"));
});
