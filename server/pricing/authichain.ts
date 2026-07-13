/**
 * AuthiChain Plans — canonical source of truth for all pricing.
 * Amounts in cents (USD).
 */
export const AUTHICHAIN_PLANS = {
  basic: {
    id: 'authichain_basic',
    name: 'AuthiChain Basic',
    monthly_usd: 14900,
    description: 'Up to 1,000 seals/mo, 5,000 verifications/mo, 1 brand domain',
  },
  pro: {
    id: 'authichain_pro',
    name: 'AuthiChain Pro',
    monthly_usd: 49900,
    description: 'Up to 10,000 seals/mo, 50,000 verifications/mo, 3 brand domains, certificate minting',
  },
  enterprise: {
    id: 'authichain_enterprise',
    name: 'AuthiChain Enterprise',
    monthly_usd: 149900,
    description: 'Unlimited seals & verifications, all brand domains, StrainChain + GovChain, dedicated support',
  },
} as const;

export type PlanKey = keyof typeof AUTHICHAIN_PLANS;
export type PlanId = (typeof AUTHICHAIN_PLANS)[PlanKey]['id'];

/** Lookup a plan by its string id */
export function getPlanById(id: string) {
  return Object.values(AUTHICHAIN_PLANS).find((p) => p.id === id) ?? null;
}

/** Map plan_id -> monthly price in cents */
export const PLAN_PRICE_MAP: Record<PlanId, number> = {
  authichain_basic: AUTHICHAIN_PLANS.basic.monthly_usd,
  authichain_pro: AUTHICHAIN_PLANS.pro.monthly_usd,
  authichain_enterprise: AUTHICHAIN_PLANS.enterprise.monthly_usd,
};
