import { describe, it, expect } from "vitest";
import {
  decideOrderPaymentAction,
  expectedServiceOrderAmountCents,
  SERVICE_ORDER_AMOUNT_MISMATCH_REASON,
} from "./order-payment-decision";

const pending = { status: "pending", amount: 19900 };
const settled = {
  status: "complete",
  payment_status: "paid",
  mode: "payment",
  subscription: null,
  amount_total: 19900,
  currency: "usd",
  payment_intent: "pi_test_001",
};

describe("expectedServiceOrderAmountCents", () => {
  it.each([
    [19900, 19900],
    ["19900", 19900],
    ["19900.0000", 19900],
    [" 25000 ", 25000],
  ])("parses %j as %s cents", (input, cents) => {
    expect(expectedServiceOrderAmountCents(input)).toBe(cents);
  });

  it.each([0, -1, 1.5, "199.50", "", "abc", null, undefined, {}])(
    "rejects unusable amount %j",
    input => {
      expect(expectedServiceOrderAmountCents(input)).toBeNull();
    }
  );
});

describe("decideOrderPaymentAction", () => {
  it("marks a settled one-time Checkout paid only when amount and currency match", () => {
    const result = decideOrderPaymentAction(pending, settled);
    expect(result).toEqual({
      action: "mark-paid",
      updates: {
        status: "paid",
        stripePaymentIntentId: "pi_test_001",
        paidAmountCents: 19900,
      },
    });
  });

  it("accepts numeric(18,4) order amounts that equal the Checkout total", () => {
    const result = decideOrderPaymentAction(
      { status: "pending", amount: "19900.0000" },
      settled
    );
    expect(result.action).toBe("mark-paid");
  });

  it("extracts expanded PaymentIntent ID", () => {
    const result = decideOrderPaymentAction(pending, {
      ...settled,
      payment_intent: { id: "pi_test_002" },
    });
    expect(result).toEqual({
      action: "mark-paid",
      updates: {
        status: "paid",
        stripePaymentIntentId: "pi_test_002",
        paidAmountCents: 19900,
      },
    });
  });

  it.each([
    ["completed but unpaid", { payment_status: "unpaid" }],
    [
      "completed with no payment required",
      { payment_status: "no_payment_required" },
    ],
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
    const result = decideOrderPaymentAction(pending, {
      ...settled,
      ...override,
    });
    expect(result.action).toBe("ignore");
  });

  it.each([
    ["discounted Checkout total", { amount_total: 1000 }],
    ["overpaid Checkout total", { amount_total: 20000 }],
    ["missing currency", { currency: undefined }],
    ["non-USD currency", { currency: "eur" }],
  ])("flags %s as an amount/currency mismatch", (_name, override) => {
    const result = decideOrderPaymentAction(pending, {
      ...settled,
      ...override,
    });
    expect(result).toEqual({
      action: "ignore",
      reason: SERVICE_ORDER_AMOUNT_MISMATCH_REASON,
    });
  });

  it("flags a pending order whose stored price cannot be parsed as cents", () => {
    const result = decideOrderPaymentAction(
      { status: "pending", amount: null },
      settled
    );
    expect(result).toEqual({
      action: "ignore",
      reason: SERVICE_ORDER_AMOUNT_MISMATCH_REASON,
    });
  });

  it.each(["paid", "in_progress", "delivered", "cancelled"])(
    "ignores already-%s order even with a mismatched Checkout",
    status => {
      const result = decideOrderPaymentAction(
        { status, amount: 19900 },
        { ...settled, amount_total: 1000, currency: "eur" }
      );
      expect(result).toEqual({
        action: "ignore",
        reason: `Order already in status: ${status}`,
      });
    }
  );
});
