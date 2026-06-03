/**
 * AuthiChain Stripe Service (Production-Only)
 */
import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, { apiVersion: '2026-04-22.dahlia' as any });

export async function createRedemptionCode(params: { couponId: string; code?: string }) {
  return await stripe.promotionCodes.create({
    coupon: params.couponId,
    code: params.code || `QRON-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
    max_redemptions: 1,
  });
}
