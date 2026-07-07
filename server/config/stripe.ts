/**
 * Stripe configuration and singleton client.
 */
import Stripe from 'stripe';

export const STRIPE_CONFIG = {
  secret_key: process.env.STRIPE_SECRET_KEY!,
  webhook_secret: process.env.STRIPE_WEBHOOK_SECRET!,
  api_version: '2024-04-10' as const,
};

/**
 * Stripe Price IDs — set these after creating products in Stripe Dashboard.
 * Map: plan_id -> Stripe Price ID (monthly recurring)
 */
export const STRIPE_PRICE_IDS: Record<string, string> = {
  authichain_basic: process.env.STRIPE_PRICE_BASIC ?? '',
  authichain_pro: process.env.STRIPE_PRICE_PRO ?? '',
  authichain_enterprise: process.env.STRIPE_PRICE_ENTERPRISE ?? '',
};

// Lazy singleton — safe in serverless / edge environments
let _stripe: Stripe | null = null;

export function getStripe(): Stripe {
  if (!_stripe) {
    if (!STRIPE_CONFIG.secret_key) {
      throw new Error('STRIPE_SECRET_KEY env var is not set');
    }
    _stripe = new Stripe(STRIPE_CONFIG.secret_key, {
      apiVersion: STRIPE_CONFIG.api_version,
    });
  }
  return _stripe;
}

/**
 * Resolves a plan_id to its Stripe Price ID.
 * Throws if the mapping is missing (misconfigured env).
 */
export function getPriceId(plan_id: string): string {
  const priceId = STRIPE_PRICE_IDS[plan_id];
  if (!priceId) {
    throw new Error(
      `No Stripe Price ID configured for plan_id: ${plan_id}. ` +
      `Set STRIPE_PRICE_${plan_id.toUpperCase().replace('AUTHICHAIN_', '')} env var.`,
    );
  }
  return priceId;
}
