import { afterEach, describe, expect, it, vi } from "vitest";
import {
  tryHandleProtocolCheckout,
  tryHandleApiCheckoutEmailGate,
} from "./protocol-checkout";

function req(path: string, init?: RequestInit): Request {
  return new Request(`https://authichain.govchain.us${path}`, init);
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

  it("HEAD does not create a Stripe session", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const res = await tryHandleProtocolCheckout(
      req("/protocol/checkout/dpp", { method: "HEAD" }),
      { STRIPE_SECRET_KEY: "sk_live_x" }
    );
    expect(res!.status).toBe(204);
    expect(fetch).not.toHaveBeenCalled();
  });

  it("GET with a valid email 303s to the confirm page and never calls Stripe", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const res = await tryHandleProtocolCheckout(
      req("/protocol/checkout/dpp?visit_id=dpp_abc&email=buyer%40brand.com&utm_source=x"),
      { STRIPE_SECRET_KEY: "sk_live_x" }
    );
    expect(res!.status).toBe(303);
    const loc = new URL(res!.headers.get("location")!);
    expect(loc.origin + loc.pathname).toBe(
      "https://authichain.com/checkout/dpp_readiness"
    );
    expect(loc.searchParams.get("email")).toBe("buyer@brand.com");
    expect(loc.searchParams.get("visit_id")).toBe("dpp_abc");
    expect(loc.searchParams.get("utm_source")).toBe("x");
    expect(fetch).not.toHaveBeenCalled();
  });

  it("GET without email 303s to the confirm page (no Stripe)", async () => {
    vi.stubGlobal("fetch", vi.fn());
    const res = await tryHandleProtocolCheckout(
      req("/protocol/checkout/dpp?visit_id=dpp_abc&email=not-an-email"),
      { STRIPE_SECRET_KEY: "sk_test_x" }
    );
    expect(res!.status).toBe(303);
    expect(res!.headers.get("location")).toBe(
      "https://authichain.com/checkout/dpp_readiness?visit_id=dpp_abc"
    );
    expect(fetch).not.toHaveBeenCalled();
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
    expect(body).not.toContain("if_required");
    expect(body).toContain("is_demo");
    expect(body).toContain("DPP-SMOKE-E2E");
    expect(body).not.toContain("line_items[0][price]=");
    expect(body).toContain(
      "metadata[stripe_price_id]=price_1TwmD8GqTruSqV8TpAF8dfyA"
    );
  });
});

describe("tryHandleApiCheckoutEmailGate", () => {
  it("returns null for other API paths", () => {
    expect(tryHandleApiCheckoutEmailGate(req("/api/x402"))).toBeNull();
    expect(tryHandleApiCheckoutEmailGate(req("/dashboard"))).toBeNull();
  });

  it("HEAD /api/checkout/dpp is 204 and does not bounce", () => {
    const res = tryHandleApiCheckoutEmailGate(
      req("/api/checkout/dpp", { method: "HEAD" })
    );
    expect(res?.status).toBe(204);
    expect(res?.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("HEAD /api/checkout/plan/strainchain_farm is 204 and does not bounce", () => {
    const res = tryHandleApiCheckoutEmailGate(
      req("/api/checkout/plan/strainchain_farm", { method: "HEAD" })
    );
    expect(res?.status).toBe(204);
    expect(res?.headers.get("x-robots-tag")).toBe("noindex, nofollow");
  });

  it("every GET (with or without email) 303s to the gated confirm page", () => {
    const cases: Array<[string, string]> = [
      ["/api/checkout/dpp?visit_id=dpp_anon", "https://authichain.com/checkout/dpp_readiness?visit_id=dpp_anon"],
      ["/api/checkout/dpp?email=ops%40brand.com", "https://authichain.com/checkout/dpp_readiness?email=ops%40brand.com"],
      ["/api/checkout/plan/strainchain_passport", "https://authichain.com/checkout/strainchain_passport"],
      ["/api/checkout/plan/strainchain_farm?email=ops%40brand.com&utm_source=mail", "https://authichain.com/checkout/strainchain_farm?email=ops%40brand.com&utm_source=mail"],
      ["/api/checkout/plan/theater_3", "https://authichain.com/checkout/theater_3"],
      ["/api/checkout/plan/nope", "https://authichain.com/checkout?need_email=1"],
    ];
    for (const [path, loc] of cases) {
      const res = tryHandleApiCheckoutEmailGate(req(path));
      expect(res?.status, path).toBe(303);
      expect(res?.headers.get("location"), path).toBe(loc);
      expect(res?.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    }
  });

  it("only DPP-SMOKE-E2E falls through to APP_WORKER", () => {
    expect(
      tryHandleApiCheckoutEmailGate(req("/api/checkout/dpp?promo=DPP-SMOKE-E2E"))
    ).toBeNull();
  });
});
