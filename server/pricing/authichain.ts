/**
 * Retired parallel catalogue.
 * Public prices live in src/lib/plans.ts.
 * AuthiChain Basic, Pro, and Enterprise are not public offers.
 */

export const AUTHICHAIN_PLANS = {} as const;

export type PlanKey = never;
export type PlanId = never;

export function getPlanById(_id: string): null {
  return null;
}

export const PLAN_PRICE_MAP = {} as const;
