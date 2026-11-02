// One atomic service-order settlement: a concurrent webhook must not produce
// duplicate revenue, activity, or payment-confirmed notifications. No DDL.
import { and, eq } from "drizzle-orm";
import { activityLog, notifications, revenueRecords, serviceOrders } from "../../drizzle/schema";
import { getDb } from "../db";

export type SettledServiceOrder = {
  orderId: number;
  sessionId: string;
  paymentIntentId: string;
  paidAmountCents: number;
};

export async function settleServiceOrderPaymentAtomic(input: SettledServiceOrder): Promise<boolean> {
  if (
    !Number.isSafeInteger(input.orderId) || input.orderId <= 0 ||
    typeof input.sessionId !== "string" || !input.sessionId.startsWith("cs_") ||
    typeof input.paymentIntentId !== "string" || !input.paymentIntentId.startsWith("pi_") ||
    !Number.isSafeInteger(input.paidAmountCents) || input.paidAmountCents <= 0
  ) {
    throw new Error("Invalid service-order settlement evidence");
  }

  const d = await getDb();
  return d.transaction(async tx => {
    // The pending->paid transition is a compare-and-swap. Only its winner
    // may write economic evidence. All writes share one SQL transaction.
    const [claimed] = await tx
      .update(serviceOrders)
      .set({
        status: "paid",
        stripePaymentIntentId: input.paymentIntentId,
        updatedAt: new Date(),
      })
      .where(and(
        eq(serviceOrders.id, input.orderId),
        eq(serviceOrders.stripeSessionId, input.sessionId),
        eq(serviceOrders.status, "pending"),
      ))
      .returning({
        id: serviceOrders.id,
        userId: serviceOrders.userId,
        serviceType: serviceOrders.serviceType,
      });
    if (!claimed) return false;

    await tx.insert(activityLog).values({
      userId: claimed.userId ?? null,
      action: "service_order_paid",
      entityType: "service_order",
      entityId: String(claimed.id),
      details: {
        sessionId: input.sessionId,
        amount: input.paidAmountCents,
        serviceType: claimed.serviceType,
      },
    });
    await tx.insert(revenueRecords).values({
      source: "stripe",
      amount: (input.paidAmountCents / 100).toFixed(2),
      currency: "USD",
      type: "service_order",
      userId: claimed.userId ?? null,
      metadata: {
        sessionId: input.sessionId,
        orderId: claimed.id,
        serviceType: claimed.serviceType,
        stripePaymentIntentId: input.paymentIntentId,
      },
    });
    if (claimed.userId) {
      await tx.insert(notifications).values({
        userId: claimed.userId,
        type: "success",
        title: "Payment confirmed",
        message: `Your service order for ${claimed.serviceType} is paid and will be fulfilled shortly.`,
        isRead: false,
        actionUrl: "/orders",
      });
    }
    // A failed insert aborts the transaction and leaves the order pending
    // for a signed Stripe retry; it cannot leave a paid order with no ledger.
    return true;
  });
}
