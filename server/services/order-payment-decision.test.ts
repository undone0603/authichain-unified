import { describe, it, expect } from "vitest";
import { decideOrderPaymentAction } from "./order-payment-decision";

describe("decideOrderPaymentAction", () => {
  describe("pending order", () => {
    it("transitions to paid and saves payment_intent string", () => {
      const result = decideOrderPaymentAction(
        { status: "pending" },
        { payment_intent: "pi_test_001" },
      );
      expect(result.action).toBe("mark-paid");
      if (result.action !== "mark-paid") return;
      expect(result.updates.status).toBe("paid");
      expect(result.updates.stripePaymentIntentId).toBe("pi_test_001");
    });

    it("extracts id when payment_intent is an expanded object", () => {
      const result = decideOrderPaymentAction(
        { status: "pending" },
        { payment_intent: { id: "pi_test_002" } },
      );
      expect(result.action).toBe("mark-paid");
      if (result.action !== "mark-paid") return;
      expect(result.updates.stripePaymentIntentId).toBe("pi_test_002");
    });

    it("uses null when payment_intent is missing", () => {
      const result = decideOrderPaymentAction(
        { status: "pending" },
        {},
      );
      expect(result.action).toBe("mark-paid");
      if (result.action !== "mark-paid") return;
      expect(result.updates.stripePaymentIntentId).toBeNull();
    });

    it("uses null when payment_intent is an object without an id", () => {
      const result = decideOrderPaymentAction(
        { status: "pending" },
        { payment_intent: {} },
      );
      expect(result.action).toBe("mark-paid");
      if (result.action !== "mark-paid") return;
      expect(result.updates.stripePaymentIntentId).toBeNull();
    });
  });

  describe("non-pending orders are ignored (idempotency)", () => {
    it.each(["paid", "in_progress", "delivered", "cancelled"])(
      "ignores order with status=%s",
      (status) => {
        const result = decideOrderPaymentAction(
          { status },
          { payment_intent: "pi_test_999" },
        );
        expect(result.action).toBe("ignore");
        if (result.action !== "ignore") return;
        expect(result.reason).toContain(status);
      },
    );
  });
});
