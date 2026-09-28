import { describe, expect, it, vi } from "vitest";
import {
  buildGatedSessionBody,
  gatedCheckoutPlanIds,
  gatedConfirmUrl,
  isAllowedPostOrigin,
  isAutomatedCheckoutRequest,
  planFromGatedPath,
  tryHandleGatedCheckout,
} from "./checkout-gate";
import { planById, planPaymentLink } from "./plans";

const HUMAN_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

function stripeOk() {
  return vi.fn(
    async () =>
      new Response(
        JSON.stringify({ url: "https://checkout.stripe.com/c/pay/cs_test_gate" }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
  );
}

function post(path: string, form: Record<string, string>, headers: Record<string, string> = {}) {
  return new Request(`https://authichain.com${path}`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      "user-agent": HUMAN_UA,
      origin: "https://authichain.com",
      ...headers,
    },
    body: new URLSearchParams(form).toString(),
  });
}

describe("gated checkout paths", () => {
  it("planPaymentLink returns the gated authichain.com URL, never buy.stripe.com", () => {
    for (const id of gatedCheckoutPlanIds()) {
      const link = planPaymentLink(id)!;
      expect(link).toBe(`https://authichain.com/checkout/${id}`);
      expect(link).not.toContain("buy.stripe.com");
    }
  });

  it("resolves ids and aliases, rejects free/unknown plans", () => {
    expect(planFromGatedPath("/checkout/dpp")?.id).toBe("dpp_readiness");
    expect(planFromGatedPath("/checkout/theater_3/")?.id).toBe("theater_3");
    expect(planFromGatedPath("/checkout/free")).toBeUndefined();
    expect(planFromGatedPath("/checkout/nope")).toBeUndefined();
  });

  it("carries email + attribution into the confirm URL", () => {
    const u = new URL(
      gatedConfirmUrl(
        "strainchain_passport",
        new URLSearchParams("email=a%40b.co&utm_source=mail&junk=1&visit_id=v1")
      )
    );
    expect(u.pathname).toBe("/checkout/strainchain_passport");
    expect(u.searchParams.get("email")).toBe("a@b.co");
    expect(u.searchParams.get("utm_source")).toBe("mail");
    expect(u.searchParams.get("visit_id")).toBe("v1");
    expect(u.searchParams.get("junk")).toBeNull();
  });
});

describe("tryHandleGatedCheckout — GET/HEAD never call Stripe", () => {
  it("ignores other paths", async () => {
    expect(
      await tryHandleGatedCheckout(new Request("https://authichain.com/pricing"), {})
    ).toBeNull();
  });

  it("GET /checkout renders the plan chooser (200, noindex)", async () => {
    const fetchImpl = vi.fn();
    const res = await tryHandleGatedCheckout(
      new Request("https://authichain.com/checkout"),
      { STRIPE_SECRET_KEY: "sk_live_x" },
      { fetchImpl }
    );
    expect(res!.status).toBe(200);
    const html = await res!.text();
    expect(html).toContain('href="/checkout/dpp_readiness"');
    expect(html).toContain('href="/checkout/starter"');
    expect(html).not.toContain("strainchain_farm");
    expect(html).not.toContain("Farm Plan");
    expect(html).toContain("noindex");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("GET /checkout/starter renders confirm and never calls Stripe", async () => {
    const fetchImpl = vi.fn();
    const res = await tryHandleGatedCheckout(
      new Request("https://authichain.com/checkout/starter", {
        headers: { "user-agent": HUMAN_UA },
      }),
      { STRIPE_SECRET_KEY: "sk_live_x" },
      { fetchImpl },
    );
    expect(res!.status).toBe(200);
    const html = await res!.text();
    expect(html).toContain("Starter Pack");
    expect(html).toContain("$29");
    expect(html).toContain('method="post"');
    expect(html).toContain('action="/checkout/starter"');
    expect(html).not.toContain("js.stripe.com");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("GET /checkout/<plan> (even with email, bot UA or prefetch) renders a POST confirm form", async () => {
    const fetchImpl = vi.fn();
    for (const headers of [
      { "user-agent": HUMAN_UA },
      { "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
      { "user-agent": HUMAN_UA, "sec-purpose": "prefetch" },
      {},
    ]) {
      const res = await tryHandleGatedCheckout(
        new Request(
          "https://authichain.com/checkout/dpp_readiness?email=buyer%40brand.com&utm_source=mail",
          { headers }
        ),
        { STRIPE_SECRET_KEY: "sk_live_x" },
        { fetchImpl }
      );
      expect(res!.status).toBe(200);
      expect(res!.headers.get("cache-control")).toMatch(/no-store/);
      const html = await res!.text();
      expect(html).toContain('method="post"');
      expect(html).toContain('action="/checkout/dpp_readiness"');
      expect(html).toContain('value="buyer@brand.com"');
      expect(html).toContain('name="utm_source" value="mail"');
      expect(html).toContain("$299");
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("HEAD is 200 with no body and no Stripe call", async () => {
    const fetchImpl = vi.fn();
    const res = await tryHandleGatedCheckout(
      new Request("https://authichain.com/checkout/creator", { method: "HEAD" }),
      { STRIPE_SECRET_KEY: "sk_live_x" },
      { fetchImpl }
    );
    expect(res!.status).toBe(200);
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("aliases 301 to the canonical plan id; unknown plan 404s", async () => {
    const alias = await tryHandleGatedCheckout(
      new Request("https://authichain.com/checkout/dpp?email=a%40b.co"),
      {}
    );
    expect(alias!.status).toBe(301);
    expect(alias!.headers.get("location")).toBe("/checkout/dpp_readiness?email=a%40b.co");
    const unknown = await tryHandleGatedCheckout(
      new Request("https://authichain.com/checkout/nope"),
      {}
    );
    expect(unknown!.status).toBe(404);
  });
});
