import { describe, it, expect } from "vitest";
import { decideOrderPaymentAction } from "./order-payment-decision";

const settled = {
  status: "complete",
  payment_status: "paid",
  mode: "payment",
  subscription: null,
  amount_total: 19900,
  payment_intent: "pi_test_001",
};

describe("decideOrderPaymentAction", () => {
  it("marks a settled positive one-time Checkout paid and preserves PaymentIntent", () => {
    const result = decideOrderPaymentAction({ status: "pending" }, settled);
    expect(result).toEqual({
      action: "mark-paid",
      updates: { status: "paid", stripePaymentIntentId: "pi_test_001" },
    });
  });

  it("extracts expanded PaymentIntent ID", () => {
    const result = decideOrderPaymentAction(
      { status: "pending" },
      { ...settled, payment_intent: { id: "pi_test_002" } },
    );
    expect(result).toEqual({
      action: "mark-paid",
      updates: { status: "paid", stripePaymentIntentId: "pi_test_002" },
    });
  });

  it.each([
    ["completed but unpaid", { payment_status: "unpaid" }],
    ["completed with no payment required", { payment_status: "no_payment_required" }],
    ["completed with missing payment status", { payment_status: undefined }],
    ["open but paid", { status: "open" }],
    ["missing checkout status", { status: undefined }],
    ["subscription mode", { mode: "subscription" }],
    ["subscription attached", { subscription: "sub_test_001" }],
    ["missing mode", { mode: undefined }],
    ["zero-cash paid-status checkout", { amount_total: 0 }],
    ["unknown checkout total", { amount_total: null }],
    ["missing checkout total", { amount_total: undefined }],
    ["missing PaymentIntent", { payment_intent: undefined }],
    ["unexpanded PaymentIntent without id", { payment_intent: {} }],
  ])("refuses %s without marking an order paid", (_name, override) => {
    const result = decideOrderPaymentAction(
      { status: "pending" },
      { ...settled, ...override },
    );
    expect(result.action).toBe("ignore");
  });

  it.each(["paid", "in_progress", "delivered", "cancelled"])(
    "ignores already-%s order even with settled Checkout",
    (status) => {
      const result = decideOrderPaymentAction({ status }, settled);
      expect(result).toEqual({
        action: "ignore",
        reason: `Order already in status: ${status}`,
      });
    },
  );
});
