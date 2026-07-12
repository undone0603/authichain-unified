// server/config/stripe.ts
// Centralized Stripe price ID mapping for all AuthiChain brands and plans.
// All getPriceId calls resolve from environment variables set at runtime.

import Stripe from 'stripe';

let _stripe: Stripe | null = null;

/** Lazy singleton Stripe client — reads STRIPE_SECRET_KEY at call time (safe for edge/build). */
export function getStripe(): Stripe {
  if (!_stripe) {
    const secretKey = process.env.STRIPE_SECRET_KEY;
    if (!secretKey) throw new Error('STRIPE_SECRET_KEY not configured');
    _stripe = new Stripe(secretKey, { apiVersion: '2026-05-27.dahlia' as const });
  }
  return _stripe;
}

export type PlanId =
  | 'authichain_basic'
  | 'authichain_pro'
  | 'authichain_enterprise'
  | 'strainchain_basic'
  | 'strainchain_pro'
  | 'strainchain_enterprise'
  | 'govchain_basic'
  | 'govchain_pro'
  | 'govchain_enterprise'
  | 'qron_basic'
  | 'qron_pro';

export interface PlanConfig {
  id: PlanId;
  name: string;
  brand: string;
  mrr_usd: number;
  scan_limit: number | null; // null = unlimited
  features: string[];
}

export const PLAN_CONFIGS: Record<PlanId, PlanConfig> = {
  authichain_basic: {
    id: 'authichain_basic',
    name: 'Basic',
    brand: 'authichain.com',
    mrr_usd: 49,
    scan_limit: 500,
    features: ['500 scans/mo', 'QR seals', 'Basic analytics', 'Email support'],
  },
  authichain_pro: {
    id: 'authichain_pro',
    name: 'Pro',
    brand: 'authichain.com',
    mrr_usd: 149,
    scan_limit: 5000,
    features: ['5,000 scans/mo', 'NFT certificates', 'Polygon anchoring', 'API access', 'Priority support'],
  },
  authichain_enterprise: {
    id: 'authichain_enterprise',
    name: 'Enterprise',
    brand: 'authichain.com',
    mrr_usd: 499,
    scan_limit: null,
    features: ['Unlimited scans', 'Custom branding', 'Dedicated CSM', 'SLA', 'SSO', 'Bulk onboarding'],
  },
  strainchain_basic: {
    id: 'strainchain_basic',
    name: 'Basic',
    brand: 'strainchain.io',
    mrr_usd: 79,
    scan_limit: 1000,
    features: ['METRC integration', '1,000 scans/mo', 'Batch tracking', 'Compliance reports'],
  },
  strainchain_pro: {
    id: 'strainchain_pro',
    name: 'Pro',
    brand: 'strainchain.io',
    mrr_usd: 199,
    scan_limit: 10000,
    features: ['Full METRC sync', '10,000 scans/mo', 'Multi-facility', 'API', 'Audit trail'],
  },
  strainchain_enterprise: {
    id: 'strainchain_enterprise',
    name: 'Enterprise',
    brand: 'strainchain.io',
    mrr_usd: 599,
    scan_limit: null,
    features: ['Unlimited', 'White-label', 'DSCSA-ready', 'Dedicated support'],
  },
  govchain_basic: {
    id: 'govchain_basic',
    name: 'Basic',
    brand: 'govchain.us',
    mrr_usd: 99,
    scan_limit: 1000,
    features: ['FedRAMP-aligned', '1,000 verifications/mo', 'Audit logs', 'SBIR-ready docs'],
  },
  govchain_pro: {
    id: 'govchain_pro',
    name: 'Pro',
    brand: 'govchain.us',
    mrr_usd: 299,
    scan_limit: 10000,
    features: ['10,000 verifications/mo', 'DoD-grade chain of custody', 'API', 'Compliance exports'],
  },
  govchain_enterprise: {
    id: 'govchain_enterprise',
    name: 'Enterprise',
    brand: 'govchain.us',
    mrr_usd: 999,
    scan_limit: null,
    features: ['Unlimited', 'Custom integrations', 'Dedicated infra', 'SLA'],
  },
  qron_basic: {
    id: 'qron_basic',
    name: 'Basic',
    brand: 'qron.space',
    mrr_usd: 29,
    scan_limit: 2000,
    features: ['2,000 QR scans/mo', 'Dynamic QR', 'Analytics', 'Custom redirects'],
  },
  qron_pro: {
    id: 'qron_pro',
    name: 'Pro',
    brand: 'qron.space',
    mrr_usd: 79,
    scan_limit: 20000,
    features: ['20,000 QR scans/mo', 'Blockchain anchor', 'Webhooks', 'API', 'White-label'],
  },
};

/**
 * Returns the Stripe Price ID for a given plan.
 * Reads from environment variables at call time (safe for edge runtime).
 */
export function getPriceId(planId: PlanId | string): string {
  const map: Record<string, string | undefined> = {
    authichain_basic: process.env.STRIPE_PRICE_AUTHICHAIN_BASIC || process.env.STRIPE_PRICE_BASIC,
    authichain_pro: process.env.STRIPE_PRICE_AUTHICHAIN_PRO || process.env.STRIPE_PRICE_PRO,
    authichain_enterprise: process.env.STRIPE_PRICE_AUTHICHAIN_ENTERPRISE || process.env.STRIPE_PRICE_ENTERPRISE,
    strainchain_basic: process.env.STRIPE_PRICE_STRAINCHAIN_BASIC,
    strainchain_pro: process.env.STRIPE_PRICE_STRAINCHAIN_PRO,
    strainchain_enterprise: process.env.STRIPE_PRICE_STRAINCHAIN_ENTERPRISE,
    govchain_basic: process.env.STRIPE_PRICE_GOVCHAIN_BASIC,
    govchain_pro: process.env.STRIPE_PRICE_GOVCHAIN_PRO,
    govchain_enterprise: process.env.STRIPE_PRICE_GOVCHAIN_ENTERPRISE,
    qron_basic: process.env.STRIPE_PRICE_QRON_BASIC,
    qron_pro: process.env.STRIPE_PRICE_QRON_PRO,
  };

  const priceId = map[planId];
  if (!priceId) {
    throw new Error(`No Stripe price ID configured for plan: ${planId}. Set STRIPE_PRICE_${planId.toUpperCase()} env var.`);
  }
  return priceId;
}

/** Get MRR for a plan (used for CRM deal value). */
export function getMrr(planId: PlanId | string): number {
  return PLAN_CONFIGS[planId as PlanId]?.mrr_usd ?? 0;
}

/** Map Stripe Price ID back to a plan ID. */
export function getPlanFromPriceId(priceId: string): PlanId | null {
  for (const [planId, config] of Object.entries(PLAN_CONFIGS)) {
    try {
      if (getPriceId(planId) === priceId) return planId as PlanId;
    } catch {
      // env var not set for this plan, skip
    }
  }
  return null;
}
