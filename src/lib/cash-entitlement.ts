/** Cash SKUs that may grant workspace generations. Credit is hard zero until a Stripe customer-balance object exists. */
export const CASH_ENTITLEMENTS = {
  dpp_readiness: { generations: 50, amountCents: 29900, creditCents: 0 },
  strainchain_passport: { generations: 1, amountCents: 4900, creditCents: 0 },
} as const;

export type CashSku = keyof typeof CASH_ENTITLEMENTS;

export function isCashSku(sku: string): sku is CashSku {
  return sku === "dpp_readiness" || sku === "strainchain_passport";
}

export function grantForSku(sku: string): {
  sku: CashSku;
  generations: number;
  amountCents: number;
  creditCents: 0;
} | null {
  if (!isCashSku(sku)) return null;
  const row = CASH_ENTITLEMENTS[sku];
  return {
    sku,
    generations: row.generations,
    amountCents: row.amountCents,
    creditCents: 0,
  };
}

export const CASH_SUCCESS_URL =
  "https://authichain.com/onboard?session_id={CHECKOUT_SESSION_ID}";
export const CASH_CANCEL_URL = "https://authichain.com/pricing";
