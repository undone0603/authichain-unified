// Orchestrator for the service-order payment-completion webhook path.
// Looks up the service order by Stripe checkout session id, decides whether
// to transition status to "paid" via decideOrderPaymentAction, and dispatches
// the necessary DB updates + customer notification.
//
// Designed to be called from server/webhooks/stripe.ts inside the
// checkout.session.completed handler. Idempotent: if the order is already
// past the "pending" state, the call is a no-op.

import * as db from "../db";
import { decideOrderPaymentAction, type SessionShape } from "./order-payment-decision";

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

  await db.updateServiceOrderStatus(order.id, decision.updates.status, {
    stripePaymentIntentId: decision.updates.stripePaymentIntentId,
  });

  await db.logActivity({
    userId: order.userId ?? null,
    action: "service_order_paid",
    entityType: "service_order",
    entityId: order.id,
    details: {
      sessionId: session.id,
      amount: order.amount,
      serviceType: order.serviceType,
    },
  });

  if (order.amount) {
    await db.recordRevenue({
      source: "stripe",
      amount: (order.amount / 100).toFixed(2),
      currency: "USD",
      type: "service_order",
      userId: order.userId ?? null,
      metadata: {
        sessionId: session.id,
        orderId: order.id,
        serviceType: order.serviceType,
        stripePaymentIntentId: decision.updates.stripePaymentIntentId,
      },
    });
  }

  if (order.userId) {
    await db.createSystemNotification(
      order.userId,
      "Payment confirmed",
      `Your service order for ${order.serviceType} is paid and will be fulfilled shortly.`,
      "success",
      "/orders",
    );
  }

  return { handled: true, orderId: order.id };
}
