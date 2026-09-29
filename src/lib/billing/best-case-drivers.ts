/**
 * Best-case operating contract — 2026-09-28.
 * Encode so agents cannot drift. Not marketing copy.
 */
import { GRANT_BY_PRICE } from "../../../workers/stripe-webhook/src/grant-map";

export const ZERO_IDLE_SESSION_BURN = {
  rule: "GET_HEAD_NEVER_STRIPE",
  path: "/checkout",
  kill: "expired_unpaid_sessions_on_preview_or_buy_stripe_public_href",
} as const;

export const CREDIT_BREAKAGE = {
  starterGrant: 100,
  neverExpire: true,
  refillOnInvoicePaid: false,
  kill: "starter_becomes_monthly_or_expiry_or_unused_credit_refund",
} as const;

export const UNIFIED_GRANT_RAIL = {
  write: { generations_limit: "PLAN_CREDITS[plan]", generations_used: 0 },
  mode: "SET",
  neverIncrement: true,
  kill: "webhook_plus_equals_or_paid_with_zero_gens",
} as const;

const STARTER_PRICE = "price_1UIoEVGqTruSqV8T61lp48wB";
const LAUNCH_PRICE = "price_1UJjzPGqTruSqV8TmhFSc8vh";

export function assertBestCaseDrivers(): void {
  const starter = GRANT_BY_PRICE[STARTER_PRICE];
  const launch = GRANT_BY_PRICE[LAUNCH_PRICE];
  if (!starter || starter.generations !== 100 || starter.refillOnInvoicePaid) {
    throw new Error("CREDIT_BREAKAGE: starter must SET 100 and not refill");
  }
  if (!launch || !launch.refillOnInvoicePaid) {
    throw new Error("qron_launch must refill on invoice.paid");
  }
}
