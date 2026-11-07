/**
 * #2370 — public Worker DPP claims must be bounded by actual capabilities.
 * Runs against the real render path, not a mocked excerpt.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { listedPlans, planById } from "../../../src/lib/plans.ts";
import worker from "./index.ts";

type Env = Parameters<typeof worker.fetch>[1];
const env = {
  APP_WORKER: { fetch: async () => new Response("app", { status: 200 }) },
} as unknown as Env;

test("verified live $299 DPP price is explicitly listed under the accurate workspace offer", () => {
  const plan = planById("dpp_readiness");
  assert.ok(plan);
  assert.equal(plan.listed, true);
  assert.equal(plan.price, 299);
  assert.equal(plan.stripe_price_id, "price_1TwmD8GqTruSqV8TpAF8dfyA");
  assert.equal(listedPlans().some(p => p.id === "dpp_readiness"), true);
  assert.match(plan.description, /Not an audit/);
});

test("public DPP page does not advertise universal compliance, NFT equivalence, or unsupported delivery", async () => {
  const response = await worker.fetch(
    new Request("https://authichain.com/digital-product-passport"),
    env
  );
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /EU Digital Product Passport Readiness/);
  assert.ok(html.includes('"name":"EU Digital Product Passport Readiness"'), "JSON-LD must describe readiness, not certification");
  assert.match(html, /One-time \$299 workspace/);
  assert.match(html, /confirmed payment and entitlement grant/);
  assert.match(html, /not an issued or registered passport/);
  assert.match(html, /Product-specific obligations depend on adopted delegated acts/);
  assert.match(html, /Regulatory exports \(planned\)/);
  for (const forbidden of [
    "EU Digital Product Passport Compliance",
    "/checkout/qron_launch",
    "/checkout/strainchain_farm",
    "blockchain-readable product passport for every item",
    "EU DPP REGISTRY LAUNCH — IN FORCE SINCE JUL 19",
    "automatic provisioning",
    "the NFT is the passport",
    "One-click compliance exports",
    "Mandatory 2027",
    "Mandatory 2028–29",
    "Start Your DPP Readiness Audit",
    "DPP-SMOKE-E2E",
    "2.1 seconds",
  ]) {
    assert.equal(html.includes(forbidden), false, `Live DPP copy must not contain: ${forbidden}`);
  }
});

test("homepage FAQ schema does not promise issued passports from workspace checkout", async () => {
  const response = await worker.fetch(
    new Request("https://authichain.com/"),
    env
  );
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.ok(html.includes("A one-time $299 checkout for a DPP readiness workspace"));
  assert.match(html, /Activation requires confirmed payment and entitlement grant/);
  assert.equal(html.includes("publish a first Digital Product Passport"), false);
});
