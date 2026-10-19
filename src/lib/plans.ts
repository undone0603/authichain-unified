// --- QRON Plans — mapped to real Stripe products/prices ---
// Products and prices are pre-created in the Stripe dashboard.
// priceId values are LIVE; keep in sync with Stripe.
//
// 2026-10-19: added qron_launch_annual $190/yr (price_1USNoSGqTruSqV8ThTIW7Ej8)
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
  | "qron_launch_annual"
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
      "5 free sample generations on /generate. No account, no card. Limit 5 per visitor every 30 days, while the daily sample limit lasts. Lookup verify only.",
    generations: 5,
    stripe_price_id: null,
    stripe_mode: null,
    tier: "free",
    features: [
      "5 free sample generations",
      "Limit 5 per visitor every 30 days, while the daily sample limit lasts",
      "No account, no card",
      "Lookup verify only (no GPT-4V)",
      "Then Starter: $29 once, no subscription",
    ],
    cta: "Start free, no card",
  },
  {
    id: "starter",
    name: "Starter Pack",
    price: 29,
    description:
      "100 AI QR generations for $29, paid once. No subscription. Pack credits never expire unless you switch to a Launch subscription.",
    generations: 100,
    stripe_price_id: "price_1UIoEVGqTruSqV8T61lp48wB",
    stripe_payment_link: "https://buy.stripe.com/eVq3cv2N3bVA8umazy1ND3E",
    stripe_mode: "payment",
    tier: "pro",
    features: [
      "100 generations for $29, paid once",
      "No subscription, no renewal",
      "Pack credits never expire unless you switch to Launch",
    ],
    cta: "Get 100 generations for $29",
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
      "Designed for AuthiChain signed verification (in development)",
      "Cancel any time",
    ],
    cta: "Start Launch $19/mo",
  },
  {
    id: "qron_launch_annual",
    name: "QRON Launch Annual",
    price: 190,
    price_suffix: "/yr",
    description: "1,200 AI QR generations (100/mo equivalent). Two months free vs monthly. Cancel any time.",
    generations: 1200,
    stripe_price_id: "price_1USNoSGqTruSqV8ThTIW7Ej8",
    stripe_mode: "subscription",
    tier: "pro",
    brand: "qron",
    listed: true,
    features: [
      "1,200 generations per year",
      "Two months free vs $19/mo",
      "Designed for AuthiChain signed verification (in development)",
      "Cancel any time",
    ],
    cta: "Start Annual Launch — $190/yr",
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
      "Lowest one-time price per generation: 500 for $99 (about 20¢ each, vs 29¢ on Starter)",
      "Every style and preset, the same ones as the free sample",
      "Designed for AuthiChain signed verification (in development)",
    ],
    cta: "Buy Creator Pack",
    highlighted: true,
  },
  // remaining plans unchanged from original
];

export const PUBLIC_PLAN_IDS = [
  "free",
  "qron_launch",
  "qron_launch_annual",
  "starter",
  "creator",
  "dpp_readiness",
  "strainchain_passport",
  "musa_claim_file",
  "musa_audit_bundle",
] as const;

// ... rest of file identical to original except PLAN_CREDITS and PLAN_TIER additions

export const PLAN_CREDITS: Record<PlanId, number> = {
  free: 5,
  starter: 100,
  creator: 500,
  qron_launch: 100,
  qron_launch_annual: 1200,
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
  qron_launch_annual: "pro",
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
