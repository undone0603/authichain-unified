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
      request: new Request("https://authichain.govchain.us/api/checkout", {
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
      request: new Request("https://authichain.govchain.us/api/checkout", {
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
      request: new Request("https://authichain.govchain.us/api/checkout", {
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
        "https://authichain.govchain.us/api/checkout/plan/strainchain_passport",
        {
          method: "GET",
        }
      ),
      body: { planId: "strainchain_passport", email: "ops@brand.com" },
      stripeSecretKey: "sk_test_x",
      requireEmail: true,
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
    expect(arg.consent_collection).toBeUndefined();
    expect(arg.allow_promotion_codes).toBeUndefined();
    expect(arg.customer_creation).toBe("always");
  });

  it("303s to pricing when GET attributed checkout has no email", async () => {
    const result = await createPlanCheckoutSession({
      request: new Request(
        "https://authichain.govchain.us/api/checkout/plan/strainchain_passport",
        { method: "GET" }
      ),
      body: { planId: "strainchain_passport" },
      stripeSecretKey: "",
      requireEmail: true,
    });
    expect(result).toMatchObject({
      ok: false,
      status: 303,
      error: "email_required",
      url: "https://authichain.govchain.us/pricing?need_email=1",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("forwards a valid email as Stripe customer_email", async () => {
    create.mockResolvedValue({
      url: "https://checkout.stripe.com/c/pay/cs_test_passport_email",
    });
    await createPlanCheckoutSession({
      request: new Request(
        "https://authichain.govchain.us/api/checkout/plan/strainchain_passport",
        { method: "GET" }
      ),
      body: {
        planId: "strainchain_passport",
        email: "mike@example.com",
      },
      stripeSecretKey: "sk_test_x",
    });
    expect(create.mock.calls[0][0].customer_email).toBe("mike@example.com");
  });

  it("does not set customer_creation on Farm Plan subscription checkout", async () => {
    create.mockResolvedValue({
      url: "https://checkout.stripe.com/c/pay/cs_test_farm",
    });
    const result = await createPlanCheckoutSession({
      request: new Request(
        "https://authichain.govchain.us/api/checkout/plan/strainchain_farm",
        { method: "GET" }
      ),
      body: { planId: "strainchain_farm" },
      stripeSecretKey: "sk_test_x",
    });
    expect(result.ok).toBe(true);
    const arg = create.mock.calls[0][0];
    expect(arg.mode).toBe("subscription");
    expect(arg.after_expiration.recovery.enabled).toBe(true);
    expect(arg.allow_promotion_codes).toBeUndefined();
    expect(arg.customer_creation).toBeUndefined();
  });

  it("carries aff_ref + ref_code cookies into session and subscription metadata", async () => {
    create.mockResolvedValue({
      url: "https://checkout.stripe.com/c/pay/cs_test_farm_aff",
    });
    const result = await createPlanCheckoutSession({
      request: new Request(
        "https://authichain.govchain.us/api/checkout/plan/strainchain_farm",
        {
          method: "GET",
          headers: { cookie: "aff_ref=AFF-COOKIE; ref_code=USER-456" },
        }
      ),
      body: { planId: "strainchain_farm" },
      stripeSecretKey: "sk_test_x",
    });
    expect(result.ok).toBe(true);
    const arg = create.mock.calls[0][0];
    expect(arg.metadata.affiliate_code).toBe("AFF-COOKIE");
    expect(arg.metadata.ref_code).toBe("USER-456");
    expect(arg.subscription_data.metadata.affiliate_code).toBe("AFF-COOKIE");
    expect(arg.subscription_data.metadata.ref_code).toBe("USER-456");
  });

  it("prefers an explicit affiliateCode over the cookie", async () => {
    create.mockResolvedValue({
      url: "https://checkout.stripe.com/c/pay/cs_test_farm_aff2",
    });
    await createPlanCheckoutSession({
      request: new Request(
        "https://authichain.govchain.us/api/checkout/plan/strainchain_farm",
        { method: "GET", headers: { cookie: "aff_ref=AFF-COOKIE" } }
      ),
      body: { planId: "strainchain_farm", affiliateCode: "AFF-EXPLICIT" },
      stripeSecretKey: "sk_test_x",
    });
    expect(create.mock.calls[0][0].metadata.affiliate_code).toBe(
      "AFF-EXPLICIT"
    );
  });
});
