import { afterEach, describe, expect, it, vi } from "vitest";
import { tryHandleProtocolCheckout } from "./protocol-checkout";

function req(path: string, init?: RequestInit): Request {
  return new Request(`https://authichain.com${path}`, init);
}

describe("tryHandleProtocolCheckout", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("returns null for other paths", async () => {
    expect(
      await tryHandleProtocolCheckout(req("/api/checkout/dpp"), {
        STRIPE_SECRET_KEY: "sk_test_x",
      })
    ).toBeNull();
  });

  it("returns 500 JSON when Stripe is not bound", async () => {
    const res = await tryHandleProtocolCheckout(
      req("/protocol/checkout/dpp?visit_id=dpp_abc"),
      {}
    );
    expect(res).not.toBeNull();
    expect(res!.status).toBe(500);
    expect(res!.headers.get("cache-control")).toMatch(/no-store/);
    await expect(res!.json()).resolves.toEqual({
      error: "Stripe is not configured",
    });
  });

  it("303s to the Stripe Checkout URL", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              url: "https://checkout.stripe.com/c/pay/cs_test_1",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          )
      )
    );
    const res = await tryHandleProtocolCheckout(
      req("/protocol/checkout/dpp?visit_id=dpp_abc&utm_source=smoke"),
      { STRIPE_SECRET_KEY: "sk_test_x" }
    );
    expect(res!.status).toBe(303);
    expect(res!.headers.get("location")).toBe(
      "https://checkout.stripe.com/c/pay/cs_test_1"
    );
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    expect(fetchMock).toHaveBeenCalledOnce();
    const init = fetchMock.mock.calls[0][1] as {
      headers: Record<string, string>;
      body: URLSearchParams;
    };
    expect(init.headers.Authorization).toBe("Bearer sk_test_x");
    const body = String(init.body);
    expect(body).toContain("price_1TwmD8GqTruSqV8TpAF8dfyA");
    expect(body).toContain("dpp_abc");
    expect(body).toContain("utm_source");
    expect(body).toContain("dpp_readiness_2026");
    expect(body).not.toContain("payment_method_types");
  });

  it("honors DPP-SMOKE-E2E as a $0 demo session", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(
            JSON.stringify({
              url: "https://checkout.stripe.com/c/pay/cs_test_smoke",
            }),
            {
              status: 200,
              headers: { "Content-Type": "application/json" },
            }
          )
      )
    );
    const res = await tryHandleProtocolCheckout(
      req("/protocol/checkout/dpp?visit_id=dpp_smoke&promo=DPP-SMOKE-E2E"),
      { STRIPE_SECRET_KEY: "sk_test_x" }
    );
    expect(res!.status).toBe(303);
    const fetchMock = fetch as unknown as ReturnType<typeof vi.fn>;
    const init = fetchMock.mock.calls[0][1] as { body: URLSearchParams };
    const body = decodeURIComponent(String(init.body));
    expect(body).toContain("unit_amount]=0");
    expect(body).toContain("if_required");
    expect(body).toContain("is_demo");
    expect(body).toContain("DPP-SMOKE-E2E");
    expect(body).not.toContain("price_1TwmD8GqTruSqV8TpAF8dfyA");
  });
});
