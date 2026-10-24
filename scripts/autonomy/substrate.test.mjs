import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  DPP_LOOP_ORDER,
  authorize,
  buildSubstrate,
  coordinate,
  findSubstrateErrors,
} from "./substrate.mjs";
import { PLAN_ALIASES, PLANS, PUBLIC_PLAN_IDS } from "../../src/lib/plans.ts";

function liveDppOrder() {
  const source = readFileSync(new URL("../../src/lib/dpp-loop.ts", import.meta.url), "utf8");
  const block = source.match(/export const DPP_LOOP_ORDER[\s\S]*?=\s*\[([\s\S]*?)\] as const/);
  if (!block) throw new Error("DPP_LOOP_ORDER not found");
  return [...block[1].matchAll(/"([^"]+)"/g)].map(match => match[1]);
}

const founderBusiness = JSON.parse(
  readFileSync(new URL("../../.github/founder-business.json", import.meta.url), "utf8")
);
const autonomy = JSON.parse(
  readFileSync(new URL("../../.github/autonomy.json", import.meta.url), "utf8")
);

const input = {
  plans: PLANS,
  publicPlanIds: PUBLIC_PLAN_IDS,
  aliases: PLAN_ALIASES,
  founderBusiness,
  autonomy,
};

test("DPP flywheel order matches the live loop", () => {
  assert.deepEqual([...DPP_LOOP_ORDER], liveDppOrder());
});

test("the live control plane projects without error", () => {
  const substrate = buildSubstrate(input);
  assert.deepEqual(findSubstrateErrors(substrate, input), []);
  assert.equal(substrate.qualifying_revenue, "UNKNOWN");
  assert.equal(substrate.authority, "projection");
});

test("surfaces share one ledger and do not cross-sell", () => {
  const substrate = buildSubstrate(input);
  const qron = coordinate(substrate, "qron");
  assert.equal(qron.ledger, "authichain-core");
  assert.equal(qron.offers.find(offer => offer.id === "qron_launch").price_usd, 19);
  assert.equal(qron.offers.find(offer => offer.id === "qron_launch").price_source, "src/lib/plans.ts");
  assert.equal(authorize(substrate, "qron", { type: "select_offer", offer_id: "starter" }).allowed, true);
  assert.equal(authorize(substrate, "qron", { type: "select_offer", offer_id: "dpp_readiness" }).allowed, false);
  assert.equal(
    authorize(substrate, "strainchain", { type: "select_offer", offer_id: "strainchain_farm" }).allowed,
    false
  );
});

test("frozen and founder actions stay denied", () => {
  const substrate = buildSubstrate(input);
  assert.equal(authorize(substrate, "govchain", { type: "dispatch", workflow: "gov-mint.yml" }).class, "FROZEN");
  assert.equal(authorize(substrate, "agentz", { type: "set_agentz_mode", mode: "auto" }).class, "FROZEN");
  assert.equal(authorize(substrate, "authichain", { type: "change_price" }).class, "FOUNDER_ONLY");
  assert.equal(authorize(substrate, "authichain", { type: "send" }).class, "APPROVAL_REQUIRED");
  assert.equal(authorize(substrate, "authichain", { type: "classify_revenue" }).writes, false);
});

test("a future surface may reuse the core and may not bring a new ledger or SKU", () => {
  const substrate = buildSubstrate(input);
  assert.equal(
    authorize(substrate, "nightstamp", {
      type: "add_surface",
      ledger: "authichain-core",
      offer_ids: ["starter"],
      workflows: ["ops-pulse.yml"],
    }).allowed,
    true
  );
  assert.equal(
    authorize(substrate, "nightstamp", {
      type: "add_surface",
      ledger: "nightstamp-chain",
      offer_ids: ["starter"],
    }).allowed,
    false
  );
  assert.equal(
    authorize(substrate, "nightstamp", {
      type: "add_surface",
      ledger: "authichain-core",
      offer_ids: ["truemark_pro"],
    }).class,
    "FOUNDER_ONLY"
  );
});

test("musa checkout slugs alias the catalogue ids", () => {
  assert.equal(PLAN_ALIASES.musa_claim_file, "made_in_usa_claim_file");
  assert.equal(PLAN_ALIASES.musa_audit_bundle, "made_in_usa_audit_bundle");
});
