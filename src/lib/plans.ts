// --- QRON Plans — mapped to real Stripe products/prices ---
// Products and prices are pre-created in the Stripe dashboard.
// priceId values are LIVE; keep in sync with Stripe.
//
// 2026-10-06: homepage paid product is starter $29. dpp_readiness stays
// listed as EU DPP Workspace, not an audit. Price id unchanged.
// Theater stays unlisted. Studio stays unlisted until a hard cap exists.
// generations: 0 = no grant. 999999 = unlimited sentinel (see business-tier.ts).

export type PlanId =
  | "free"
  | "starter"
  | "creator"
  | "qron_launch"
  | "studio"
  | "business"
  | "theater_1"
  | "theater_3"
  | "dpp_readiness"
  | "strainchain_passport"
  | "strainchain_farm"
  | "musa_claim_file"
  | "musa_audit_bundle"
  | "enterprise_compliance";

export interface Plan {
  id: PlanId;
  name: string;
  price: number;
  price_suffix?: string;
  description: string;
  generations: number;
  stripe_price_id: string | null;
  stripe_payment_link?: string;
  stripe_mode: "payment" | "subscription" | null;
  tier: "free" | "pro" | "enterprise";
  features: string[];
  cta: string;
  highlighted?: boolean;
  brand?: "qron" | "strainchain" | "musa";
  listed?: boolean;
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free",
    price: 0,
    description:
      "5 account-based generations. Sign-in required. Lookup verify only.",
    generations: 5,
    stripe_price_id: null,
    stripe_mode: null,
    tier: "free",
    features: [
      "5 generations per account",
      "Sign-in required",
      "Lookup verify only (no GPT-4V)",
      "Then Starter $29 or DPP workspace $299",
    ],
    cta: "Sign in for 5 credits",
  },
  {
    id: "starter",
    name: "Starter Pack",
    price: 29,
    description: "100 AI QR generations, never expire",
    generations: 100,
    stripe_price_id: "price_1UIoEVGqTruSqV8T61lp48wB",
    stripe_payment_link: "https://buy.stripe.com/eVq3cv2N3bVA8umazy1ND3E",
    stripe_mode: "payment",
    tier: "pro",
    features: [
      "100 generations (one-time)",
      "All free modes",
      "Holographic & Memory modes",
      "Designed for AuthiChain signed verification (in development)",
    ],
    cta: "Buy Starter Pack",
    listed: true,
  },
  {
    id: "qron_launch",
    name: "QRON Launch",
    price: 19,
    price_suffix: "/mo",
    description: "100 AI QR generations each month. Cancel any time.",
    generations: 100,
    stripe_price_id: "price_1UJjzPGqTruSqV8TmhFSc8vh",
    stripe_mode: "subscription",
    tier: "pro",
    brand: "qron",
    listed: true,
    features: [
      "100 generations / month",
      "All free modes",
      "Designed for AuthiChain signed verification (in development)",
      "Cancel any time",
    ],
    cta: "Start Launch $19/mo",
  },
  {
    id: "creator",
    name: "Creator Pack",
    price: 99,
    description: "500 AI QR generations — best value",
    generations: 500,
    stripe_price_id: "price_1UIoEYGqTruSqV8TCXTNipvh",
    stripe_payment_link: "https://buy.stripe.com/aFa8wP0EV2l08um8rq1ND3F",
    stripe_mode: "payment",
    tier: "pro",
    features: [
      "500 generations (one-time)",
      "All Pro modes",
      "Premium styles",
      "Priority generation queue",
      "Designed for AuthiChain signed verification (in development)",
    ],
    cta: "Buy Creator Pack",
    highlighted: true,
  },
  {
    id: "theater_1",
    name: "Theater 1: AgTech",
    price: 499,
    price_suffix: "/month",
    description: "Industrial AgTech & StrainChain Provenance",
    generations: 5000,
    stripe_price_id: "price_1TmDKJGqTruSqV8TGwxK8oc5",
    stripe_payment_link: "https://buy.stripe.com/00w4gzgDT6Bg5iagXW1ND3A",
    stripe_mode: "subscription",
    tier: "enterprise",
    listed: false,
    features: [
      "5,000 Industrial generations / mo",
      "Full DPP Data Integration",
      "StrainChain Genetic Mapping",
      "On our roadmap: supply-chain watchdog alerts",
      "On our roadmap: geo-fencing alerts for unexpected scan locations",
    ],
    cta: "Initialize Theater 1",
  },
  {
    id: "theater_3",
    name: "Theater 3: Elite",
    price: 1499,
    price_suffix: "/month",
    description: "The Ultimate Industrial & Luxury Security",
    generations: 999999,
    stripe_price_id: "price_1TmDKQGqTruSqV8TvSILgzXM",
    stripe_payment_link: "https://buy.stripe.com/7sYdR95ZfcZEcKCfTS1ND3B",
    stripe_mode: "subscription",
    tier: "enterprise",
    listed: false,
    features: [
      "Unlimited Industrial Artifacts",
      "Custom AI Model Training",
      "On-chain product narratives (Polygon contract https://polygonscan.com/address/0x4da4D2675e52374639C9c954f4f653887A9972BE; issuance in development)",
      "Real-time Security Webhooks",
      "24/7 AuthiChain Core Support",
    ],
    cta: "Contact for Theater 3",
    highlighted: true,
  },
  {
    id: "dpp_readiness",
    name: "EU DPP Workspace",
    price: 299,
    description:
      "One-time checkout that opens an AuthiChain workspace with 50 generations. Not an audit, not a certification, not legal advice.",
    generations: 50,
    stripe_price_id: "price_1TwmD8GqTruSqV8TpAF8dfyA",
    stripe_mode: "payment",
    tier: "pro",
    features: [
      "AuthiChain workspace",
      "Self-serve activation",
      "50 workspace generations",
      "Not an audit and not a legal opinion",
      "Does not register a product in EUDAMED",
    ],
    cta: "Open DPP workspace — $299",
  },
  {
    id: "strainchain_passport",
    name: "Passport — Per Cultivar",
    price: 49,
    description:
      "One published genetics passport, built from your existing CoAs",
    generations: 0,
    stripe_price_id: "price_1UHjCZGqTruSqV8T35M6AmoJ",
    stripe_payment_link: "https://buy.stripe.com/cNi9ATdrH4t811U4ba1ND3y",
    stripe_mode: "payment",
    tier: "pro",
    brand: "strainchain",
    features: [
      "One passport, one cultivar",
      "Full cannabinoid and terpene panel from your certificates",
      "Every total recomputed from the source panel, not transcribed",
      "QR code and shareable link",
    ],
    cta: "Publish one passport",
  },
  {
    id: "strainchain_farm",
    name: "Farm Plan",
    price: 149,
    price_suffix: "/month",
    description: "Unlimited cultivars, updated on every new certificate",
    generations: 0,
    stripe_price_id: "price_1UHjJWGqTruSqV8TePctYzO5",
    stripe_payment_link: "https://buy.stripe.com/00waEXafv2l03a2bDC1ND3z",
    stripe_mode: "subscription",
    tier: "pro",
    brand: "strainchain",
    features: [
      "Unlimited cultivars and passports",
      "Auto-updates on every new CoA",
      "Lineage and batch history across the full library",
      "Discrepancies surfaced rather than smoothed over",
      "Export or withdraw your record at any time",
    ],
    cta: "Start a Farm Plan",
  },
  {
    // Created by Z in Stripe 2026-09-29 (prod_VLiM8xIrFVFa1M). Priced per SKU;
    // the Payment Link allows 1–25 SKUs, the gated checkout sells one.
    // Listed 2026-09-29: also on the pricing grid and in PUBLIC_PLAN_IDS, not
    // only /made-in-usa-claim-file. Own "musa" brand since 2026-09-30 (Z's
    // choice): the pricing page shows it in its own section, not under QRON.
    id: "musa_claim_file",
    brand: "musa",
    name: "Made in USA Claim File",
    price: 299,
    price_suffix: " per SKU",
    description:
      "Substantiation support for one product's Made in USA claim. Not legal advice.",
    generations: 0,
    stripe_price_id: "price_1UL0vVGqTruSqV8T5WYjrq6i",
    stripe_payment_link: "https://buy.stripe.com/9B68wPgDTcZE8umgXW1ND3H",
    stripe_mode: "payment",
    tier: "pro",
    listed: true,
    features: [
      "Origin records for one SKU",
      "Bill-of-materials origin attestations from your suppliers",
      "A signed attestation anyone can verify",
      "Substantiation support, not legal advice",
    ],
    cta: "Start my claim file",
  },
  {
    // Created by Z in Stripe 2026-09-29. One engagement, base scope 10 SKUs;
    // larger scopes are quoted. The Payment Link collects company name, SKU
    // count, address and tax ID for the invoice; listed 2026-09-29, so the
    // gated checkout and the pricing grid sell it too.
    id: "musa_audit_bundle",
    brand: "musa",
    name: "Made in USA Claim File — Audit Bundle",
    price: 2500,
    price_suffix: " per engagement",
    description:
      "Claim files for up to 10 SKUs in one engagement. Larger scopes quoted separately. Not legal advice.",
    generations: 0,
    stripe_price_id: "price_1UL15AGqTruSqV8TQHP3yNiR",
    stripe_payment_link: "https://buy.stripe.com/fZucN52N35xcaCufTS1ND3I",
    stripe_mode: "payment",
    tier: "pro",
    listed: true,
    features: [
      "Claim files for up to 10 SKUs",
      "One engagement, invoiced to your company",
      "Larger scopes quoted separately",
      "Substantiation support, not legal advice",
    ],
    cta: "Buy the audit bundle",
  },
];

export const PUBLIC_PLAN_IDS = [
  "free",
  "qron_launch",
  "starter",
  "creator",
  "dpp_readiness",
  "strainchain_passport",
  "musa_claim_file",
  "musa_audit_bundle",
] as const;

export function isPurchasable(plan: Plan): boolean {
  return (
    plan.price === 0 ||
    Boolean(plan.stripe_price_id || plan.stripe_payment_link)
  );
}

export function listedPlans(
  brand: "qron" | "strainchain" | "musa" = "qron"
): Plan[] {
  const pub = new Set<string>(PUBLIC_PLAN_IDS);
  return PLANS.filter(
    p =>
      pub.has(p.id) &&
      (p.brand ?? "qron") === brand &&
      isPurchasable(p) &&
      p.listed !== false
  );
}

export const DPP_OFFER_KEY = "dpp_readiness_2026";

export function planById(id: PlanId): Plan | undefined {
  return PLANS.find(p => p.id === id);
}

export const GATED_CHECKOUT_ORIGIN = "https://authichain.com";

export function gatedCheckoutUrl(id: PlanId): string {
  return `${GATED_CHECKOUT_ORIGIN}/checkout/${id}`;
}

export function planPaymentLink(id: PlanId): string | undefined {
  const plan = planById(id);
  if (!plan || !(plan.stripe_price_id || plan.stripe_payment_link))
    return undefined;
  return gatedCheckoutUrl(id);
}

export function planStripePaymentLink(id: PlanId): string | undefined {
  return planById(id)?.stripe_payment_link;
}

export function planUsd(id: PlanId): number {
  const plan = planById(id);
  if (!plan) throw new Error(`plans.ts has no ${id}`);
  return plan.price;
}

export function planByStripePriceId(
  priceId: string | null | undefined
): Plan | undefined {
  if (!priceId) return undefined;
  return PLANS.find(p => p.stripe_price_id === priceId);
}

export function planByAmountCents(
  amountCents: number | null | undefined
): Plan | undefined {
  if (amountCents == null || !Number.isFinite(amountCents)) return undefined;
  const dollars = amountCents / 100;
  const matches = PLANS.filter(p => p.stripe_price_id && p.price === dollars);
  return matches.length === 1 ? matches[0] : undefined;
}

export const PLAN_CREDITS: Record<PlanId, number> = {
  free: 5,
  starter: 100,
  creator: 500,
  qron_launch: 100,
  studio: 2000,
  business: 999999,
  theater_1: 5000,
  theater_3: 999999,
  dpp_readiness: 50,
  strainchain_passport: 0,
  strainchain_farm: 0,
  musa_claim_file: 0,
  musa_audit_bundle: 0,
  enterprise_compliance: 0,
};

export const PLAN_TIER: Record<PlanId, "free" | "pro" | "enterprise"> = {
  free: "free",
  starter: "pro",
  creator: "pro",
  qron_launch: "pro",
  studio: "pro",
  business: "enterprise",
  theater_1: "enterprise",
  theater_3: "enterprise",
  dpp_readiness: "pro",
  strainchain_passport: "pro",
  strainchain_farm: "pro",
  musa_claim_file: "pro",
  musa_audit_bundle: "pro",
  enterprise_compliance: "enterprise",
};

/**
 * Entitlement for /dashboard/compliance (src/lib/compliance-access.ts): a
 * profile whose subscription_plan is this id and whose subscription_status is
 * active or trialing.
 *
 * Deliberately NOT in PLANS yet: it has no price. isPurchasable() treats a
 * price of 0 as free, so a placeholder entry would make the tier claimable
 * for nothing. To sell it, create the Stripe price, then add a PLANS entry
 * with the real price, stripe_price_id and stripe_mode: "subscription".
 * Until then planById() returns undefined and /checkout refuses it.
 */
export const COMPLIANCE_PLAN_ID: PlanId = "enterprise_compliance";
