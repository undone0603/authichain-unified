import { afterEach, describe, expect, it, vi } from "vitest";
import { createPlanCheckoutSession } from "./plan-checkout";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("stripe", () => ({
  default: class Stripe {
    checkout = { sessions: { create } };
  },
}));

afterEach(() => {
  create.mockReset();
});

describe("createPlanCheckoutSession", () => {
  it("requires planId", async () => {
    const result = await createPlanCheckoutSession({
      request: new Request("https://authichain.com/api/checkout", {
        method: "POST",
      }),
      body: {},
      stripeSecretKey: "sk_test_x",
    });
    expect(result).toMatchObject({
      ok: false,
      status: 400,
      error: "planId is required",
    });
  });

  it("rejects an unknown plan without calling Stripe", async () => {
    const result = await createPlanCheckoutSession({
      request: new Request("https://authichain.com/api/checkout", {
        method: "POST",
      }),
      body: { planId: "not-a-plan" },
      stripeSecretKey: "sk_test_x",
    });
    expect(result).toMatchObject({
      ok: false,
      status: 400,
      error: "Unknown plan",
    });
  });

  it("rejects the free plan", async () => {
    const result = await createPlanCheckoutSession({
      request: new Request("https://authichain.com/api/checkout", {
        method: "POST",
      }),
      body: { planId: "free" },
      stripeSecretKey: "sk_test_x",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toMatch(/Free plan/);
  });

  it("enables abandoned-cart recovery on the $49 StrainChain passport session", async () => {
    create.mockResolvedValue({
      url: "https://checkout.stripe.com/c/pay/cs_test_passport",
    });
    const result = await createPlanCheckoutSession({
      request: new Request(
        "https://authichain.com/api/checkout/plan/strainchain_passport",
        {
          method: "GET",
        }
      ),
      body: { planId: "strainchain_passport" },
      stripeSecretKey: "sk_test_x",
    });
    expect(result).toEqual({
      ok: true,
      url: "https://checkout.stripe.com/c/pay/cs_test_passport",
      planId: "strainchain_passport",
    });
    const arg = create.mock.calls[0][0];
    expect(arg.mode).toBe("payment");
    expect(arg.line_items[0].price).toBe("price_1UHjCZGqTruSqV8T35M6AmoJ");
    expect(arg.after_expiration.recovery).toEqual({
      enabled: true,
      allow_promotion_codes: false,
    });
    expect(arg.consent_collection.promotions).toBe("auto");
    expect(arg.customer_creation).toBe("always");
  });

  it("does not set customer_creation on Farm Plan subscription checkout", async () => {
    create.mockResolvedValue({
      url: "https://checkout.stripe.com/c/pay/cs_test_farm",
    });
    const result = await createPlanCheckoutSession({
      request: new Request(
        "https://authichain.com/api/checkout/plan/strainchain_farm",
        { method: "GET" }
      ),
      body: { planId: "strainchain_farm" },
      stripeSecretKey: "sk_test_x",
    });
    expect(result.ok).toBe(true);
    const arg = create.mock.calls[0][0];
    expect(arg.mode).toBe("subscription");
    expect(arg.after_expiration.recovery.enabled).toBe(true);
    expect(arg.customer_creation).toBeUndefined();
  });
});
