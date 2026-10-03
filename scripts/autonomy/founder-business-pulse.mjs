#!/usr/bin/env node
/**
 * Founder Business Pulse
 * Read-only control-plane check. It does not call Stripe, mutate production,
 * send mail, or change autonomy gates.
 */
import { readFileSync, existsSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

// founder-business.json cadence -> plans.ts stripe_mode.
const CADENCE_TO_STRIPE_MODE = { monthly: "subscription", one_time: "payment" };

/**
 * Compare manifest offers against PLANS from src/lib/plans.ts, the only price
 * source for charging humans. Returns one message per mismatch; empty means
 * no drift. The manifest repeats price_usd and cadence for readability, so
 * any disagreement means it has become a second, wrong price catalogue.
 */
export function findOfferDrift(offers, plans) {
  const byId = new Map(plans.map((plan) => [plan.id, plan]));
  const errors = [];
  for (const offer of offers) {
    const plan = byId.get(offer.id);
    if (!plan) {
      errors.push("Offer missing from src/lib/plans.ts: " + offer.id);
      continue;
    }
    if (offer.price_usd !== plan.price) {
      errors.push(
        "Price drift for " + offer.id + ": founder-business.json says $" + offer.price_usd +
          ", src/lib/plans.ts says $" + plan.price
      );
    }
    const expectedMode = CADENCE_TO_STRIPE_MODE[offer.cadence];
    if (!expectedMode) {
      errors.push("Unknown cadence for " + offer.id + ": " + offer.cadence);
    } else if (plan.stripe_mode !== expectedMode) {
      errors.push(
        "Cadence drift for " + offer.id + ": founder-business.json says " + offer.cadence +
          ", src/lib/plans.ts stripe_mode is " + plan.stripe_mode
      );
    }
    if (!String(offer.checkout).startsWith("/checkout/")) {
      errors.push("Invalid checkout path for offer: " + offer.id);
    }
  }
  return errors;
}

async function main() {
  const root = process.cwd();
  const paths = [
    ".github/founder-business.json",
    "src/lib/plans.ts",
    ".github/autonomy.json"
  ];

  for (const p of paths) {
    if (!existsSync(resolve(root, p))) {
      console.error("::error::Missing founder business control-plane file: " + p);
      process.exit(1);
    }
  }

  const manifest = JSON.parse(readFileSync(resolve(root, paths[0]), "utf8"));
  // plans.ts has no imports, so Node 22's type stripping loads the real PLANS
  // array: no regex over source text.
  const { PLANS } = await import(pathToFileURL(resolve(root, paths[1])).href);
  const autonomy = JSON.parse(readFileSync(resolve(root, paths[2]), "utf8"));

  if (manifest.mode !== "founder-only") {
    console.error("::error::Business mode must remain founder-only.");
    process.exit(1);
  }

  const driftErrors = findOfferDrift(manifest.offers || [], PLANS);
  if (driftErrors.length > 0) {
    for (const message of driftErrors) console.error("::error::" + message);
    process.exit(1);
  }

  const gates = new Set(manifest.founder_only_gates || []);
  for (const required of [
    "pricing_or_new_sku_changes",
    "production_schema_migrations",
    "secrets_rotation",
    "dns_or_cloudflare_access",
    "merge_security_revenue_schema_or_charter_changes"
  ]) {
    if (!gates.has(required)) {
      console.error("::error::Founder gate missing: " + required);
      process.exit(1);
    }
  }

  if (autonomy.owner !== manifest.owner) {
    console.error("::error::Business owner and autonomy owner disagree.");
    process.exit(1);
  }

  const metrics = manifest.success_metrics || [];
  for (const metric of ["paid_checkouts", "gross_revenue_usd", "open_approval_count", "open_ops_alert_count"]) {
    if (!metrics.includes(metric)) {
      console.error("::error::Success metric missing: " + metric);
      process.exit(1);
    }
  }

  const summary = [
    "## Founder-only business pulse",
    "",
    "- Mode: **" + manifest.mode + "**",
    "- Offers matching src/lib/plans.ts (id, price, cadence): **" + manifest.offers.length + "**",
    "- Autonomous loop actions: **" + Object.values(manifest.loops).flat().length + "**",
    "- Founder-only gates: **" + manifest.founder_only_gates.length + "**",
    "",
    "No production mutations were performed by this pulse."
  ].join("\n");

  if (process.env.GITHUB_STEP_SUMMARY) {
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + "\n");
  }
  console.log("Founder business pulse: PASS");
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
