/**
 * Paid EU battery gap report: tell the founder, because nothing else does.
 *
 * battery_gap_report / battery_gap_report_extra grant 0 catalogue credits,
 * so before this module a paid $950 order produced only a Stripe receipt.
 * The report is written by hand from a customer intake, so the founder must
 * hear about every paid order to send the intake questionnaire.
 *
 * Truth rules:
 * - Match only an exact PLANS price ID or metadata.plan; never an amount.
 * - Alert only for payment_status "paid", payment mode, non-demo sessions.
 * - Sends nothing to the customer. Founder alert only (ntfy, plus email and
 *   SMS when RESEND_API_KEY is set), best effort: an alert failure never fails
 *   the webhook or the payment.
 */
import type Stripe from "stripe";
import {
  publishFounderAlert,
  type FounderAlert,
  type FounderAlertEnv,
} from "../founder-alerts";
import { planById, planByStripePriceId } from "../plans";

export const GAP_REPORT_PLAN_IDS = [
  "battery_gap_report",
  "battery_gap_report_extra",
] as const;
export type GapReportPlanId = (typeof GAP_REPORT_PLAN_IDS)[number];

export interface GapReportOrder {
  planId: GapReportPlanId;
  planName: string;
  sessionId: string;
  email: string | null;
  amountUsd: number;
  livemode: boolean;
}

const isGapReportPlan = (id: unknown): id is GapReportPlanId =>
  typeof id === "string" &&
  (GAP_REPORT_PLAN_IDS as readonly string[]).includes(id);

function isDemo(session: Stripe.Checkout.Session): boolean {
  const m = (session.metadata || {}) as Record<string, unknown>;
  const demo = m.is_demo ?? m.demo;
  return demo === true || demo === "true" || demo === "1";
}

/** The paid gap-report order in this session, or null. */
export function gapReportOrder(
  session: Stripe.Checkout.Session,
  linePriceId: string | null
): GapReportOrder | null {
  if (session.payment_status !== "paid") return null;
  if (session.mode && session.mode !== "payment") return null;
  if (isDemo(session)) return null;
  const byPrice = planByStripePriceId(linePriceId)?.id;
  const metaPlan = session.metadata?.plan;
  const planId = isGapReportPlan(byPrice)
    ? byPrice
    : !byPrice && isGapReportPlan(metaPlan)
      ? metaPlan
      : null;
  if (!planId) return null;
  return {
    planId,
    planName: planById(planId)?.name ?? planId,
    sessionId: session.id,
    email: session.customer_details?.email ?? session.customer_email ?? null,
    amountUsd: (session.amount_total ?? 0) / 100,
    livemode: Boolean(session.livemode),
  };
}

export function gapReportPaidAlert(order: GapReportOrder): FounderAlert {
  const mode = order.livemode ? "" : " [TEST MODE]";
  const lines = [
    `Paid: ${order.planName}${mode}`,
    `amount: $${order.amountUsd.toFixed(2)}`,
    `buyer: ${order.email ?? "unknown — see Stripe session"}`,
    `session: ${order.sessionId}`,
    "",
    "Next: send the intake questionnaire",
    "(node scripts/battery-gap-report/generate.ts --questions),",
    "then generate the report from the returned intake.",
  ];
  return {
    title: `Gap report paid $${order.amountUsd.toFixed(0)}${mode}`,
    subject: `[paid] ${order.planName} — ${order.email ?? order.sessionId}${mode}`,
    text: lines.join("\n"),
    kind: "intake",
    click: `https://dashboard.stripe.com/${order.livemode ? "" : "test/"}checkout/sessions/${order.sessionId}`,
  };
}

/**
 * Alert the founder if this session is a paid gap-report order.
 * Returns the order (or null). Never throws.
 */
export async function notifyGapReportPaid(
  session: Stripe.Checkout.Session,
  linePriceId: string | null,
  publish: (a: FounderAlert, env?: FounderAlertEnv) => Promise<void> = publishFounderAlert
): Promise<GapReportOrder | null> {
  const order = gapReportOrder(session, linePriceId);
  if (!order) return null;
  try {
    await publish(gapReportPaidAlert(order));
  } catch (err) {
    console.error("[gap-report-paid] founder alert failed", err);
  }
  return order;
}
