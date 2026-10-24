/**
 * Public catalog freeze — 2026-09-28, widened 2026-09-29 to eight SKUs with
 * musa_claim_file ($299/SKU) and musa_audit_bundle ($2,500/engagement).
 * Only these SKUs may appear on /pricing, /onboard, /generate, /checkout.
 * First stranger SKU is QRON Starter $29. Do not list $1 or Seal $99.
 *
 * Live Stripe acct_1SXIyEGqTruSqV8T. Price IDs must match src/lib/plans.ts.
 *
 * 2026-10-19: added qron_launch_annual to LIVE_PRICE_MAP.
 */
import {
  PLAN_CREDITS,
  PUBLIC_PLAN_IDS,
  planByAmountCents,
  planById,
  planByStripePriceId,
  type PlanId,
} from "../plans";

export const FIRST_STRANGER_SKU: PlanId = "starter";

/**
 * Exact founder inboxes, plus "@domain" entries that cover every alias on an
 * owned domain (same contract as scripts/autonomy/revenue-watch.mjs isFounder
 * and .github/autonomy.json founder_emails).
 */
export const FOUNDER_EMAILS = [
  "undone.k@gmail.com",
  "authichain@gmail.com",
  "@authichain.com",
] as const;

export type PublicPlanId = (typeof PUBLIC_PLAN_IDS)[number];

export const LIVE_PRICE_MAP: Record<
  Exclude<PublicPlanId, "free">,
  {
    priceId: string;
    productId: string;
    mode: "payment" | "subscription";
    grant: number;
    stripeLink?: string;
  }
> = {
  qron_launch: {
    priceId: "price_1UJjzPGqTruSqV8TmhFSc8vh",
    productId: "prod_UVdvzB03BvV4CU",
    mode: "subscription",
    grant: 100,
  },
  qron_launch_annual: {
    priceId: "price_1USNoSGqTruSqV8ThTIW7Ej8",
    productId: "prod_UVdvzB03BvV4CU",
    mode: "subscription",
    grant: 1200,
  },
  starter: {
    priceId: "price_1UIoEVGqTruSqV8T61lp48wB",
    productId: "prod_VJR6xofjGFoP1j",
    mode: "payment",
    grant: 100,
    stripeLink: "https://buy.stripe.com/eVq3cv2N3bVA8umazy1ND3E",
  },
  creator: {
    priceId: "price_1UIoEYGqTruSqV8TCXTNipvh",
    productId: "prod_VJR6imfy3FRa7z",
    mode: "payment",
    grant: 500,
    stripeLink: "https://buy.stripe.com/aFa8wP0EV2l08um8rq1ND3F",
  },
  dpp_readiness: {
    priceId: "price_1TwmD8GqTruSqV8TpAF8dfyA",
    productId: "prod_UwfYVM0TYpdg4J",
    mode: "payment",
    grant: 50,
  },
  strainchain_passport: {
    priceId: "price_1UHjCZGqTruSqV8T35M6AmoJ",
    productId: "prod_VIJqbTJOoGT1I3",
    mode: "payment",
    grant: 0,
    stripeLink: "https://buy.stripe.com/cNi9ATdrH4t811U4ba1ND3y",
  },
  musa_claim_file: {
    priceId: "price_1UL0vVGqTruSqV8T5WYjrq6i",
    productId: "prod_VLiM8xIrFVFa1M",
    mode: "payment",
    grant: 0,
    stripeLink: "https://buy.stripe.com/9B68wPgDTcZE8umgXW1ND3H",
  },
  musa_audit_bundle: {
    priceId: "price_1UL15AGqTruSqV8TQHP3yNiR",
    productId: "prod_VLiWxjx4pEDfmP",
    mode: "payment",
    grant: 0,
    stripeLink: "https://buy.stripe.com/fZucN52N35xcaCufTS1ND3I",
  },
};

/** Exist in Stripe. Never put on /pricing, /onboard, or LOOP-03 copy. */
export const UNLISTED_SMOKE = {
  first_dollar_human: "price_1UIRF6GqTruSqV8TRjDYCkpi",
  first_dollar_agent: "price_1UIRF7GqTruSqV8THhlI3zxp",
  seal_monthly: "price_1UJbwzGqTruSqV8TJlaINJyW",
} as const;

const PUBLIC_SET = new Set<string>(PUBLIC_PLAN_IDS);
const UNLISTED_PRICE_SET = new Set<string>(Object.values(UNLISTED_SMOKE));

export function isFounderEmail(
  email?: string | null,
  founderEmails: readonly string[] = FOUNDER_EMAILS
): boolean {
  const e = (email || "").toLowerCase().trim();
  if (!e) return false;
  if (founderEmails.some(item => item.trim().toLowerCase() === e)) return true;
  const at = e.lastIndexOf("@");
  if (at < 0) return false;
  const domainEntry = e.slice(at);
  return founderEmails.some(
    item => item.trim().toLowerCase() === domainEntry
  );
}

export function isPublicPlanId(id: string): id is PublicPlanId {
  return PUBLIC_SET.has(id);
}

export function publicPlanOrNull(id: string): PlanId | null {
  return isPublicPlanId(id) ? id : null;
}

export function isUnlistedSmokePrice(priceId: string | null | undefined): boolean {
  return Boolean(priceId && UNLISTED_PRICE_SET.has(priceId));
}

/**
 * Grant table for both webhook rails. Farm is live Stripe but not public;
 * still grant so a paid Farm session is not lost. Unlisted smoke = ignore.
 */
export function grantForPriceId(
  priceId: string | null | undefined,
): { planId: PlanId; grant: number } | null {
  if (!priceId || isUnlistedSmokePrice(priceId)) return null;
  const plan = planByStripePriceId(priceId);
  if (!plan) return null;
  if (!isPublicPlanId(plan.id) && plan.id !== "strainchain_farm") return null;
  return { planId: plan.id, grant: PLAN_CREDITS[plan.id] };
}

/** Starter is $29.00 USD; the only amount the fallback may grant. */
export const STARTER_FALLBACK_AMOUNT_CENTS = 2900;

export type AmountFallbackSession = {
  payment_status?: string | null;
  currency?: string | null;
  amount_total?: number | null;
  amount_subtotal?: number | null;
  total_details?: { amount_discount?: number | null } | null;
};

/**
 * Why the amount-only Starter fallback is refused for this session, or an
 * empty list when it is allowed. Requires a paid, live, USD, undiscounted
 * $29.00 session. Reasons carry no customer data or secrets.
 */
export function starterAmountFallbackRefusals(
  session: AmountFallbackSession,
  livemode: boolean | null | undefined
): string[] {
  const reasons: string[] = [];
  if (session.payment_status !== "paid") reasons.push("not_paid");
  if (livemode !== true) reasons.push("not_livemode");
  if ((session.currency || "").toLowerCase() !== "usd") reasons.push("not_usd");
  if (session.amount_total !== STARTER_FALLBACK_AMOUNT_CENTS)
    reasons.push("amount_not_2900");
  if (
    session.amount_subtotal != null &&
    session.amount_subtotal !== STARTER_FALLBACK_AMOUNT_CENTS
  )
    reasons.push("subtotal_not_2900");
  if ((session.total_details?.amount_discount ?? 0) !== 0)
    reasons.push("discounted");
  return reasons;
}

/**
 * Payment Links omit metadata.plan. Prefer an explicit public plan, then a
 * known price id. The amount fallback (Starter only) runs only when the caller
 * passes allowAmountFallback after starterAmountFallbackRefusals() is empty.
 * Unlisted smoke prices never resolve.
 */
export function resolveCheckoutPlanId(input: {
  plan?: string | null;
  priceId?: string | null;
  amountTotal?: number | null;
  allowAmountFallback?: boolean;
}): PlanId | null {
  if (input.plan && isPublicPlanId(input.plan)) return input.plan;
  if (input.plan === "strainchain_farm") return "strainchain_farm";
  const granted = grantForPriceId(input.priceId);
  if (granted) return granted.planId;
  if (!input.allowAmountFallback) return null;
  if (input.amountTotal !== STARTER_FALLBACK_AMOUNT_CENTS) return null;
  const byAmount = planByAmountCents(input.amountTotal);
  if (byAmount && byAmount.id === "starter" && isPublicPlanId(byAmount.id))
    return byAmount.id;
  return null;
}

export function liveBypassLink(id: PlanId): string | undefined {
  const row = LIVE_PRICE_MAP[id as keyof typeof LIVE_PRICE_MAP];
  return row?.stripeLink ?? planById(id)?.stripe_payment_link;
}

export function publicCheckoutHref(id: PublicPlanId): string {
  if (id === "free") return "https://qron.space/generate";
  return `https://authichain.com/checkout/${id}`;
}

/**
 * StorePilot Pro: $29 one-time (Phase 3, 2026-10-24). Not a PlanId and not on
 * /pricing; the webhook unlocks it as an entitlement (tier=pro,
 * catalog_limit=200) instead of profile credits. Payment Link sessions do not
 * carry line_items in the webhook payload, so the link id is matched too.
 * This MUST be checked before the $29.00 Starter amount fallback, or a Pro
 * purchase would be granted Starter.
 */
export const STOREPILOT_PRO_OFFER = {
  sku: "storepilot_pro",
  tier: "pro",
  priceId: "price_1UTxvpGqTruSqV8TQu5gkqyc",
  paymentLinkId: "plink_1UTxvvGqTruSqV8TRFCqFU5B",
  amountCents: 2900,
  catalogLimit: 200,
} as const;

export type StorePilotProSessionLike = {
  payment_link?: string | { id: string } | null;
  metadata?: Record<string, string> | null;
};

export function isStorePilotProSession(
  session: StorePilotProSessionLike,
  linePriceId: string | null | undefined
): boolean {
  if (linePriceId === STOREPILOT_PRO_OFFER.priceId) return true;
  const link =
    typeof session.payment_link === "string"
      ? session.payment_link
      : session.payment_link?.id ?? null;
  if (link === STOREPILOT_PRO_OFFER.paymentLinkId) return true;
  return session.metadata?.stripe_price_id === STOREPILOT_PRO_OFFER.priceId;
}

/** catalog_limit from price/session metadata, else the 200 default. */
export function storePilotCatalogLimit(
  metadata?: Record<string, string> | null
): number {
  const n = Number.parseInt(metadata?.catalog_limit ?? "", 10);
  return Number.isInteger(n) && n > 0 ? n : STOREPILOT_PRO_OFFER.catalogLimit;
}
