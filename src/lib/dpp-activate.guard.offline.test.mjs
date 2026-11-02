/**
 * No-credential, zero-dependency check of the real activation Stripe guard.
 *
 * node --test src/lib/dpp-activate.guard.offline.test.mjs
 *
 * This suite extracts the actual guard from dpp-activate.ts and passes
 * deterministic Stripe session fixtures. It never instantiates Stripe,
 * accesses Supabase, issues HTTP requests, or grants entitlements.
 * Supplemental to Vitest and end-to-end billing tests, not a replacement.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const source = readFileSync(new URL("./dpp-activate.ts", import.meta.url), "utf8");
const fromMarker = "  // A completed Checkout Session can still be unpaid";
const toMarker = "\n  const email = (";
const start = source.indexOf(fromMarker);
const end = source.indexOf(toMarker, start);
assert.ok(start >= 0 && end > start, "Activation Stripe guard markers changed: inspect by hand");

const guard = source.slice(start, end)
  .replace(" as Record<string, unknown>", "");
assert.match(guard, /session\.line_items\?\.has_more/);
assert.match(guard, /session\.mode !== "payment"/);
assert.match(guard, /session\.subscription/);
assert.match(guard, /lineItems\[0\]\?\.quantity/);

const price = "price_1TwmD8GqTruSqV8TpAF8dfyA";
const check = new Function("session", "DPP_PRICE_ID", guard + "\nreturn { ok: true };");

const canonical = Object.freeze({
  status: "complete",
  payment_status: "paid",
  mode: "payment",
  subscription: null,
  metadata: { plan: "dpp_readiness" },
  line_items: { data: [{ price: { id: price }, quantity: 1 }], has_more: false },
});

for (const [name, override, expected] of [
  ["canonical paid DPP session", {}, true],
  ["completed but unpaid", { payment_status: "unpaid" }, false],
  ["open but paid", { status: "open" }, false],
  ["mixed product basket", { line_items: { data: [
    { price: { id: price }, quantity: 1 }, { price: { id: "price_other" }, quantity: 1 },
  ], has_more: false } }, false],
  ["paginated line items", { line_items: { data: [
    { price: { id: price }, quantity: 1 },
  ], has_more: true } }, false],
  ["two units", { line_items: { data: [
    { price: { id: price }, quantity: 2 },
  ], has_more: false } }, false],
  ["quantity missing", { line_items: { data: [{ price: { id: price } }], has_more: false } }, false],
  ["quantity null", { line_items: { data: [{ price: { id: price }, quantity: null }], has_more: false } }, false],
  ["quantity zero", { line_items: { data: [{ price: { id: price }, quantity: 0 }], has_more: false } }, false],
  ["fractional quantity", { line_items: { data: [{ price: { id: price }, quantity: 0.5 }], has_more: false } }, false],
  ["recurring checkout", { mode: "subscription" }, false],
  ["subscription reference", { subscription: "sub_unexpected" }, false],
  ["missing checkout mode", { mode: null }, false],
  ["same-price unrelated product", { line_items: { data: [
    { price: { id: "price_other_299" }, quantity: 1 },
  ], has_more: false } }, false],
  ["contradictory plan", { metadata: { plan: "musa_claim_file" } }, false],
  ["authorized fully discounted DPP still passes SKU guard", { amount_total: 0 }, true],
  ["missing expanded line items", { line_items: { data: [], has_more: false } }, false],
]) {
  test(name, () => {
    const got = check({ ...canonical, ...override }, price);
    assert.equal(got.ok, expected);
    if (!expected) assert.equal(typeof got.error, "string");
  });
}
