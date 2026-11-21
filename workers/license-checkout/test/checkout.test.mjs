import test from "node:test";
import assert from "node:assert/strict";
import { createHmac, createHash } from "node:crypto";
import { createWorker, LOOKUPS } from "../src/index.ts";
import { startCheckout } from "../src/start-checkout.ts";
import { bindSecrets } from "../scripts/bind-secrets.mjs";

const claim = "a".repeat(43);
const hash = createHash("sha256").update(claim).digest("hex");
const now = 1_793_448_000_000;
const asResponse = (body, status = 200) => Response.json(body, { status });
function fixture() {
  const prices = Object.entries(LOOKUPS).map(([name, lookup_key]) => ({
    id: name === "STRIPE_PRICE_OEM_SETUP" ? "price_Setup" : name === "STRIPE_PRICE_OEM_MONTHLY" ? "price_Monthly" : "price_Pack",
    lookup_key, active: true, currency: "usd", livemode: false,
    unit_amount: name === "STRIPE_PRICE_OEM_SETUP" ? 750000 : 150000,
    recurring: name === "STRIPE_PRICE_OEM_MONTHLY" ? { interval: "month", interval_count: 1 } : null,
  }));
  const env = {
    STRIPE_SECRET_KEY: "sk_test_fixture_only", STRIPE_WEBHOOK_SECRET: "whsec_fixture_only",
    STRIPE_PRICE_OEM_SETUP: "price_Setup", STRIPE_PRICE_OEM_MONTHLY: "price_Monthly", STRIPE_PRICE_PACK: "price_Pack",
    STRIPE_MODE: "test", CHECKOUT_ENABLED: "true", PUBLIC_ORIGIN: "https://license.test", ALLOWED_ORIGINS: "https://authichain.com",
  };
  const calls = []; const backendCalls = [];
  const controls = { ready: true, fulfilled: true, delivery: "ready", sessionUrl: "https://checkout.stripe.com/c/pay/test_fixture" };
  const session = { id: "cs_test_fixture", object: "checkout.session", livemode: false, mode: "subscription", payment_status: "paid", status: "complete", currency: "usd", amount_subtotal: 900000, amount_total: 900000, customer: "cus_fixture", subscription: "sub_fixture", metadata: { sku: "OEM-VERIFY", product_line: "oem_workflow_v1", claim_hash: hash } };
  const items = [{ quantity: 1, price: { id: "price_Setup" } }, { quantity: 1, price: { id: "price_Monthly" } }];
  env.LICENSE_FULFILLMENT = { async fetch(request) {
    const path = new URL(request.url).pathname;
    const body = request.method === "POST" ? await request.json() : null;
    backendCalls.push({ path, body });
    if (path === "/ready") return asResponse({ skus: { "OEM-VERIFY": { ready: controls.ready, api_access: true, subscription_lifecycle: true }, "PACK-WORKFLOW": { ready: controls.ready, download_ready: true, version: "fixture-v1" } } });
    if (path === "/fulfill") return asResponse({ fulfilled: controls.fulfilled, license_id: "lic_fixture" });
    return asResponse({ status: controls.delivery, api_key: "test_delivery_only" });
  } };
  const worker = createWorker({ now: () => now, fetch: async (input, init) => {
    const url = new URL(input); assert.equal(url.origin, "https://api.stripe.com");
    calls.push({ path: url.pathname, method: init.method, body: init.body, key: init.headers["Idempotency-Key"] });
    if (init.method === "POST") return asResponse({ id: "cs_test_fixture", url: controls.sessionUrl });
    if (url.pathname.includes("/prices/")) return asResponse(prices.find(price => url.pathname.endsWith(price.id)));
    if (url.pathname.endsWith("/line_items")) return asResponse({ has_more: false, data: items });
    return asResponse(session);
  } });
  const req = (path, body, origin) => worker.fetch(new Request(`https://license.test${path}`, { method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json", ...(origin ? { Origin: origin } : {}) } }), env);
  const webhook = async (patch = {}, eventPatch = {}) => {
    Object.assign(session, patch);
    const event = { id: "evt_fixture", type: "checkout.session.completed", livemode: false, data: { object: { id: session.id } }, ...eventPatch };
    const body = JSON.stringify(event); const t = now / 1000;
    return worker.fetch(new Request("https://license.test/webhook", { method: "POST", body, headers: { "stripe-signature": `t=${t},v1=${createHmac("sha256", env.STRIPE_WEBHOOK_SECRET).update(`${t}.${body}`).digest("hex")}` } }), env);
  };
  return { env, prices, session, items, calls, backendCalls, controls, worker, req, webhook };
}

test("OEM checkout includes setup and monthly prices and discloses $9000 initially", async () => {
  const f = fixture(); const r = await f.req("/checkout", { sku: "OEM-VERIFY", claim }, "https://authichain.com");
  assert.equal(r.status, 200); const data = await r.json(); assert.equal(data.initial_amount_usd, 9000); assert.equal(data.monthly_amount_usd, 1500);
  const params = new URLSearchParams(f.calls.find(call => call.method === "POST").body);
  assert.equal(params.get("mode"), "subscription"); assert.equal(params.get("line_items[0][price]"), "price_Setup"); assert.equal(params.get("line_items[1][price]"), "price_Monthly");
  assert.equal(params.has("subscription_data[trial_period_days]"), false);
  assert.equal(params.get("metadata[claim_hash]"), hash); assert.ok(params.get("success_url").includes("#claim="));
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), "https://authichain.com");
});
test("pack is a $1500 one-time purchase with customer creation", async () => {
  const f = fixture(); const r = await f.req("/checkout", { sku: "PACK-WORKFLOW", claim });
  assert.equal(r.status, 200); assert.equal((await r.json()).initial_amount_usd, 1500);
  const params = new URLSearchParams(f.calls.find(call => call.method === "POST").body);
  assert.equal(params.get("mode"), "payment"); assert.equal(params.get("line_items[0][price]"), "price_Pack"); assert.equal(params.get("customer_creation"), "always");
});
test("disabled checkout, missing fulfillment and unready delivery cannot create a session", async () => {
  for (const change of [f => { f.env.CHECKOUT_ENABLED = "false"; }, f => { delete f.env.LICENSE_FULFILLMENT; }, f => { f.controls.ready = false; }]) {
    const f = fixture(); change(f); assert.equal((await f.req("/checkout", { sku: "OEM-VERIFY", claim })).status, 503);
    assert.equal(f.calls.some(call => call.method === "POST"), false);
  }
});
test("invalid SKU, weak claim token and forbidden origin are rejected", async () => {
  const f = fixture();
  assert.equal((await f.req("/checkout", { sku: "arbitrary", claim })).status, 400);
  assert.equal((await f.req("/checkout", { sku: "OEM-VERIFY", claim: "guessable" })).status, 400);
  assert.equal((await f.req("/checkout", { sku: "OEM-VERIFY", claim }, "https://evil.test")).status, 403);
  assert.equal(f.calls.length, 0);
});
test("wrong Stripe mode or catalog amount fails before session creation", async () => {
  const f = fixture(); f.prices[0].unit_amount = 1;
  assert.equal((await f.req("/checkout", { sku: "OEM-VERIFY", claim })).status, 503);
  f.prices[0].unit_amount = 750000; f.env.STRIPE_SECRET_KEY = "sk_live_fixture_only";
  assert.equal((await f.req("/checkout", { sku: "OEM-VERIFY", claim })).status, 503);
  assert.equal(f.calls.some(call => call.method === "POST"), false);
});
test("repeated checkout requests use a stable Stripe idempotency key", async () => {
  const f = fixture(); await f.req("/checkout", { sku: "OEM-VERIFY", claim }); await f.req("/checkout", { sku: "OEM-VERIFY", claim });
  const calls = f.calls.filter(call => call.method === "POST"); assert.equal(calls.length, 2); assert.equal(calls[0].key, calls[1].key);
});
test("signed paid event verifies Stripe session and exact line items before fulfillment", async () => {
  const f = fixture(); assert.equal((await f.webhook()).status, 200);
  const fulfilled = f.backendCalls.find(call => call.path === "/fulfill");
  assert.equal(fulfilled.body.event_id, "evt_fixture"); assert.equal(fulfilled.body.sku, "OEM-VERIFY"); assert.equal(fulfilled.body.claim_hash, hash);
});
test("unpaid completion and unrelated sessions do not issue a license", async () => {
  const f = fixture(); assert.equal((await f.webhook({ payment_status: "unpaid" })).status, 200);
  f.session.payment_status = "paid"; f.session.metadata.product_line = "unrelated"; assert.equal((await f.webhook()).status, 200);
  assert.equal(f.backendCalls.some(call => call.path === "/fulfill"), false);
});
test("wrong line items or missing durable fulfillment return a retryable webhook response", async () => {
  const f = fixture(); f.items[0].price.id = "price_Wrong";
  assert.equal((await f.webhook()).status, 503); assert.equal(f.backendCalls.some(call => call.path === "/fulfill"), false);
  f.items[0].price.id = "price_Setup"; f.controls.fulfilled = false; assert.equal((await f.webhook()).status, 503);
});
test("invalid signature and wrong-mode signed events never reach fulfillment", async () => {
  const f = fixture();
  const r = await f.worker.fetch(new Request("https://license.test/webhook", { method: "POST", body: "{}", headers: { "stripe-signature": "invented" } }), f.env);
  assert.equal(r.status, 400); assert.equal((await f.webhook({}, { livemode: true })).status, 400); assert.equal(f.backendCalls.length, 0);
});
test("claim requires payment and the browser's secret token; session ID alone is insufficient", async () => {
  const f = fixture(); assert.equal((await f.req("/claim", { session_id: f.session.id, claim: "b".repeat(43) })).status, 403);
  assert.equal(f.backendCalls.length, 0); assert.equal((await f.req("/claim", { session_id: f.session.id, claim })).status, 200);
  f.session.payment_status = "unpaid"; assert.equal((await f.req("/claim", { session_id: f.session.id, claim })).status, 503);
});
test("claim reports pending until backend delivery is ready", async () => {
  const f = fixture(); f.controls.delivery = "pending";
  const r = await f.req("/claim", { session_id: f.session.id, claim }); assert.equal(r.status, 202); assert.deepEqual(await r.json(), { status: "pending" });
});
test("success page has no embedded key, blocks framing and prevents referrer leakage", async () => {
  const f = fixture(); const r = await f.worker.fetch(new Request("https://license.test/success?session_id=untrusted"), f.env);
  assert.equal(r.headers.get("Cache-Control"), "no-store"); assert.equal(r.headers.get("Referrer-Policy"), "no-referrer"); assert.match(r.headers.get("Content-Security-Policy"), /frame-ancestors 'none'/);
  const body = await r.text(); assert.equal(body.includes("sk_test_fixture_only"), false); assert.equal(body.includes("test_delivery_only"), false); assert.ok(body.includes("history.replaceState"));
});
test("client helper creates a random claim, handles errors, and permits only Stripe redirects", async () => {
  let navigated; let sent;
  await startCheckout("OEM-VERIFY", "https://license.test", async (_url, init) => { sent = JSON.parse(init.body); return asResponse({ url: "https://checkout.stripe.com/c/pay/fixture" }); }, url => { navigated = url; });
  assert.match(sent.claim, /^[A-Za-z0-9_-]{43}$/); assert.equal(navigated, "https://checkout.stripe.com/c/pay/fixture");
  await assert.rejects(startCheckout("OEM-VERIFY", "https://license.test", async () => asResponse({ error: "Unavailable" }, 503), () => {}), /Unavailable/);
  await assert.rejects(startCheckout("OEM-VERIFY", "https://license.test", async () => asResponse({ url: "https://evil.test" }), () => {}), /Invalid payment destination/);
});
test("secret binding validates prices then writes four bindings without logging values", async () => {
  const f = fixture(); const writes = []; const logs = [];
  const env = { ...f.env, CLOUDFLARE_ACCOUNT_ID: "a".repeat(32), CLOUDFLARE_API_TOKEN: "cf_fixture_only" };
  const request = async (url, init) => {
    if (url.includes("/settings")) return asResponse({ success: true });
    if (url.includes("api.stripe.com")) return asResponse({ has_more: false, data: f.prices });
    writes.push(JSON.parse(init.body)); return asResponse({ success: true });
  };
  const dry = await bindSecrets(env, { fetch: request, log: value => logs.push(value) });
  assert.equal(dry.applied, false); assert.equal(writes.length, 0);
  const applied = await bindSecrets(env, { fetch: request, apply: true, log: value => logs.push(value) });
  assert.equal(applied.applied, true); assert.equal(writes.length, 4); assert.equal(writes[0].text, env.STRIPE_SECRET_KEY);
  assert.equal(logs.join(" ").includes("fixture_only"), false); assert.equal(logs.join(" ").includes("price_Setup"), false);
});
test("secret binding refuses an absent Worker before any write", async () => {
  const f = fixture(); let n = 0;
  await assert.rejects(bindSecrets({ ...f.env, CLOUDFLARE_ACCOUNT_ID: "a".repeat(32), CLOUDFLARE_API_TOKEN: "cf_fixture_only" }, { apply: true, fetch: async () => { n++; return asResponse({ success: false }, 404); } }), /must exist/);
  assert.equal(n, 1);
});
