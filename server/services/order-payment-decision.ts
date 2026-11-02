// Pure decision function for the service-order payment-completion webhook.
// Given an existing order's state and a Stripe checkout session, decide
// whether to transition the order's status to "paid" or ignore the event
// (because the order is already paid, fulfilled, or cancelled).

export type OrderPaymentDecision =
  | {
      action: "mark-paid";
      updates: {
        status: "paid";
        stripePaymentIntentId: string | null;
      };
    }
  | {
      action: "ignore";
      reason: string;
    };

export type OrderShape = {
  status: string;
  stripePaymentIntentId?: string | null;
};

export type SessionShape = {
  payment_intent?: string | null | { id?: string };
  payment_status?: string | null;
  status?: string | null;
  mode?: string | null;
  subscription?: string | { id?: string } | null;
  amount_total?: number | null;
};

function extractPaymentIntentId(session: SessionShape): string | null {
  const pi = session.payment_intent;
  if (typeof pi === "string") return pi;
  if (pi && typeof pi === "object" && typeof pi.id === "string") return pi.id;
  return null;
}

export function decideOrderPaymentAction(
  order: OrderShape,
  session: SessionShape,
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

  return {
    action: "mark-paid",
    updates: {
      status: "paid",
      stripePaymentIntentId: paymentIntentId,
    },
  };
}
