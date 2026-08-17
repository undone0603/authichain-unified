// Pure decision function for the service-order payment-completion webhook.
// Given an existing order's state and a Stripe checkout session, decide
// whether to transition the order's status to "paid" or ignore the event
// (because the order is already paid, fulfilled, or cancelled).
function extractPaymentIntentId(session) {
    const pi = session.payment_intent;
    if (typeof pi === "string")
        return pi;
    if (pi && typeof pi === "object" && typeof pi.id === "string")
        return pi.id;
    return null;
}
export function decideOrderPaymentAction(order, session) {
    if (order.status === "pending") {
        return {
            action: "mark-paid",
            updates: {
                status: "paid",
                stripePaymentIntentId: extractPaymentIntentId(session),
            },
        };
    }
    return {
        action: "ignore",
        reason: `Order already in status: ${order.status}`,
    };
}
