/**
 * Price → grant map for the Cloudflare webhook rail.
 * Keep in lockstep with src/lib/plans.ts PLAN_CREDITS + live-catalog.ts.
 * The apex rail (src/app/api/stripe/webhook) already calls provisionPurchase.
 * This Worker must grant the same thing or a paid session is lost.
 */

export type Grant = {
  plan: string;
  brand: "qron" | "strainchain" | "authichain";
  generations: number;
  refillOnInvoicePaid: boolean;
};

export const GRANT_BY_PRICE: Record<string, Grant> = {
  price_1UJjzPGqTruSqV8TmhFSc8vh: {
    plan: "qron_launch",
    brand: "qron",
    generations: 100,
    refillOnInvoicePaid: true,
  },
  price_1UIoEVGqTruSqV8T61lp48wB: {
    plan: "starter",
    brand: "qron",
    generations: 100,
    refillOnInvoicePaid: false,
  },
  price_1UIoEYGqTruSqV8TCXTNipvh: {
    plan: "creator",
    brand: "qron",
    generations: 500,
    refillOnInvoicePaid: false,
  },
  price_1TwmD8GqTruSqV8TpAF8dfyA: {
    plan: "dpp_readiness",
    brand: "authichain",
    generations: 50,
    refillOnInvoicePaid: false,
  },
  price_1UHjCZGqTruSqV8T35M6AmoJ: {
    plan: "strainchain_passport",
    brand: "strainchain",
    generations: 0,
    refillOnInvoicePaid: false,
  },
  price_1UHjJWGqTruSqV8TePctYzO5: {
    plan: "strainchain_farm",
    brand: "strainchain",
    generations: 0,
    refillOnInvoicePaid: true,
  },
};

const UNLISTED = new Set([
  "price_1UIRF6GqTruSqV8TRjDYCkpi",
  "price_1UIRF7GqTruSqV8THhlI3zxp",
  "price_1UJbwzGqTruSqV8TJlaINJyW",
  // Made in USA claim file and audit bundle. Live Stripe prices, no file grant.
  // Hold until the webhook delivers the claim PDF. Do not grant generations.
  "price_1UL0vVGqTruSqV8T5WYjrq6i",
  "price_1UL15AGqTruSqV8TQHP3yNiR",
]);

export function grantForPrice(priceId: string | null | undefined): Grant | null {
  if (!priceId || UNLISTED.has(priceId)) return null;
  return GRANT_BY_PRICE[priceId] ?? null;
}

/**
 * Growth loop identity per plan. Lockstep with src/lib/growth/loops.ts
 * GROWTH_LOOPS — this Worker deliberately duplicates catalogue constants rather
 * than importing src/lib (same reason GRANT_BY_PRICE is duplicated above).
 *
 * Plans absent here have no loop (creator, strainchain_farm, qron_launch) and
 * must not produce a purchase event.
 */
export type LoopIdentity = { loop: string; purchaseEvent: string };

export const LOOP_BY_PLAN: Record<string, LoopIdentity> = {
  starter: { loop: "loop_03_qron_starter", purchaseEvent: "purchase_starter_succeeded" },
  dpp_readiness: { loop: "loop_02_dpp_check", purchaseEvent: "purchase_dpp_succeeded" },
  strainchain_passport: {
    loop: "loop_01_passport_scan",
    purchaseEvent: "purchase_passport_succeeded",
  },
};

export function loopForPlan(plan: string | null | undefined): LoopIdentity | null {
  if (!plan) return null;
  return LOOP_BY_PLAN[plan] ?? null;
}

/** Lockstep with src/lib/billing/live-catalog.ts FOUNDER_EMAILS. */
export const FOUNDER_EMAILS = ["undone.k@gmail.com", "authichain@gmail.com"] as const;

export function isFounderEmail(email: string | null | undefined): boolean {
  const e = (email || "").toLowerCase().trim();
  return (FOUNDER_EMAILS as readonly string[]).includes(e);
}
