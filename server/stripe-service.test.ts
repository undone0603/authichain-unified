import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("stripe", () => ({
  default: class Stripe {
    checkout = { sessions: { create } };
  },
}));

vi.mock("./_core/env", () => ({
  ENV: { stripeSecretKey: "sk_test_service_checkout", isProduction: false },
}));

afterEach(() => {
  create.mockReset();
});

describe("createPaymentCheckout", () => {
  beforeEach(() => {
    create.mockResolvedValue({
      id: "cs_test_service",
      url: "https://checkout.stripe.com/c/pay/cs_test_service",
    });
  });

  it("creates a one-time payment session without promotion codes or discounts", async () => {
    const { createPaymentCheckout } = await import("./stripe-service.js");
    const result = await createPaymentCheckout({
      userId: 7,
      userEmail: "buyer@example.test",
      userName: "Buyer",
      description: "Authenticity Audit",
      amount: 19900,
      origin: "https://authichain.com",
      metadata: { type: "one_time_service", service_key: "authenticity_audit" },
    });

    expect(result).toEqual({
      url: "https://checkout.stripe.com/c/pay/cs_test_service",
      sessionId: "cs_test_service",
    });
    expect(create).toHaveBeenCalledOnce();
    const arg = create.mock.calls[0][0];
    expect(arg.mode).toBe("payment");
    expect(arg.allow_promotion_codes).toBe(false);
    expect(arg.discounts).toBeUndefined();
    expect(arg.line_items[0].price_data.unit_amount).toBe(19900);
    expect(arg.metadata.type).toBe("one_time_service");
  });
});
