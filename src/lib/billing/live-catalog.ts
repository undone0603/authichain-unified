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
 * DPP readiness report: $29 one-time, up to 200 products (Phase 3,
 * Advisor ruling 2026-10-24). Only authichain.com/api/stripe/webhook unlocks
 * it. Not a PlanId and not on /pricing.
 *
 * HOLD: the Stripe price is not issued yet (Stripe Price Adder). The price id
 * is read from the plain var DPP_REPORT_PRICE_ID; until it is set, only
 * product/session metadata product_line=dpp_report matches. No id is
 * hard-coded, and the StorePilot Pro price/product never unlocks this.
 * Must be checked before the $29.00 Starter amount fallback.
 */
export const DPP_REPORT_METADATA_KEY = "product_line";
export const DPP_REPORT_METADATA_VALUE = "dpp_report";
/** StorePilot Pro price (prod_VIMWy4q5ImqEkm). Explicitly never DPP. */
export const STOREPILOT_PRO_PRICE_ID = "price_1UTxvpGqTruSqV8TQu5gkqyc";

export const DPP_REPORT_OFFER = {
  sku: "dpp_report",
  tier: "dpp_report",
  amountCents: 2900,
  catalogLimit: 200,
} as const;

/** Configured DPP report price id, or null while the price is unissued. */
export function dppReportPriceId(
  env: Record<string, string | undefined> = process.env
): string | null {
  const id = (env.DPP_REPORT_PRICE_ID || "").trim();
  if (!id.startsWith("price_") || id === STOREPILOT_PRO_PRICE_ID) return null;
  return id;
}

type MetaLike = Record<string, unknown> | null | undefined;
function marksDpp(md: MetaLike): boolean {
  return md?.[DPP_REPORT_METADATA_KEY] === DPP_REPORT_METADATA_VALUE;
}

export type DppReportSessionLike = {
  metadata?: MetaLike;
  line_items?: {
    data?: Array<{
      price?: {
        id?: string | null;
        metadata?: MetaLike;
        product?: string | { metadata?: MetaLike } | null;
      } | null;
    }>;
  } | null;
};

export function isDppReportSession(
  session: DppReportSessionLike,
  linePriceId: string | null | undefined,
  env: Record<string, string | undefined> = process.env
): boolean {
  if (linePriceId === STOREPILOT_PRO_PRICE_ID) return false;
  const configured = dppReportPriceId(env);
  if (configured && linePriceId === configured) return true;
  if (marksDpp(session.metadata)) return true;
  for (const li of session.line_items?.data ?? []) {
    const price = li?.price;
    if (!price || price.id === STOREPILOT_PRO_PRICE_ID) continue;
    if (configured && price.id === configured) return true;
    if (marksDpp(price.metadata)) return true;
    if (typeof price.product === "object" && marksDpp(price.product?.metadata)) return true;
  }
  return false;
}

/** catalog_limit from session metadata, else the 200 default. */
export function dppReportCatalogLimit(metadata?: MetaLike): number {
  const n = Number.parseInt(String(metadata?.catalog_limit ?? ""), 10);
  return Number.isInteger(n) && n > 0 ? n : DPP_REPORT_OFFER.catalogLimit;
}
