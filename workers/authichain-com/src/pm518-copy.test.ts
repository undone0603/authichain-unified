// PM-518 / RES-231: absence tests for the #1663 post-merge gate cuts
// (/workspace/reports/res-gate-1663/POSTMERGE-f9482d22.md) and the
// "EU DPP Readiness" rename. Lines owned by #1720/#1721 are tested there.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { findVsPage, renderVsPage, renderVsIndex } from "./vs-pages.ts";
import { planById, PLANS } from "../../../src/lib/plans.ts";
import { renderEstatePricingPage } from "../../_shared/estate-pricing.ts";

const root = new URL("../../../", import.meta.url);
const read = (p: string) => readFileSync(new URL(p, root), "utf8");
const WS = /EU DPP Workspace/i;

function vs(slug: string): string {
  const def = findVsPage(slug);
  assert.ok(def, slug);
  return renderVsPage(def);
}

test("/vs/scantrust: same-day block cut, pricing heading retitled", () => {
  const h = vs("scantrust");
  assert.doesNotMatch(h, /Live in a Day, Not a Quarter/);
  assert.doesNotMatch(h, /issue authenticated codes the same day/);
  assert.doesNotMatch(h, /Pricing You Can Actually See/);
  assert.match(h, /Pricing on request/);
  assert.doesNotMatch(h, WS);
});

test("/vs/circularise: same-day self-serve sentence cut, proof heading retitled", () => {
  const h = vs("circularise");
  assert.doesNotMatch(h, /self-serve onboard the same day/);
  assert.doesNotMatch(h, /Strongest Proof Layer/);
  assert.match(h, /Proof layer \(in development\)/);
  assert.doesNotMatch(h, WS);
});

test("/vs/vechain: multi-chain assurance heading retitled", () => {
  const h = vs("vechain");
  assert.doesNotMatch(h, /AI \+ Multi-Chain Assurance/);
  assert.match(h, /On-chain anchoring \(in development\)/);
  assert.doesNotMatch(h, WS);
  assert.doesNotMatch(renderVsIndex(), WS);
});

test("plans.ts $299: renamed, workspace features and cta cut, new button", () => {
  const p = planById("dpp_readiness");
  assert.ok(p);
  assert.equal(p.name, "EU DPP Readiness");
  assert.equal(p.cta, "Pay $299 on Stripe");
  assert.equal(p.price, 299);
  for (const f of ["AuthiChain workspace", "Self-serve activation"])
    assert.ok(!p.features.includes(f), f);
  assert.ok(p.features.includes("Payment confirmation"));
  assert.ok(p.features.includes("Short onboarding form"));
  const all = JSON.stringify(PLANS);
  assert.doesNotMatch(all, WS);
  assert.doesNotMatch(all, /DPP workspace \$299/);
  assert.doesNotMatch(all, /Open DPP workspace/);
});

test("site sources: no EU DPP Workspace, $299 buttons say Pay $299 on Stripe", () => {
  for (const f of [
    "workers/_shared/estate-pricing.ts",
    "workers/authichain-com/src/index.ts",
    "workers/authichain-com/src/apollo-tracker.ts",
    "worker-app/dynamic-pages.ts",
  ]) {
    const s = read(f);
    assert.doesNotMatch(s, WS, f);
    assert.doesNotMatch(s, /Open EU DPP Workspace|Open your EU DPP Workspace/, f);
  }
  assert.match(read("workers/authichain-com/src/index.ts"), /label: "Pay \$299 on Stripe"/);
});

const require = createRequire(import.meta.url);
const pages: Array<{ slug: string; [k: string]: unknown }> = JSON.parse(
  read("content/seo/pages.json"),
);
const comparison: unknown = require("../../../scripts/seo-data/comparison.cjs");
function page(slug: string): string {
  const p = pages.find((x) => x.slug === slug);
  assert.ok(p, slug);
  return JSON.stringify(p);
}

test("SEO /p pages: workspace, assessment and signing-live cuts", () => {
  const vechain = page("vechain-alternative-without-tokens-or-gas-fees");
  assert.doesNotMatch(vechain, /checkout opens a workspace/);
  const circ = page("circularise-alternative-for-smaller-brands");
  assert.doesNotMatch(circ, /EU DPP Readiness audit/);
  const scan = page("scantrust-alternative-with-a-public-verifier");
  assert.doesNotMatch(scan, /can also be checked offline against the published JWKS/);
  assert.doesNotMatch(scan, /AuthiChain signs the record behind the code/);
  const uk = page("uk-battery-exporter-eu-battery-passport");
  assert.doesNotMatch(uk, /The assessment itself is \$299/);
  assert.doesNotMatch(uk, /What does the assessment look like/);
  const cost = page("battery-passport-readiness-assessment-cost");
  assert.doesNotMatch(cost, /Will my assessment look like the sample/);
  assert.doesNotMatch(cost, /built from your battery/);
  for (const s of [vechain, circ, scan, uk, cost,
    page("us-battery-manufacturer-eu-battery-passport-export")]) {
    assert.doesNotMatch(s, WS);
    assert.doesNotMatch(s, /opens an AuthiChain workspace/);
    assert.doesNotMatch(s, /50 workspace generations/);
  }
  assert.doesNotMatch(JSON.stringify(comparison), /workspace/i);
  assert.doesNotMatch(read("content/seo/pages.json"), /EU DPP Workspace is \$299/);
});

test("/pricing: EU DPP Readiness, no EU DPP Workspace, no workspace-claim copy", () => {
  const h = renderEstatePricingPage("authichain");
  assert.doesNotMatch(h, WS);
  assert.doesNotMatch(h, /Open your EU DPP Workspace/);
  assert.match(h, /EU DPP Readiness/);
  assert.match(h, /Pay \$299 on Stripe/);
});

test("PM-519: pages.json has no workspace/generations claims", () => {
  const all = read("content/seo/pages.json");
  assert.doesNotMatch(all, /50 workspace generations/i);
  assert.doesNotMatch(all, /opens an AuthiChain workspace/i);
  for (const slug of [
    "battery-passport-for-small-e-bike-brands",
    "made-in-america-origin-claim-substantiation",
  ]) {
    const s = page(slug);
    assert.doesNotMatch(s, /50 workspace generations/i);
    assert.doesNotMatch(s, /opens an AuthiChain workspace/i);
    assert.match(s, /short onboarding form/);
  }
});
