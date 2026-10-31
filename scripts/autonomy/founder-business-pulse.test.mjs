import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { findOfferDrift } from "./founder-business-pulse.mjs";
import { PLANS } from "../../src/lib/plans.ts";

// The bug this guards against: the pulse only checked that each offer ID
// appeared in plans.ts, so founder-business.json could advertise $19 while
// plans.ts charged something else and the pulse still reported PASS.

const plans = [
  { id: "qron_launch", price: 19, stripe_mode: "subscription" },
  { id: "starter", price: 29, stripe_mode: "payment" },
];
const offer = (overrides) => ({
  id: "starter",
  checkout: "/checkout/starter",
  price_usd: 29,
  cadence: "one_time",
  ...overrides,
});

test("no drift when id, price and cadence match", () => {
  assert.deepEqual(
    findOfferDrift(
      [offer({}), offer({ id: "qron_launch", checkout: "/checkout/qron_launch", price_usd: 19, cadence: "monthly" })],
      plans
    ),
    []
  );
});

test("flags a price that differs from plans.ts", () => {
  const errors = findOfferDrift([offer({ price_usd: 39 })], plans);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Price drift for starter: .*\$39.*\$29/);
});

test("flags a cadence that differs from plans.ts stripe_mode", () => {
  const errors = findOfferDrift([offer({ cadence: "monthly" })], plans);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /Cadence drift for starter/);
});

test("flags an unknown cadence instead of passing it", () => {
  assert.match(findOfferDrift([offer({ cadence: "weekly" })], plans)[0], /Unknown cadence/);
});

test("flags an offer missing from plans.ts", () => {
  assert.match(findOfferDrift([offer({ id: "ghost" })], plans)[0], /missing from src\/lib\/plans\.ts: ghost/);
});

test("flags a checkout path outside /checkout/", () => {
  assert.match(findOfferDrift([offer({ checkout: "https://buy.example" })], plans)[0], /Invalid checkout path/);
});

test("reports every mismatch, not just the first", () => {
  assert.equal(findOfferDrift([offer({ price_usd: 1, cadence: "monthly" })], plans).length, 2);
});

test("the committed founder-business.json matches the real PLANS", () => {
  const manifest = JSON.parse(
    readFileSync(new URL("../../.github/founder-business.json", import.meta.url), "utf8")
  );
  assert.deepEqual(findOfferDrift(manifest.offers, PLANS), []);
});
