/**
 * Canonical DPP entitlement predicate. A signed webhook is notification, not
 * proof of the line-item price: callers retrieve the Stripe Checkout Session
 * with expanded line_items from Stripe before granting.
 */
import { DPP_PRICE_ID, isDppDemoSession, isDppOffer } from "./dpp-loop";
import { PLANS } from "./plans";

export const DPP_PAYMENT_LINK_ID = "plink_1UNd1FGqTruSqV8TWahMUQ3l";
const DPP_PLAN = PLANS.find(plan => plan.id === "dpp_readiness");

export type DppProofSession = {
  id: string;
  mode?: string | null;
  status?: string | null;
  payment_status?: string | null;
  currency?: string | null;
  amount_subtotal?: number | null;
  amount_total?: number | null;
  total_details?: {
    amount_tax?: number | null;
    amount_discount?: number | null;
    amount_shipping?: number | null;
  } | null;
  metadata?: Record<string, string> | null;
  client_reference_id?: string | null;
  subscription?: string | { id: string } | null;
  payment_link?: string | { id: string } | null;
  line_items?: {
    data: Array<{ quantity?: number | null; price?: { id: string } | null }>;
    has_more?: boolean;
  } | null;
};

export type DppGrantDecision =
  | "not_dpp"
  | "unverified"
  | "recurring"
  | "invalid_product"
  | "authorized_smoke"
  | "paid";

export function isDppCheckoutCandidate(session: DppProofSession): boolean {
  const actualPrice = session.line_items?.data?.[0]?.price?.id ?? null;
  const paymentLink =
    typeof session.payment_link === "string"
      ? session.payment_link
      : session.payment_link?.id;
  return (
    isDppOffer(session.metadata ?? null, actualPrice) ||
    paymentLink === DPP_PAYMENT_LINK_ID
  );
}

function integerMoney(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isInteger(value);
}

export type DppLineProof = "ok" | "incomplete" | "wrong";

/** Expanded Stripe line items. Missing pages or quantity stay incomplete. */
export function dppLineProof(session: DppProofSession): DppLineProof {
  const md = session.metadata ?? {};
  const lineItems = session.line_items;
  const lines = lineItems?.data ?? [];
  const line = lines[0];
  if (
    lineItems == null ||
    lineItems.has_more !== false ||
    lines.length !== 1 ||
    line?.price?.id == null ||
    line.quantity == null
  ) {
    return "incomplete";
  }
  if (
    line.price.id !== DPP_PRICE_ID ||
    line.quantity !== 1 ||
    (md.plan && md.plan !== "dpp_readiness")
  ) {
    return "wrong";
  }
  return "ok";
}

/**
 * The list price must be paid in full. A positive tax may raise amount_total
 * only when the subtotal is the undiscounted list price and the total is
 * exactly subtotal plus tax. Discounts, shipping, and unexplained totals
 * never qualify. Omitted total_details means zero tax, discount, and shipping.
 */
export function dppListPriceSettlement(
  session: DppProofSession
): "paid" | "permanent" | "incomplete" {
  if (!DPP_PLAN) return "incomplete";
  const list = Math.round(DPP_PLAN.price * 100);
  if (!Number.isInteger(list)) return "incomplete";
  if (session.currency?.toLowerCase() !== "usd") return "permanent";
  if (!integerMoney(session.amount_total)) return "incomplete";

  const details = session.total_details;
  const discount = details?.amount_discount ?? 0;
  const tax = details?.amount_tax ?? 0;
  const shipping = details?.amount_shipping ?? 0;
  if (
    !integerMoney(discount) ||
    !integerMoney(tax) ||
    !integerMoney(shipping)
  ) {
    return "incomplete";
  }
  if (discount !== 0 || shipping !== 0 || tax < 0) return "permanent";

  const subtotal = session.amount_subtotal;
  if (subtotal != null && (!integerMoney(subtotal) || subtotal !== list)) {
    return "permanent";
  }

  if (tax === 0) {
    return session.amount_total === list ? "paid" : "permanent";
  }
  if (!integerMoney(subtotal)) return "permanent";
  if (session.amount_total !== subtotal + tax) return "permanent";
  return "paid";
}

export function dppGrantDecision(session: DppProofSession): DppGrantDecision {
  if (!isDppCheckoutCandidate(session)) return "not_dpp";
  if (session.payment_status !== "paid" || session.status !== "complete") {
    return "unverified";
  }
  if (session.mode !== "payment" || session.subscription) return "recurring";

  const md = session.metadata ?? {};
  const visit = session.client_reference_id || md.visit_id || "";
  const smoke =
    session.amount_total === 0 &&
    md.promo === "DPP-SMOKE-E2E" &&
    isDppDemoSession(md) &&
    visit.startsWith("smoke_check_");
  if (smoke) return "authorized_smoke";

  if (dppLineProof(session) !== "ok") return "invalid_product";
  if (dppListPriceSettlement(session) !== "paid") return "invalid_product";
  return "paid";
}

/**
 * A completed session whose line item is the DPP price, but whose money is
 * not the undiscounted list price, will not become eligible on a Stripe
 * retry. Missing line-item pages stay retryable instead.
 */
export function dppInvalidSettlementIsPermanent(
  session: DppProofSession
): boolean {
  return (
    dppGrantDecision(session) === "invalid_product" &&
    dppLineProof(session) === "ok" &&
    dppListPriceSettlement(session) === "permanent"
  );
}
