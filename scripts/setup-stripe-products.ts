/**
 * Idempotent Stripe product/price seeder.
 *
 * Usage: STRIPE_SECRET_KEY=sk_test_... pnpm tsx scripts/setup-stripe-products.ts
 *
 * Creates canonical products/prices if they do not already exist, including
 * Nightstamp. Never commit the Stripe key.
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
  monthlyCents?: number;
  annualCents?: number;
  oneTimeCents?: number;
  planKey: string;
}

const specs: Spec[] = [
  { canonicalName: B2B_PLANS.starter.product, displayName: B2B_PLANS.starter.name, monthlyCents: B2B_PLANS.starter.monthlyCents, annualCents: Math.round(B2B_PLANS.starter.monthlyCents * 12 * 0.8), planKey: "starter" },
  { canonicalName: B2B_PLANS.professional.product, displayName: B2B_PLANS.professional.name, monthlyCents: B2B_PLANS.professional.monthlyCents, annualCents: Math.round(B2B_PLANS.professional.monthlyCents * 12 * 0.8), planKey: "professional" },
  { canonicalName: B2B_PLANS.enterprise.product, displayName: B2B_PLANS.enterprise.name, monthlyCents: B2B_PLANS.enterprise.monthlyCents, annualCents: Math.round(B2B_PLANS.enterprise.monthlyCents * 12 * 0.8), planKey: "enterprise" },
  { canonicalName: QRON_PLANS.launch_pack.product, displayName: QRON_PLANS.launch_pack.name, oneTimeCents: QRON_PLANS.launch_pack.oneTimeCents, planKey: "launch_pack" },
  { canonicalName: QRON_PLANS.studio.product, displayName: QRON_PLANS.studio.name, monthlyCents: QRON_PLANS.studio.monthlyCents, planKey: "studio" },
  { canonicalName: QRON_PLANS.studio_pro.product, displayName: QRON_PLANS.studio_pro.name, monthlyCents: QRON_PLANS.studio_pro.monthlyCents, planKey: "studio_pro" },
  { canonicalName: CONTRACT.setupProduct, displayName: "AuthiChain Contract Pilot — Setup", oneTimeCents: CONTRACT.setupCents, planKey: "contract_setup" },
  { canonicalName: "strainchain_passport", displayName: "StrainChain Passport — Per Cultivar", oneTimeCents: 4_900, planKey: "strainchain_passport" },
  { canonicalName: "strainchain_farm", displayName: "StrainChain Farm Plan", monthlyCents: 14_900, planKey: "strainchain_farm" },
  { canonicalName: "nightstamp_digital", displayName: "Nightstamp Digital", oneTimeCents: 900, planKey: "nightstamp_digital" },
  { canonicalName: "nightstamp_portal", displayName: "Nightstamp Memory Portal", oneTimeCents: 2_900, planKey: "nightstamp_portal" },
  { canonicalName: "nightstamp_certified", displayName: "Nightstamp Certified", oneTimeCents: 4_900, planKey: "nightstamp_certified" },
];

async function findOrCreateProduct(canonicalName: string, displayName: string): Promise<Stripe.Product> {
  const list = await stripe.products.list({ limit: 100, active: true });
  const existing = list.data.find(p => p.metadata?.canonical_name === canonicalName);
  if (existing) return existing;
  return stripe.products.create({ name: displayName, metadata: { canonical_name: canonicalName, tenant: "qron" } });
}

async function findOrCreatePrice(product: Stripe.Product, amountCents: number, recurring: "month" | "year" | null): Promise<Stripe.Price> {
  const prices = await stripe.prices.list({ product: product.id, active: true, limit: 100 });
  const match = prices.data.find(p => p.unit_amount === amountCents && (recurring === null ? !p.recurring : p.recurring?.interval === recurring));
  if (match) return match;
  return stripe.prices.create({ product: product.id, unit_amount: amountCents, currency: "usd", metadata: { tenant: "qron" }, ...(recurring ? { recurring: { interval: recurring } } : {}) });
}

async function nightstampPaymentLink(price: Stripe.Price): Promise<string> {
  const links = await stripe.paymentLinks.list({ active: true, limit: 100 });
  const existing = links.data.find(link => link.metadata?.canonical_name === "nightstamp_digital");
  if (existing) return existing.url;
  const link = await stripe.paymentLinks.create({
    line_items: [{ price: price.id, quantity: 1 }],
    metadata: { canonical_name: "nightstamp_digital", product: "nightstamp", tenant: "qron", sku: "digital" },
    after_completion: { type: "redirect", redirect: { url: "https://qron.space/order?preset=starmap&sku=digital" } },
  });
  return link.url;
}

async function main() {
  const mappings: Record<string, string> = {};
  let nightstamp9 = "";
  for (const spec of specs) {
    const product = await findOrCreateProduct(spec.canonicalName, spec.displayName);
    console.log(`[product] ${spec.canonicalName} -> ${product.id}`);
    if (spec.monthlyCents !== undefined) {
      const price = await findOrCreatePrice(product, spec.monthlyCents, "month");
      mappings[price.id] = spec.planKey;
      console.log(`  monthly ${price.id} ($${spec.monthlyCents / 100})`);
    }
    if (spec.annualCents !== undefined) {
      const price = await findOrCreatePrice(product, spec.annualCents, "year");
      mappings[price.id] = spec.planKey;
      console.log(`  annual ${price.id} ($${spec.annualCents / 100})`);
    }
    if (spec.oneTimeCents !== undefined) {
      const price = await findOrCreatePrice(product, spec.oneTimeCents, null);
      mappings[price.id] = spec.planKey;
      if (spec.canonicalName === "nightstamp_digital") nightstamp9 = await nightstampPaymentLink(price);
      console.log(`  oneTime ${price.id} ($${spec.oneTimeCents / 100})`);
    }
  }
  console.log("\n=== Stripe price mappings ===");
  for (const [priceId, planKey] of Object.entries(mappings)) console.log(`  "${priceId}": "${planKey}",`);
  console.log(`\nNIGHTSTAMP_PRICE_9=${Object.entries(mappings).find(([, v]) => v === "nightstamp_digital")?.[0] ?? ""}`);
  console.log(`NIGHTSTAMP_PRICE_29=${Object.entries(mappings).find(([, v]) => v === "nightstamp_portal")?.[0] ?? ""}`);
  console.log(`NIGHTSTAMP_PRICE_49=${Object.entries(mappings).find(([, v]) => v === "nightstamp_certified")?.[0] ?? ""}`);
  console.log(`NIGHTSTAMP_PAYMENT_LINK_9=${nightstamp9}`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
