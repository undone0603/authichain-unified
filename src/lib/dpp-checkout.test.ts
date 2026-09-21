import { afterEach, describe, expect, it, vi } from "vitest";
import { DPP_OFFER_KEY } from "./plans";

const { create } = vi.hoisted(() => ({ create: vi.fn() }));

vi.mock("stripe", () => ({
  default: class Stripe {
    checkout = { sessions: { create } };
  },
}));

afterEach(() => {
  create.mockReset();
});

describe("createDppCheckoutSession", () => {
  it("returns 500 when Stripe is not configured", async () => {
    const { createDppCheckoutSession } = await import("./dpp-checkout");
    const result = await createDppCheckoutSession({
      searchParams: new URLSearchParams({ email: "ops@brand.com" }),
      stripeSecretKey: "",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.status).toBe(500);
      expect(result.error).toMatch(/Stripe is not configured/);
    }
    expect(create).not.toHaveBeenCalled();
  });

  it("creates a $299 payment session and returns the Stripe URL", async () => {
    create.mockResolvedValue({
      url: "https://checkout.stripe.com/c/pay/cs_test_dpp",
    });
    const { createDppCheckoutSession } = await import("./dpp-checkout");
    const result = await createDppCheckoutSession({
      searchParams: new URLSearchParams({
        visit_id: "dpp_paid_1",
        utm_source: "seo",
        email: "ops@brand.com",
      }),
      stripeSecretKey: "sk_test_x",
    });
    expect(result).toEqual({
      ok: true,
      url: "https://checkout.stripe.com/c/pay/cs_test_dpp",
      visitId: "dpp_paid_1",
    });
    expect(create).toHaveBeenCalledOnce();
    const arg = create.mock.calls[0][0];
    expect(arg.mode).toBe("payment");
    expect(arg.line_items[0].price).toBe("price_1TwmD8GqTruSqV8TpAF8dfyA");
    expect(arg.client_reference_id).toBe("dpp_paid_1");
    expect(arg.allow_promotion_codes).toBeUndefined();
    expect(arg.metadata.offer).toBe(DPP_OFFER_KEY);
    expect(arg.metadata.plan).toBe("dpp_readiness");
    expect(arg.metadata.stripe_price_id).toBe("price_1TwmD8GqTruSqV8TpAF8dfyA");
    expect(arg.success_url).toContain(
      "/dpp/thanks?session_id={CHECKOUT_SESSION_ID}"
    );
    expect(arg.payment_method_types).toBeUndefined();
    expect(arg.after_expiration.recovery).toEqual({
      enabled: true,
      allow_promotion_codes: false,
    });
    expect(arg.consent_collection).toBeUndefined();
    expect(arg.customer_creation).toBe("always");
  });

  it("forwards a valid email as Stripe customer_email", async () => {
    create.mockResolvedValue({
      url: "https://checkout.stripe.com/c/pay/cs_test_dpp_email",
    });
    const { createDppCheckoutSession } = await import("./dpp-checkout");
    await createDppCheckoutSession({
      searchParams: new URLSearchParams({
        visit_id: "dpp_paid_2",
        email: "ops@brand.com",
      }),
      stripeSecretKey: "sk_test_x",
    });
    expect(create.mock.calls[0][0].customer_email).toBe("ops@brand.com");
  });

  it("303s back to /dpp when GET has no recovery email", async () => {
    const { createDppCheckoutSession } = await import("./dpp-checkout");
    const result = await createDppCheckoutSession({
      searchParams: new URLSearchParams({ visit_id: "dpp_paid_3" }),
      stripeSecretKey: "sk_test_x",
    });
    expect(result).toMatchObject({
      ok: false,
      status: 303,
      error: "email_required",
      url: "https://authichain.com/dpp?need_email=1&visit_id=dpp_paid_3",
    });
    expect(create).not.toHaveBeenCalled();
  });

  it("omits customer_email when the query is not an address", async () => {
    const { createDppCheckoutSession } = await import("./dpp-checkout");
    const result = await createDppCheckoutSession({
      searchParams: new URLSearchParams({
        visit_id: "dpp_paid_3",
        email: "not-an-email",
      }),
      stripeSecretKey: "sk_test_x",
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("email_required");
    expect(create).not.toHaveBeenCalled();
  });

  it("honors DPP-SMOKE-E2E as a $0 demo session", async () => {
    create.mockResolvedValue({
      url: "https://checkout.stripe.com/c/pay/cs_test_smoke",
    });
    const { createDppCheckoutSession } = await import("./dpp-checkout");
    const result = await createDppCheckoutSession({
      searchParams: new URLSearchParams({
        visit_id: "dpp_smoke_2",
        promo: "DPP-SMOKE-E2E",
      }),
      stripeSecretKey: "sk_test_x",
    });
    expect(result.ok).toBe(true);
    const arg = create.mock.calls[0][0];
    expect(arg.line_items[0].price).toBeUndefined();
    expect(arg.line_items[0].price_data.unit_amount).toBe(0);
    expect(arg.payment_method_collection).toBeUndefined();
    expect(arg.metadata.is_demo).toBe("true");
    expect(arg.metadata.promo).toBe("DPP-SMOKE-E2E");
    expect(arg.metadata.offer).toBe(DPP_OFFER_KEY);
    expect(arg.metadata.stripe_price_id).toBe("price_1TwmD8GqTruSqV8TpAF8dfyA");
    expect(arg.payment_method_types).toBeUndefined();
  });
});
