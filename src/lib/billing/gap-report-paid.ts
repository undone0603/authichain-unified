/**
 * Paid EU battery gap report: send the buyer the intake questionnaire and
 * tell the founder, because nothing else does.
 *
 * battery_gap_report / battery_gap_report_extra grant 0 catalogue credits,
 * so before this module a paid $950 order produced only a Stripe receipt.
 * The report is written by hand from the customer's intake answers.
 *
 * Truth rules:
 * - Match only an exact PLANS price ID or metadata.plan; never an amount.
 * - Act only for payment_status "paid", payment mode, non-demo sessions.
 * - The buyer gets one email: the intake questionnaire, with replies going to
 *   the founder inbox. It promises no delivery date.
 * - The founder alert (ntfy, plus email and SMS when RESEND_API_KEY is set)
 *   says whether that email was accepted, so a failed send is followed up
 *   by hand. Both are best effort: a failure never fails the webhook or the
 *   payment.
 */
import type Stripe from "stripe";
import {
  FOUNDER_INBOXES,
  publishFounderAlert,
  type FounderAlert,
  type FounderAlertEnv,
} from "../founder-alerts";
import { planById, planByStripePriceId } from "../plans";
import { intakeQuestionnaire } from "../../../workers/authichain-com/src/battery-gap-report.ts";

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

/** "sent" only when the provider accepted the buyer's intake email. */
export type IntakeEmailStatus =
  | "sent"
  | "no_buyer_email"
  | "suppressed"
  | "skipped"
  | "dry_run"
  | "error";

/** Replies with the intake answers land in the founder inbox. */
export const GAP_REPORT_REPLY_TO = FOUNDER_INBOXES[0];

export interface IntakeEmail {
  to: string;
  subject: string;
  body: string;
  fromName: string;
  replyTo: string;
}

/** Same shape as server/email-service sendEmail; injected to keep src/lib server-free. */
export type IntakeSender = (input: IntakeEmail) => Promise<{ status: string }>;

export function gapReportIntakeEmail(order: GapReportOrder & { email: string }): IntakeEmail {
  const body = [
    "Hi,",
    "",
    intakeQuestionnaire().trimEnd(),
    "",
    "To answer, reply to this email. Plain text is fine: number your answers to match the list, and repeat 1-7 for each additional model. You don't need to attach the documents themselves.",
    "",
    `Order reference: ${order.sessionId}`,
    "",
    "Zac Kietzman",
    "AuthiChain",
  ].join("\n");
  return {
    to: order.email,
    subject: "Your EU battery passport gap report: intake questions",
    body,
    fromName: "AuthiChain",
    replyTo: GAP_REPORT_REPLY_TO,
  };
}

export function gapReportPaidAlert(
  order: GapReportOrder,
  intake?: IntakeEmailStatus
): FounderAlert {
  const mode = order.livemode ? "" : " [TEST MODE]";
  const next =
    intake === "sent"
      ? [
          "Intake questionnaire emailed to the buyer (replies come to " +
            `${GAP_REPORT_REPLY_TO}).`,
          "Next: generate the report from the returned intake.",
        ]
      : [
          `Intake email NOT sent (${intake ?? "not attempted"}).`,
          "Next: send the intake questionnaire by hand",
          "(npx tsx scripts/battery-gap-report/generate.ts --questions),",
          "then generate the report from the returned intake.",
        ];
  const lines = [
    `Paid: ${order.planName}${mode}`,
    `amount: $${order.amountUsd.toFixed(2)}`,
    `buyer: ${order.email ?? "unknown — see Stripe session"}`,
    `session: ${order.sessionId}`,
    "",
    ...next,
  ];
  return {
    title: `Gap report paid $${order.amountUsd.toFixed(0)}${mode}`,
    subject: `[paid] ${order.planName} — ${order.email ?? order.sessionId}${mode}`,
    text: lines.join("\n"),
    kind: "intake",
    click: `https://dashboard.stripe.com/${order.livemode ? "" : "test/"}checkout/sessions/${order.sessionId}`,
  };
}

async function sendIntake(
  order: GapReportOrder,
  send: IntakeSender | undefined
): Promise<IntakeEmailStatus | undefined> {
  if (!send) return undefined;
  if (!order.email) return "no_buyer_email";
  try {
    const { status } = await send(gapReportIntakeEmail({ ...order, email: order.email }));
    return status === "sent" || status === "suppressed" || status === "skipped" ||
      status === "dry_run"
      ? status
      : "error";
  } catch (err) {
    console.error("[gap-report-paid] intake email failed", err);
    return "error";
  }
}

/**
 * For a paid gap-report order: email the buyer the intake questionnaire (when
 * a sender is given), then alert the founder with the outcome.
 * Returns the order and the intake status (or null). Never throws.
 */
export async function notifyGapReportPaid(
  session: Stripe.Checkout.Session,
  linePriceId: string | null,
  publish: (a: FounderAlert, env?: FounderAlertEnv) => Promise<void> = publishFounderAlert,
  send?: IntakeSender
): Promise<(GapReportOrder & { intake?: IntakeEmailStatus }) | null> {
  const order = gapReportOrder(session, linePriceId);
  if (!order) return null;
  const intake = await sendIntake(order, send);
  try {
    await publish(gapReportPaidAlert(order, intake));
  } catch (err) {
    console.error("[gap-report-paid] founder alert failed", err);
  }
  return { ...order, intake };
}
