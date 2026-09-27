/**
 * Plan entitlements. Quotas are product limits, not Stripe Price IDs.
 * Vision (GPT-4V) is never included in authichain_basic.
 */
export type EntitlementId = "authichain_basic" | "dpp_readiness";

export type Entitlements = {
  id: EntitlementId;
  seals_monthly: number;
  lookup_verifies_monthly: number;
  domains: number;
  generations: number;
  gpt4v: boolean;
  notes: string;
};

export const ENTITLEMENTS: Record<EntitlementId, Entitlements> = {
  authichain_basic: {
    id: "authichain_basic",
    seals_monthly: 1000,
    lookup_verifies_monthly: 5000,
    domains: 1,
    generations: 0,
    gpt4v: false,
    notes: "Lookup verify only. GPT-4V is overage or Pro. Not listed until stripe_price_id is set.",
  },
  dpp_readiness: {
    id: "dpp_readiness",
    seals_monthly: 0,
    lookup_verifies_monthly: 0,
    domains: 0,
    generations: 50,
    gpt4v: false,
    notes: "$299 one-time. Credit toward first Basic invoice is a ledger row, not auto-subscribe.",
  },
};

export const DPP_BASIC_CREDIT_USD = 299;
