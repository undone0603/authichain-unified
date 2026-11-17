// Pure decision function for the service-order payment-completion webhook.
// Given an existing order's state and a Stripe checkout session, decide
// whether to transition the order's status to "paid" or ignore the event
// (because the order is already paid, fulfilled, cancelled, or the paid
// amount/currency does not match the expected order price).

export const SERVICE_ORDER_AMOUNT_MISMATCH_REASON =
  "Checkout amount/currency does not match expected order price";

export type OrderPaymentDecision =
  | {
      action: "mark-paid";
      updates: {
        status: "paid";
        stripePaymentIntentId: string | null;
        paidAmountCents: number;
      };
    }
  | {
      action: "ignore";
      reason: string;
    };

export type OrderShape = {
  status: string;
  stripePaymentIntentId?: string | null;
  amount?: string | number | null;
  currency?: string | null;
};

export type SessionShape = {
  payment_intent?: string | null | { id?: string };
  payment_status?: string | null;
  status?: string | null;
  mode?: string | null;
  subscription?: string | { id?: string } | null;
  amount_total?: number | null;
  currency?: string | null;
};

function extractPaymentIntentId(session: SessionShape): string | null {
  const pi = session.payment_intent;
  if (typeof pi === "string") return pi;
  if (pi && typeof pi === "object" && typeof pi.id === "string") return pi.id;
  return null;
}

/** Service orders store catalog cents (integer or numeric "19900.0000"). */
export function expectedServiceOrderAmountCents(
  amount: unknown
): number | null {
  if (typeof amount === "number") {
    return Number.isSafeInteger(amount) && amount > 0 ? amount : null;
  }
  if (typeof amount !== "string") return null;
  const trimmed = amount.trim();
  if (!trimmed) return null;
  const n = Number(trimmed);
  if (!Number.isFinite(n) || n <= 0 || n !== Math.trunc(n)) return null;
  const cents = Math.trunc(n);
  return Number.isSafeInteger(cents) ? cents : null;
}

export function expectedServiceOrderCurrency(currency?: string | null): string {
  const normalized = (currency ?? "usd").trim().toLowerCase();
  return normalized || "usd";
}

export function decideOrderPaymentAction(
  order: OrderShape,
  session: SessionShape
): OrderPaymentDecision {
  if (order.status !== "pending") {
    return {
      action: "ignore",
      reason: `Order already in status: ${order.status}`,
    };
  }

  // checkout.session.completed can precede payment settlement for asynchronous
  // methods. A signed event and a PaymentIntent ID alone are not paid proof.
  if (session.status !== "complete" || session.payment_status !== "paid") {
    return { action: "ignore", reason: "Checkout payment not settled" };
  }
  if (session.mode !== "payment" || session.subscription) {
    return { action: "ignore", reason: "Not a one-time payment checkout" };
  }
  // Fully discounted checkouts may have payment_status=paid without cash.
  // Do not mark an order paid or record revenue for those checkouts.
  if (
    !Number.isSafeInteger(session.amount_total) ||
    (session.amount_total ?? 0) <= 0
  ) {
    return { action: "ignore", reason: "No positive checkout total" };
  }
  const paymentIntentId = extractPaymentIntentId(session);
  if (!paymentIntentId) {
    return { action: "ignore", reason: "Missing PaymentIntent evidence" };
  }

  const expectedCents = expectedServiceOrderAmountCents(order.amount);
  const expectedCurrency = expectedServiceOrderCurrency(order.currency);
  const paidCurrency = session.currency?.trim().toLowerCase() ?? "";
  if (
    expectedCents == null ||
    paidCurrency !== expectedCurrency ||
    session.amount_total !== expectedCents
  ) {
    return { action: "ignore", reason: SERVICE_ORDER_AMOUNT_MISMATCH_REASON };
  }

  return {
    action: "mark-paid",
    updates: {
      status: "paid",
      stripePaymentIntentId: paymentIntentId,
      paidAmountCents: expectedCents,
    },
  };
}
