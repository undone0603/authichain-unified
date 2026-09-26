import {
  B2B_PLANS,
  lookupPlanByPriceId,
  type B2BPlanKey,
} from "../../shared/pricing";
import { planByStripePriceId } from "../../src/lib/plans";

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
 * Resolves a Stripe price ID + invoiced amount to a B2B plan key, or
 * `null` when the price is a live catalogue SKU (`src/lib/plans.ts`) or a
 * non-B2B lookup (QRON / contract_setup).
 *
 * `null` means: do not write `subscriptions.plan` as starter/pro/enterprise.
 * Farm $149/mo, Passport $49, DPP $299, and QRON packs used to land on
 * B2B starter via amount fallback.
 */
export function detectPlan(
  priceId: string | null | undefined,
  amountCents: number
): B2BPlanKey | null {
  if (priceId) {
    const known = lookupPlanByPriceId(priceId);
    if (known && isB2BPlan(known)) return known;
    if (planByStripePriceId(priceId)) return null;
    if (known) return null;
  }
  return detectPlanFromAmount(amountCents);
}
