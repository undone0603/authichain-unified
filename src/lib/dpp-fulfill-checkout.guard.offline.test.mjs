/**
 * Reproducible, zero-dependency test of the shared DPP fulfillment SKU gate.
 *
 * Run with Node 22:
 *   node --test src/lib/dpp-fulfill-checkout.guard.offline.test.mjs
 *
 * This extracts the actual early authorization guard from the TypeScript
 * module and executes isolated Stripe-session fixtures. It does not import
 * Stripe, contact Supabase, send email, charge money, or grant access.
 * Supplemental to full Vitest, signed-webhook and persistence integration.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("./dpp-fulfill-checkout.ts", import.meta.url), "utf8");
const first = source.indexOf("  const md = session.metadata || {};");
const last = source.indexOf("  // This helper has multiple webhook callers.", first);
assert.ok(first >= 0 && last > first, "Shared fulfillment guard changed: inspect before testing");

const guard = source.slice(first, last);
assert.match(guard, /priceId !== DPP_PRICE_ID/);
assert.doesNotMatch(guard, /md\.stripe_price_id/);

const verify = new Function("session", "priceId", "DPP_PRICE_ID", guard + "\nreturn { handled: true };");
const canonical = "price_1TwmD8GqTruSqV8TpAF8dfyA";
const base = {
  id: "cs_test_example",
  status: "complete",
  payment_status: "paid",
  metadata: { offer: "dpp_readiness", plan: "dpp_readiness" },
  customer_details: { email: "buyer@example.test" },
};

for (const [description, price, sessionOverride, expected] of [
  ["accepts explicitly verified canonical DPP price", canonical, {}, true],
  ["refuses missing price evidence", undefined, {}, false],
  ["refuses null price evidence", null, {}, false],
  ["refuses empty price evidence", "", {}, false],
  ["refuses another equally priced SKU", "price_other_299", {}, false],
  ["refuses spoofed metadata without trusted price", undefined,
    { metadata: { ...base.metadata, stripe_price_id: canonical } }, false],
  ["refuses spoofed metadata when authoritative price differs", "price_other_299",
    { metadata: { ...base.metadata, stripe_price_id: canonical } }, false],
  ["allows canonical price without descriptive metadata", canonical,
    { metadata: {} }, true],
]) {
  test(description, () => {
    const result = verify({ ...base, ...sessionOverride }, price, canonical);
    assert.equal(result.handled, expected);
  });
}
