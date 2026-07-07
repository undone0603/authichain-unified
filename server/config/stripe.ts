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
 * Stripe Price IDs — canonical IDs from Stripe Dashboard.
 * Map: plan_id -> Stripe Price ID (monthly recurring)
 * Fallback to actual price IDs if env vars not set.
 */
export const STRIPE_PRICE_IDS: Record<string, string> = {
  authichain_basic: process.env.STRIPE_PRICE_BASIC ?? 'price_1TqPJfGqTruSqV8TAjbmz3jw',
  authichain_pro: process.env.STRIPE_PRICE_PRO ?? 'price_1TqPNvGqTruSqV8TirjBDQiY',
  authichain_enterprise: process.env.STRIPE_PRICE_ENTERPRISE ?? 'price_1TqPR8GqTruSqV8T5UvdFJ2q',
};

// Stripe Product IDs (for reference / metadata)
export const STRIPE_PRODUCT_IDS: Record<string, string> = {
  authichain_basic: 'prod_Uq5UN8KH4jK7iZ',
  authichain_pro: 'prod_Uq5ZuyAvjO09wl',
  authichain_enterprise: 'prod_Uq5cMaGKff2j5y',
};

// Webhook destination
export const STRIPE_WEBHOOK_URL = 'https://authichain.com/api/stripe/webhook';
export const STRIPE_WEBHOOK_DESTINATION_ID = 'we_1TqPVPGqTruSqV8Tg6AIYbsb';

// Lazy singleton — safe in serverless / edge environments
let _stripe: Stripe | null = null;
export function getStripe(): Stripe {
  if (!_stripe) {
    _stripe = new Stripe(STRIPE_CONFIG.secret_key, {
      apiVersion: STRIPE_CONFIG.api_version,
    });
  }
  return _stripe;
}

export function getPriceIdForPlan(planId: string): string {
  const id = STRIPE_PRICE_IDS[planId];
  if (!id) throw new Error(`Unknown plan: ${planId}`);
  return id;
}

export function getPlanFromPriceId(priceId: string): string | null {
  const entry = Object.entries(STRIPE_PRICE_IDS).find(([, v]) => v === priceId);
  return entry ? entry[0] : null;
}
