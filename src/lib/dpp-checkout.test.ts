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
      searchParams: new URLSearchParams(),
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
    expect(arg.allow_promotion_codes).toBe(true);
    expect(arg.metadata.offer).toBe(DPP_OFFER_KEY);
    expect(arg.metadata.plan).toBe("dpp_readiness");
    expect(arg.success_url).toContain(
      "/dpp/thanks?session_id={CHECKOUT_SESSION_ID}"
    );
    expect(arg.payment_method_types).toBeUndefined();
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
    expect(arg.payment_method_collection).toBe("if_required");
    expect(arg.metadata.is_demo).toBe("true");
    expect(arg.metadata.promo).toBe("DPP-SMOKE-E2E");
    expect(arg.metadata.offer).toBe(DPP_OFFER_KEY);
    expect(arg.payment_method_types).toBeUndefined();
  });
});
