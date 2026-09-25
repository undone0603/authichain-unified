// --- QRON Plans — mapped to real Stripe products/prices ---
// Products and prices are pre-created in the Stripe dashboard.
// priceId values are LIVE; keep in sync with Stripe.

export type PlanId =
  | "free"
  | "starter"
  | "creator"
  | "studio"
  | "business"
  | "theater_1"
  | "theater_3"
  | "dpp_readiness"
  | "strainchain_passport"
  | "strainchain_farm";

export interface Plan {
  id: PlanId;
  name: string;
  price: number;
  price_suffix?: string;
  description: string;
  generations: number; // 0 = unlimited
  stripe_price_id: string | null;
  stripe_payment_link?: string;
  stripe_mode: "payment" | "subscription" | null;
  tier: "free" | "pro" | "enterprise";
  features: string[];
  cta: string;
  highlighted?: boolean;
  /**
   * Brand surface this plan belongs to. Absent means QRON, which is what every
   * pre-existing plan is and what /pricing renders. A StrainChain SKU must not
   * appear on the QRON pricing page just because it gained a Stripe price.
   */
  brand?: "qron" | "strainchain";
}

export const PLANS: Plan[] = [
  {
    id: "free",
    name: "Free Trial",
    price: 0,
    description: "Try every Pro feature free for 7 days",
    generations: 0,
    stripe_price_id: null,
    stripe_mode: null,
    tier: "free",
    features: [
      "7-day free trial — full access",
      "All Pro generation modes",
      "Cancel anytime before it ends",
      "Card required · no charge during trial",
    ],
    cta: "Try Free for 7 Days",
  },
  {
    id: "starter",
    name: "Starter Pack",
    price: 29,
    description: "100 AI QR generations, never expire",
    generations: 100,
    // prod_VJR6xofjGFoP1j. The previous price (price_1TGOM9…) charged $49
    // for "QRON Single Design", and its link was not active on this account.
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
  },
  {
    id: "creator",
    name: "Creator Pack",
    price: 99,
    description: "500 AI QR generations — best value",
    generations: 500,
    // prod_VJR6imfy3FRa7z. The previous price (price_1TGAiZ…) charged $99.99
    // for "1000 Credits", and its link was not active on this account.
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
    generations: 0,
    stripe_price_id: "price_1TmDKQGqTruSqV8TvSILgzXM",
    stripe_payment_link: "https://buy.stripe.com/7sYdR95ZfcZEcKCfTS1ND3B",
    stripe_mode: "subscription",
    tier: "enterprise",
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
    name: "EU DPP Readiness Audit",
    price: 299,
    description: "One-time EU DPP readiness audit with self-serve activation",
    generations: 50,
    stripe_price_id: "price_1TwmD8GqTruSqV8TpAF8dfyA",
    stripe_payment_link: "https://buy.stripe.com/bJe7sLgDTaRwh0S9vu1ND0c",
    stripe_mode: "payment",
    tier: "pro",
    features: [
      "Written EU DPP readiness assessment",
      "Self-serve merchant activation",
      "50 workspace generations to publish first DPP",
      "$299 credited toward AuthiChain Basic on conversion",
    ],
    cta: "Start DPP Readiness Audit",
  },
  // --- StrainChain passport SKUs -------------------------------------------
  //
  // Live Stripe prices (prod_VIJqbTJOoGT1I3 / prod_VIJxYUXwNWQzh4). Passport
  // has a published Payment Link; Farm Plan uses email-gated checkout on
  // authichain.com. See docs/strategy/strainchain-genetics-passport.md §3.
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
];

/**
 * A plan can be shown and sold only when a real Stripe price backs it.
 *
 * /pricing previously rendered every entry in PLANS and emitted them all into
 * JSON-LD offers, so a plan without a price id would have advertised a price
 * — to shoppers and to search engines — that nothing could actually charge.
 */
export function isPurchasable(plan: Plan): boolean {
  return (
    plan.price === 0 ||
    Boolean(plan.stripe_price_id || plan.stripe_payment_link)
  );
}

/** Plans safe to display on a given brand's pricing page. */
export function listedPlans(brand: "qron" | "strainchain" = "qron"): Plan[] {
  return PLANS.filter(p => (p.brand ?? "qron") === brand && isPurchasable(p));
}

/** Stripe metadata.offer value for the autonomous DPP revenue loop. */
export const DPP_OFFER_KEY = "dpp_readiness_2026";

/** Look up a live catalogue plan by id. */
export function planById(id: PlanId): Plan | undefined {
  return PLANS.find(p => p.id === id);
}

/**
 * Stable, bot-safe checkout URL Marketing, sites and outreach link to.
 *
 * GET renders a confirm page (never calls Stripe); only a human POST of the
 * confirm form creates a Checkout Session. Served by workers/authichain-com.
 */
export const GATED_CHECKOUT_ORIGIN = "https://authichain.com";

export function gatedCheckoutUrl(id: PlanId): string {
  return `${GATED_CHECKOUT_ORIGIN}/checkout/${id}`;
}

/**
 * Public checkout link for a catalogue plan.
 *
 * Used to return the raw buy.stripe.com Payment Link, but opening a Payment
 * Link on GET creates a Checkout Session — so link scanners, email security
 * gateways and chat previews created ~28 unpaid sessions/day. Every public
 * surface now gets the gated authichain.com/checkout/<plan> URL instead.
 * Use `planStripePaymentLink()` only server-side after a human confirmed.
 */
export function planPaymentLink(id: PlanId): string | undefined {
  const plan = planById(id);
  if (!plan || !(plan.stripe_price_id || plan.stripe_payment_link)) {
    return undefined;
  }
  return gatedCheckoutUrl(id);
}

/** Raw Stripe Payment Link. Never render this in HTML/email (GET opens a session). */
export function planStripePaymentLink(id: PlanId): string | undefined {
  return planById(id)?.stripe_payment_link;
}

/** Dollar amount for a catalogue plan. Charge source of truth is this file. */
export function planUsd(id: PlanId): number {
  const plan = planById(id);
  if (!plan) throw new Error(`plans.ts has no ${id}`);
  return plan.price;
}

/** Look up a live catalogue plan by Stripe price ID. */
export function planByStripePriceId(
  priceId: string | null | undefined
): Plan | undefined {
  if (!priceId) return undefined;
  return PLANS.find(p => p.stripe_price_id === priceId);
}

/** Match a paid amount to a unique live catalogue price (cents). */
export function planByAmountCents(
  amountCents: number | null | undefined
): Plan | undefined {
  if (amountCents == null || !Number.isFinite(amountCents)) return undefined;
  const dollars = amountCents / 100;
  const matches = PLANS.filter(p => p.stripe_price_id && p.price === dollars);
  return matches.length === 1 ? matches[0] : undefined;
}

// Credit grants per plan (added to generations_limit on purchase)
export const PLAN_CREDITS: Record<PlanId, number> = {
  free: 0,
  starter: 100,
  creator: 500,
  studio: 2000,
  business: 999999,
  theater_1: 5000,
  theater_3: 999999,
  dpp_readiness: 50,
  strainchain_passport: 0,
  strainchain_farm: 0,
};

// Tier granted per plan
export const PLAN_TIER: Record<PlanId, "free" | "pro" | "enterprise"> = {
  free: "free",
  starter: "pro",
  creator: "pro",
  studio: "pro",
  business: "enterprise",
  theater_1: "enterprise",
  theater_3: "enterprise",
  dpp_readiness: "pro",
  strainchain_passport: "pro",
  strainchain_farm: "pro",
};
