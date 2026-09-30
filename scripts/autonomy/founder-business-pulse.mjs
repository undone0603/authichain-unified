#!/usr/bin/env node
/**
 * Founder Business Pulse
 * Read-only control-plane check. It does not call Stripe, mutate production,
 * send mail, or change autonomy gates.
 */
import { readFileSync, existsSync, appendFileSync } from "node:fs";
import { resolve } from "node:path";

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
const plans = readFileSync(resolve(root, paths[1]), "utf8");
const autonomy = JSON.parse(readFileSync(resolve(root, paths[2]), "utf8"));

if (manifest.mode !== "founder-only") {
  console.error("::error::Business mode must remain founder-only.");
  process.exit(1);
}

for (const offer of manifest.offers || []) {
  const idPattern = new RegExp("id: [\\\"\\\']" + offer.id + "[\\\"\\\']");
  if (!idPattern.test(plans)) {
    console.error("::error::Offer missing from src/lib/plans.ts: " + offer.id);
    process.exit(1);
  }
  if (!String(offer.checkout).startsWith("/checkout/")) {
    console.error("::error::Invalid checkout path for offer: " + offer.id);
    process.exit(1);
  }
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
  "- Offers mapped to source of truth: **" + manifest.offers.length + "**",
  "- Autonomous loop actions: **" + Object.values(manifest.loops).flat().length + "**",
  "- Founder-only gates: **" + manifest.founder_only_gates.length + "**",
  "",
  "No production mutations were performed by this pulse."
].join("\n");

if (process.env.GITHUB_STEP_SUMMARY) {
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, summary + "\n");
}
console.log("Founder business pulse: PASS");
