/**
 * AuthiChain pricing — single source of truth.
 *
 * Two product clusters reflecting two distinct buyers:
 *   - B2B brand-protection (AuthiChain + StrainChain + GovChain): same SKUs,
 *     brand attribution via Stripe `metadata.brand`.
 *   - QRON SMB (qron.space): separate SKUs, separate quotas (generations/mo
 *     vs authentications/mo).
 *
 * Plus a contract pilot track:
 *   - $2,500 one-time setup fee via service-order flow (`contract_setup`).
 *   - Recurring leg reuses `b2b_professional` ($499/mo, 10K calls/mo).
 *
 * Spec: docs/superpowers/specs/2026-04-28-pricing-reconciliation-design.md
 */

export const B2B_PLANS = {
  starter: {
    product: "b2b_starter",
    name: "AuthiChain Starter",
    monthlyCents: 19_900,
    quota: 500,
  },
  professional: {
    product: "b2b_professional",
    name: "AuthiChain Professional",
    monthlyCents: 49_900,
    quota: 10_000,
  },
  enterprise: {
    product: "b2b_enterprise",
    name: "AuthiChain Enterprise",
    monthlyCents: 99_900,
    quota: 25_000,
  },
} as const;

export const QRON_PLANS = {
  launch_pack: {
    product: "qron_launch_pack",
    name: "QRON Launch Pack",
    oneTimeCents: 3_900,
    portals: 3,
  },
  studio: {
    product: "qron_studio",
    name: "QRON Studio",
    monthlyCents: 4_900,
    generationsPerMonth: 20,
  },
  studio_pro: {
    product: "qron_studio_pro",
    name: "QRON Studio Pro",
    monthlyCents: 9_900,
    generationsPerMonth: -1, // -1 = unlimited
  },
} as const;

export const CONTRACT = {
  setupProduct: "contract_setup",
  setupCents: 250_000,
  /** Recurring leg reuses the B2B Professional SKU. */
  recurringPlan: "professional",
} as const;

export const B2B_BRANDS = ["authichain", "strainchain", "govchain"] as const;

export type B2BBrand = (typeof B2B_BRANDS)[number];
export type B2BPlanKey = keyof typeof B2B_PLANS;
export type QronPlanKey = keyof typeof QRON_PLANS;
export type AnyPlanKey = B2BPlanKey | QronPlanKey;

/**
 * Maps Stripe price IDs to plan keys. Populated AFTER
 * `scripts/setup-stripe-products.ts` runs and emits real IDs.
 *
 * Webhook plan detection consults this lookup before falling back to
 * amount-based heuristics.
 */
export const STRIPE_PRICE_TO_PLAN: Record<string, AnyPlanKey | "contract_setup"> = {
  // Filled in by scripts/setup-stripe-products.ts output. Example:
  // "price_1ABC...": "starter",
};

/** Returns the monthly cents for a B2B plan. */
export function getMonthlyAmountCents(plan: B2BPlanKey): number {
  return B2B_PLANS[plan].monthlyCents;
}

/** Returns annual cents = monthly * 12 with a 20% discount, rounded. */
export function getAnnualAmountCents(plan: B2BPlanKey): number {
  return Math.round(B2B_PLANS[plan].monthlyCents * 12 * 0.8);
}

/** Returns the per-month quota for a B2B plan (used by the webhook to set monthlyQuota). */
export function getPlanQuota(plan: B2BPlanKey): number {
  return B2B_PLANS[plan].quota;
}

/** Looks up a Stripe price ID; undefined if unrecognized. */
export function lookupPlanByPriceId(
  priceId: string,
): AnyPlanKey | "contract_setup" | undefined {
  return STRIPE_PRICE_TO_PLAN[priceId];
}
