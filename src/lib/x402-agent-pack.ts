/**
 * Stripe prepaid verification pack. This is a DIFFERENT rail from x402 Base
 * USDC pay-per-call and from QRON image-generation credits.
 *
 * Never grant based on checkout metadata or amount alone: retrieve the actual
 * Stripe line items and require the exact live price, mode, and paid status.
 * The pack is unavailable by default until its protected runtime flag is on.
 */
export const X402_AGENT_PACK_PLAN_ID = "x402_agent_credits_120" as const;
export const X402_AGENT_PACK_PRICE_ID = "price_1UZdq5GqTruSqV8TsaDtFBPF" as const;
export const X402_AGENT_PACK_CREDITS = 120 as const;

export type X402PackEnv = {
  X402_PACK_PRICE_ID?: string;
  X402_PACK_CREDITS?: string;
  X402_PACK_ENABLED?: string;
};

/** A missing, mistyped, or wrong-account price must fail closed. */
export function x402PackReady(env: X402PackEnv = {}): boolean {
  return (
    env.X402_PACK_ENABLED === "true" &&
    env.X402_PACK_PRICE_ID === X402_AGENT_PACK_PRICE_ID &&
    env.X402_PACK_CREDITS === String(X402_AGENT_PACK_CREDITS)
  );
}

export type VerifiedPackLineItem = {
  priceId: string | null;
  quantity: number | null;
  unitAmount: number | null;
  currency: string | null;
  recurring: boolean;
};

export type PackPurchaseEvidence = {
  livemode: boolean;
  mode: string | null;
  paymentStatus: string | null;
  currency: string | null;
  amountSubtotal: number | null;
  amountTotal: number | null;
  items: readonly VerifiedPackLineItem[];
};

export function validX402PackPurchase(
  evidence: PackPurchaseEvidence
): boolean {
  if (!evidence.livemode || evidence.mode !== "payment") return false;
  if (evidence.paymentStatus !== "paid") return false;
  if (evidence.currency?.toLowerCase() !== "usd") return false;
  if (evidence.amountSubtotal !== 500 || (evidence.amountTotal ?? 0) < 500 || evidence.items.length !== 1) return false;
  const item = evidence.items[0];
  return (
    item.priceId === X402_AGENT_PACK_PRICE_ID &&
    item.quantity === 1 &&
    item.unitAmount === 500 &&
    item.currency?.toLowerCase() === "usd" &&
    item.recurring === false
  );
}

/** Metadata is not proof of payment; this only selects sessions to inspect. */
export function isX402PackCandidate(
  metadata: Record<string, string> | null | undefined,
  priceId: string | null | undefined
): boolean {
  return (
    priceId === X402_AGENT_PACK_PRICE_ID ||
    metadata?.plan === X402_AGENT_PACK_PLAN_ID ||
    metadata?.stripe_price_id === X402_AGENT_PACK_PRICE_ID
  );
}
