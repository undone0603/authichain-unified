/**
 * Price → grant map for the Cloudflare webhook rail.
 * Keep in lockstep with src/lib/plans.ts PLAN_CREDITS + live-catalog.ts.
 * The apex rail (src/app/api/stripe/webhook) already calls provisionPurchase.
 * This Worker must grant the same thing or a paid session is lost.
 *
 * humanHold: payment is recorded, no generations, no certificate.
 * A hold is not delivery. Founder still has to produce the file.
 */

export type Grant = {
  plan: string;
  brand: "qron" | "strainchain" | "authichain";
  generations: number;
  refillOnInvoicePaid: boolean;
  humanHold?: boolean;
  /** Canonical apex webhook is the only grant writer; this worker checks its receipt. */
  canonicalFulfillment?: boolean;
};

export const GRANT_BY_PRICE: Record<string, Grant> = {
  price_1UJjzPGqTruSqV8TmhFSc8vh: {
    plan: "qron_launch",
    brand: "qron",
    generations: 100,
    refillOnInvoicePaid: true,
  },
  price_1USNoSGqTruSqV8ThTIW7Ej8: {
    plan: "qron_launch_annual",
    brand: "qron",
    generations: 1200,
    refillOnInvoicePaid: true,
  },
  price_1UIoEVGqTruSqV8T61lp48wB: {
    plan: "starter",
    brand: "qron",
    generations: 100,
    refillOnInvoicePaid: false,
  },
  price_1UIoEYGqTruSqV8TCXTNipvh: {
    plan: "creator",
    brand: "qron",
    generations: 500,
    refillOnInvoicePaid: false,
  },
  price_1TwmD8GqTruSqV8TpAF8dfyA: {
    plan: "dpp_readiness",
    brand: "authichain",
    generations: 50,
    refillOnInvoicePaid: false,
    canonicalFulfillment: true,
  },
  price_1UHjCZGqTruSqV8T35M6AmoJ: {
    plan: "strainchain_passport",
    brand: "strainchain",
    generations: 0,
    refillOnInvoicePaid: false,
    humanHold: true,
  },
  price_1UHjJWGqTruSqV8TePctYzO5: {
    plan: "strainchain_farm",
    brand: "strainchain",
    generations: 0,
    refillOnInvoicePaid: false,
    humanHold: true,
  },
  price_1UL0vVGqTruSqV8T5WYjrq6i: {
    plan: "musa_claim_file",
    brand: "authichain",
    generations: 0,
    refillOnInvoicePaid: false,
    humanHold: true,
  },
  price_1UL15AGqTruSqV8TQHP3yNiR: {
    plan: "musa_audit_bundle",
    brand: "authichain",
    generations: 0,
    refillOnInvoicePaid: false,
    humanHold: true,
  },
};

const UNLISTED = new Set([
  "price_1UIRF6GqTruSqV8TRjDYCkpi",
  "price_1UIRF7GqTruSqV8THhlI3zxp",
  "price_1UJbwzGqTruSqV8TJlaINJyW",
]);

export function grantForPrice(priceId: string | null | undefined): Grant | null {
  if (!priceId || UNLISTED.has(priceId)) return null;
  return GRANT_BY_PRICE[priceId] ?? null;
}

/** Amounts that map to exactly one public price. $299 is shared, so it is absent. */
const GRANT_BY_UNIQUE_AMOUNT: Record<number, string> = {
  2900: "price_1UIoEVGqTruSqV8T61lp48wB",
};

export function grantForCheckout(input: {
  priceId?: string | null;
  amountTotal?: number | null;
}): Grant | null {
  const byPrice = grantForPrice(input.priceId);
  if (byPrice) return byPrice;
  if (input.amountTotal == null) return null;
  return grantForPrice(GRANT_BY_UNIQUE_AMOUNT[input.amountTotal]);
}

/**
 * Growth loop identity per plan. Lockstep with src/lib/growth/loops.ts
 * GROWTH_LOOPS — this Worker deliberately duplicates catalogue constants rather
 * than importing src/lib (same reason GRANT_BY_PRICE is duplicated above).
 *
 * Plans absent here have no loop (creator, strainchain_farm, qron_launch) and
 * must not produce a purchase event.
 */
export type LoopIdentity = { loop: string; purchaseEvent: string };

export const LOOP_BY_PLAN: Record<string, LoopIdentity> = {
  starter: { loop: "loop_03_qron_starter", purchaseEvent: "purchase_starter_succeeded" },
  dpp_readiness: { loop: "loop_02_dpp_check", purchaseEvent: "purchase_dpp_succeeded" },
  strainchain_passport: {
    loop: "loop_01_passport_scan",
    purchaseEvent: "purchase_passport_succeeded",
  },
};

export function loopForPlan(plan: string | null | undefined): LoopIdentity | null {
  if (!plan) return null;
  return LOOP_BY_PLAN[plan] ?? null;
}

/**
 * Lockstep with src/lib/billing/live-catalog.ts FOUNDER_EMAILS.
 * Exact emails plus "@domain" entries (autonomy revenue-watch contract).
 */
export const FOUNDER_EMAILS = [
  "undone.k@gmail.com",
  "authichain@gmail.com",
  "@authichain.com",
] as const;

/** True when this checkout session already wrote the generation grant. */
export function alreadyGrantedSession(
  existingSessionId: string | null | undefined,
  sessionId: string
): boolean {
  return Boolean(existingSessionId) && existingSessionId === sessionId;
}

/**
 * Same checkout session must not reset generations_used.
 * A failed lookup is a retry, not a fresh grant.
 */
export function grantReplayAction(
  lookup:
    | { ok: true; sessionId: string | null | undefined }
    | { ok: false },
  sessionId: string
): "skip" | "grant" | "retry" {
  if (!lookup.ok) return "retry";
  if (alreadyGrantedSession(lookup.sessionId, sessionId)) return "skip";
  return "grant";
}

export function isFounderEmail(email: string | null | undefined): boolean {
  const e = (email || "").toLowerCase().trim();
  if (!e) return false;
  if ((FOUNDER_EMAILS as readonly string[]).includes(e)) return true;
  const at = e.lastIndexOf("@");
  if (at < 0) return false;
  return (FOUNDER_EMAILS as readonly string[]).includes(e.slice(at));
}
