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
  amount_total?: number | null;
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

  if (
    !Number.isInteger(session.amount_total) ||
    !DPP_PLAN ||
    session.amount_total !== Math.round(DPP_PLAN.price * 100) ||
    session.currency?.toLowerCase() !== "usd"
  )
    return "invalid_product";

  // Stripe expands line_items as a paginated list. Unknown completeness and
  // unknown item quantity must both fail closed before any paid grant.
  const lineItems = session.line_items;
  const lines = lineItems?.data ?? [];
  const line = lines[0];
  if (
    lineItems?.has_more !== false ||
    lines.length !== 1 ||
    line?.price?.id !== DPP_PRICE_ID ||
    line.quantity !== 1 ||
    (md.plan && md.plan !== "dpp_readiness")
  )
    return "invalid_product";
  return "paid";
}
