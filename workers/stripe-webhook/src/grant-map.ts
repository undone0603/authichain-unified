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
]);

export function grantForPrice(priceId: string | null | undefined): Grant | null {
  if (!priceId || UNLISTED.has(priceId)) return null;
  return GRANT_BY_PRICE[priceId] ?? null;
}
