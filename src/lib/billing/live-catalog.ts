/**
 * Public catalog freeze — 2026-09-28, widened 2026-09-29 with the two
 * Made in USA compliance SKUs ($299/SKU and $2,500/engagement).
 * Only these SKUs may appear on /pricing, /onboard, /generate, /checkout.
 * First stranger SKU is QRON Starter $29. Do not list $1 or Seal $99.
 *
 * Live Stripe acct_1SXIyEGqTruSqV8T. Price IDs must match src/lib/plans.ts.
 */
import {
  PLAN_CREDITS,
  PUBLIC_PLAN_IDS,
  planById,
  planByStripePriceId,
  type PlanId,
} from "../plans";

export const FIRST_STRANGER_SKU: PlanId = "starter";

export const FOUNDER_EMAILS = [
  "undone.k@gmail.com",
  "authichain@gmail.com",
] as const;

export type PublicPlanId = (typeof PUBLIC_PLAN_IDS)[number];

export const LIVE_PRICE_MAP: Record<
  Exclude<PublicPlanId, "free">,
  {
    priceId: string;
    productId: string;
    mode: "payment" | "subscription";
    grant: number;
    stripeLink?: string;
  }
> = {
  qron_launch: {
    priceId: "price_1UJjzPGqTruSqV8TmhFSc8vh",
    productId: "prod_UVdvzB03BvV4CU",
    mode: "subscription",
    grant: 100,
  },
  starter: {
    priceId: "price_1UIoEVGqTruSqV8T61lp48wB",
    productId: "prod_VJR6xofjGFoP1j",
    mode: "payment",
    grant: 100,
    stripeLink: "https://buy.stripe.com/eVq3cv2N3bVA8umazy1ND3E",
  },
  creator: {
    priceId: "price_1UIoEYGqTruSqV8TCXTNipvh",
    productId: "prod_VJR6imfy3FRa7z",
    mode: "payment",
    grant: 500,
    stripeLink: "https://buy.stripe.com/aFa8wP0EV2l08um8rq1ND3F",
  },
  dpp_readiness: {
    priceId: "price_1TwmD8GqTruSqV8TpAF8dfyA",
    productId: "prod_UwfYVM0TYpdg4J",
    mode: "payment",
    grant: 50,
    stripeLink: "https://buy.stripe.com/bJe7sLgDTaRwh0S9vu1ND0c",
  },
  strainchain_passport: {
    priceId: "price_1UHjCZGqTruSqV8T35M6AmoJ",
    productId: "prod_VIJqbTJOoGT1I3",
    mode: "payment",
    grant: 0,
    stripeLink: "https://buy.stripe.com/cNi9ATdrH4t811U4ba1ND3y",
  },
  made_in_usa_claim_file: {
    priceId: "price_1UL0vVGqTruSqV8T5WYjrq6i",
    productId: "prod_VLiM8xIrFVFa1M",
    mode: "payment",
    grant: 0,
    stripeLink: "https://buy.stripe.com/9B68wPgDTcZE8umgXW1ND3H",
  },
  made_in_usa_audit_bundle: {
    priceId: "price_1UL15AGqTruSqV8TQHP3yNiR",
    productId: "prod_VLiWxjx4pEDfmP",
    mode: "payment",
    grant: 0,
    stripeLink: "https://buy.stripe.com/fZucN52N35xcaCufTS1ND3I",
  },
};

/** Exist in Stripe. Never put on /pricing, /onboard, or LOOP-03 copy. */
export const UNLISTED_SMOKE = {
  first_dollar_human: "price_1UIRF6GqTruSqV8TRjDYCkpi",
  first_dollar_agent: "price_1UIRF7GqTruSqV8THhlI3zxp",
  seal_monthly: "price_1UJbwzGqTruSqV8TJlaINJyW",
} as const;

const PUBLIC_SET = new Set<string>(PUBLIC_PLAN_IDS);
const UNLISTED_PRICE_SET = new Set<string>(Object.values(UNLISTED_SMOKE));

export function isFounderEmail(email?: string | null): boolean {
  const e = (email || "").toLowerCase().trim();
  return (FOUNDER_EMAILS as readonly string[]).includes(e);
}

export function isPublicPlanId(id: string): id is PublicPlanId {
  return PUBLIC_SET.has(id);
}

export function publicPlanOrNull(id: string): PlanId | null {
  return isPublicPlanId(id) ? id : null;
}

export function isUnlistedSmokePrice(
  priceId: string | null | undefined
): boolean {
  return Boolean(priceId && UNLISTED_PRICE_SET.has(priceId));
}

/**
 * Grant table for both webhook rails. Farm is live Stripe but not public;
 * still grant so a paid Farm session is not lost. Unlisted smoke = ignore.
 */
export function grantForPriceId(
  priceId: string | null | undefined
): { planId: PlanId; grant: number } | null {
  if (!priceId || isUnlistedSmokePrice(priceId)) return null;
  const plan = planByStripePriceId(priceId);
  if (!plan) return null;
  if (!isPublicPlanId(plan.id) && plan.id !== "strainchain_farm") return null;
  return { planId: plan.id, grant: PLAN_CREDITS[plan.id] };
}

export function liveBypassLink(id: PlanId): string | undefined {
  const row = LIVE_PRICE_MAP[id as keyof typeof LIVE_PRICE_MAP];
  return row?.stripeLink ?? planById(id)?.stripe_payment_link;
}

export function publicCheckoutHref(id: PublicPlanId): string {
  if (id === "free") return "https://qron.space/generate";
  return `https://authichain.com/checkout/${id}`;
}
