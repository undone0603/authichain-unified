// Service-order payment completion after a signed Stripe webhook.
// A pre-read is advisory only: the transactional pending->paid compare-and-swap
// in settleServiceOrderPaymentAtomic is the sole authority for side effects.
import * as db from "../db";
import { decideOrderPaymentAction, type SessionShape } from "./order-payment-decision";
import { settleServiceOrderPaymentAtomic } from "./order-payment-atomic";

export type HandleResult =
  | { handled: true; orderId: number }
  | { handled: false; reason: string };

type SessionWithId = SessionShape & { id: string };

export async function handleServiceOrderPayment(session: SessionWithId): Promise<HandleResult> {
  const order = await db.getServiceOrderBySessionId(session.id);
  if (!order) {
    return { handled: false, reason: "no service order for this session" };
  }

  const decision = decideOrderPaymentAction(order, session);
  if (decision.action === "ignore") {
    return { handled: false, reason: decision.reason };
  }

  const claimed = await settleServiceOrderPaymentAtomic({
    orderId: order.id,
    sessionId: session.id,
    paymentIntentId: decision.updates.stripePaymentIntentId!,
    paidAmountCents: decision.updates.paidAmountCents,
  });
  if (!claimed) {
    return { handled: false, reason: "Order already settled or session changed" };
  }
  return { handled: true, orderId: order.id };
}
