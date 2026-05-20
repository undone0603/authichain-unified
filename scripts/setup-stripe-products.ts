/**
 * Idempotent Stripe product/price seeder.
 *
 * Usage: STRIPE_SECRET_KEY=sk_test_... pnpm tsx scripts/setup-stripe-products.ts
 *
 * Creates 7 products + their canonical prices if they do not already exist
 * (matched by Stripe `product.metadata.canonical_name`). Emits the resulting
 * price IDs so they can be pasted into `shared/pricing.ts:STRIPE_PRICE_TO_PLAN`.
 *
 * Run once per Stripe account (test mode and live mode separately).
 */

import Stripe from "stripe";
import { B2B_PLANS, QRON_PLANS, CONTRACT } from "../shared/pricing";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) {
  console.error("STRIPE_SECRET_KEY not set");
  process.exit(1);
}
const stripe = new Stripe(key, { apiVersion: "2025-03-31.basil" as any });

interface Spec {
  canonicalName: string;
  displayName: string;
  /** When set, a recurring monthly price is created. */
  monthlyCents?: number;
  /** When set, a recurring annual price is created. */
  annualCents?: number;
  /** When set, a one-time price is created. */
  oneTimeCents?: number;
  planKey: string;
}

const specs: Spec[] = [
  // B2B
  { canonicalName: B2B_PLANS.starter.product,      displayName: B2B_PLANS.starter.name,      monthlyCents: B2B_PLANS.starter.monthlyCents,      annualCents: Math.round(B2B_PLANS.starter.monthlyCents      * 12 * 0.8), planKey: "starter" },
  { canonicalName: B2B_PLANS.professional.product, displayName: B2B_PLANS.professional.name, monthlyCents: B2B_PLANS.professional.monthlyCents, annualCents: Math.round(B2B_PLANS.professional.monthlyCents * 12 * 0.8), planKey: "professional" },
  { canonicalName: B2B_PLANS.enterprise.product,   displayName: B2B_PLANS.enterprise.name,   monthlyCents: B2B_PLANS.enterprise.monthlyCents,   annualCents: Math.round(B2B_PLANS.enterprise.monthlyCents   * 12 * 0.8), planKey: "enterprise" },
  // QRON
  { canonicalName: QRON_PLANS.launch_pack.product, displayName: QRON_PLANS.launch_pack.name, oneTimeCents:   QRON_PLANS.launch_pack.oneTimeCents,                                                                              planKey: "launch_pack" },
  { canonicalName: QRON_PLANS.studio.product,      displayName: QRON_PLANS.studio.name,      monthlyCents:   QRON_PLANS.studio.monthlyCents,                                                                                       planKey: "studio" },
  { canonicalName: QRON_PLANS.studio_pro.product,  displayName: QRON_PLANS.studio_pro.name,  monthlyCents:   QRON_PLANS.studio_pro.monthlyCents,                                                                                   planKey: "studio_pro" },
  // Contract setup
  { canonicalName: CONTRACT.setupProduct,          displayName: "AuthiChain Contract Pilot — Setup", oneTimeCents: CONTRACT.setupCents,                                                                                            planKey: "contract_setup" },
];

async function findOrCreateProduct(canonicalName: string, displayName: string): Promise<Stripe.Product> {
  const list = await stripe.products.list({ limit: 100, active: true });
  const existing = list.data.find(p => p.metadata?.canonical_name === canonicalName);
  if (existing) return existing;
  return await stripe.products.create({
    name: displayName,
    metadata: { canonical_name: canonicalName },
  });
}

async function findOrCreatePrice(
  product: Stripe.Product,
  amountCents: number,
  recurring: "month" | "year" | null,
): Promise<Stripe.Price> {
  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 100 });
  const interval = recurring;
  const match = prices.data.find(p =>
    p.unit_amount === amountCents &&
    (interval === null ? !p.recurring : p.recurring?.interval === interval),
  );
  if (match) return match;
  return await stripe.prices.create({
    product: product.id,
    unit_amount: amountCents,
    currency: "usd",
    ...(interval ? { recurring: { interval } } : {}),
  });
}

async function main() {
  const mappings: Record<string, string> = {};

  for (const spec of specs) {
    const product = await findOrCreateProduct(spec.canonicalName, spec.displayName);
    console.log(`[product] ${spec.canonicalName} -> ${product.id}`);

    if (spec.monthlyCents !== undefined) {
      const monthly = await findOrCreatePrice(product, spec.monthlyCents, "month");
      mappings[monthly.id] = spec.planKey;
      console.log(`  monthly  ${monthly.id} ($${spec.monthlyCents / 100})`);
    }
    if (spec.annualCents !== undefined) {
      const annual = await findOrCreatePrice(product, spec.annualCents, "year");
      mappings[annual.id] = spec.planKey;
      console.log(`  annual   ${annual.id} ($${spec.annualCents / 100})`);
    }
    if (spec.oneTimeCents !== undefined) {
      const oneTime = await findOrCreatePrice(product, spec.oneTimeCents, null);
      mappings[oneTime.id] = spec.planKey;
      console.log(`  oneTime  ${oneTime.id} ($${spec.oneTimeCents / 100})`);
    }
  }

  console.log("\n=== Paste into shared/pricing.ts:STRIPE_PRICE_TO_PLAN ===");
  for (const [priceId, planKey] of Object.entries(mappings)) {
    console.log(`  "${priceId}": "${planKey}",`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
