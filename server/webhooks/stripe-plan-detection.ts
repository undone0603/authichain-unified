import {
  B2B_PLANS,
  lookupPlanByPriceId,
  type B2BPlanKey,
} from "../../shared/pricing";

/** B2B plans only; webhook-side helper. */
function isB2BPlan(key: string): key is B2BPlanKey {
  return key in B2B_PLANS;
}

/**
 * Amount-based fallback when price ID is unknown.
 * Thresholds tuned for the new B2B pricing:
 *   $199 Starter (19_900) / $499 Professional (49_900) / $999 Enterprise (99_900).
 */
function detectPlanFromAmount(amountCents: number): B2BPlanKey {
  if (amountCents >= 70_000) return "enterprise";
  if (amountCents >= 30_000) return "professional";
  return "starter";
}

/**
 * Resolves a Stripe price ID + invoiced amount to a B2B plan key.
 * Tries the configured lookup table first, then falls back to amount.
 * Non-B2B keys (e.g. QRON or `contract_setup`) cause a fall-through to
 * amount-based detection — webhook subscription events should always
 * resolve to a B2B plan because that's what `subscriptions.plan` stores.
 */
export function detectPlan(
  priceId: string | null | undefined,
  amountCents: number,
): B2BPlanKey {
  if (priceId) {
    const known = lookupPlanByPriceId(priceId);
    if (known && isB2BPlan(known)) return known;
  }
  return detectPlanFromAmount(amountCents);
}
