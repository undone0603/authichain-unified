import { describe, expect, it, vi } from "vitest";
import {
  buildGatedSessionBody,
  gatedCheckoutPlanIds,
  gatedConfirmUrl,
  checkoutReturnOrigin,
  isAllowedPostOrigin,
  isAutomatedCheckoutRequest,
  planFromGatedPath,
  tryHandleGatedCheckout,
} from "./checkout-gate";
import { planById, planPaymentLink } from "./plans";

vi.mock("./checkout-protection", () => ({
  claimCheckoutAttempt: async () => ({ allowed: true }),
  recordCheckoutSession: async () => true,
}));

const HUMAN_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

function stripeOk() {
  return vi
    .fn<typeof fetch>()
    .mockResolvedValue(
      new Response(
        JSON.stringify({
          url: "https://checkout.stripe.com/c/pay/cs_test_gate",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      )
    );
}

function post(
  path: string,
  form: Record<string, string>,
  headers: Record<string, string> = {}
) {
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
      await tryHandleGatedCheckout(
        new Request("https://authichain.com/pricing"),
        {}
      )
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
      { fetchImpl }
    );
    expect(res!.status).toBe(200);
    const html = await res!.text();
    expect(html).toContain("Starter Pack");
    expect(html).toContain("$29");
    expect(html).toContain('method="post"');
    expect(html).toContain('action="/checkout/starter"');
    expect(html).toMatch(/name="checkout_key" value="[a-f0-9-]{36}"/);
    expect(html).not.toContain("js.stripe.com");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("GET /checkout/<plan> (even with email, bot UA or prefetch) renders a POST confirm form", async () => {
    const fetchImpl = vi.fn<typeof fetch>();
    const cases: Record<string, string>[] = [
      { "user-agent": HUMAN_UA },
      { "user-agent": "Mozilla/5.0 (compatible; Googlebot/2.1)" },
      { "user-agent": HUMAN_UA, "sec-purpose": "prefetch" },
      {},
    ];
    for (const headers of cases) {
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
    const fetchImpl = vi.fn<typeof fetch>();
    const res = await tryHandleGatedCheckout(
      new Request("https://authichain.com/checkout/creator", {
        method: "HEAD",
      }),
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
    expect(alias!.headers.get("location")).toBe(
      "/checkout/dpp_readiness?email=a%40b.co"
    );
    const unknown = await tryHandleGatedCheckout(
      new Request("https://authichain.com/checkout/nope"),
      {}
    );
    expect(unknown!.status).toBe(404);
  });
});

describe("tryHandleGatedCheckout — POST", () => {
  it("creates one session with customer_email and catalogue price, then 303s to Stripe", async () => {
    const fetchImpl = stripeOk();
    const res = await tryHandleGatedCheckout(
      post("/checkout/strainchain_farm", {
        email: "grower@farm.com",
        utm_source: "mail",
        visit_id: "v_1",
        checkout_key: "12345678-1234-4234-8234-123456789abc",
      }),
      { STRIPE_SECRET_KEY: "sk_test_x" },
      { fetchImpl }
    );
    expect(res!.status).toBe(303);
    expect(res!.headers.get("location")).toBe(
      "https://checkout.stripe.com/c/pay/cs_test_gate"
    );
    expect(fetchImpl).toHaveBeenCalledOnce();
    const [url, init] = fetchImpl.mock.calls[0] as unknown as [
      string,
      { body: URLSearchParams },
    ];
    expect(url).toBe("https://api.stripe.com/v1/checkout/sessions");
    const body = new URLSearchParams(String(init.body));
    expect(body.get("mode")).toBe("subscription");
    expect(body.get("line_items[0][price]")).toBe(
      planById("strainchain_farm")!.stripe_price_id
    );
    expect(body.get("customer_email")).toBe("grower@farm.com");
    expect(body.get("metadata[plan]")).toBe("strainchain_farm");
    expect(body.get("metadata[checkout_gate]")).toBe("confirm_post");
    expect(body.get("subscription_data[metadata][plan]")).toBe(
      "strainchain_farm"
    );
    expect(body.get("metadata[utm_source]")).toBe("mail");
    expect(body.get("client_reference_id")).toBe("v_1");
    expect(body.get("after_expiration[recovery][enabled]")).toBe("true");
    expect(fetchImpl.mock.calls[0]![1]?.headers).toMatchObject({
      "Idempotency-Key": "12345678-1234-4234-8234-123456789abc",
    });
  });

  it("reuses the form idempotency key after a Stripe network failure", async () => {
    const checkoutKey = "12345678-1234-4234-8234-123456789abc";
    const fetchImpl = vi
      .fn<typeof fetch>()
      .mockRejectedValueOnce(new Error("network timeout"))
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            url: "https://checkout.stripe.com/c/pay/cs_test_retry",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
      );
    const request = () =>
      post("/checkout/creator", { email: "a@b.co", checkout_key: checkoutKey });
    const env = { STRIPE_SECRET_KEY: "sk_test_x" };
    const first = await tryHandleGatedCheckout(request(), env, { fetchImpl });
    expect(first!.status).toBe(502);
    expect(await first!.text()).toContain(checkoutKey);

    const retry = await tryHandleGatedCheckout(request(), env, { fetchImpl });
    expect(retry!.status).toBe(303);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    for (const [, init] of fetchImpl.mock.calls) {
      expect(init?.headers).toMatchObject({
        "Idempotency-Key": checkoutKey,
      });
    }
  });

  it("DPP POST carries the DPP offer metadata", () => {
    const body = buildGatedSessionBody({
      plan: planById("dpp_readiness")!,
      email: "a@b.co",
      fields: new URLSearchParams(),
    });
    expect(body.get("mode")).toBe("payment");
    expect(body.get("metadata[offer]")).toBe("dpp_readiness_2026");
    expect(body.get("customer_creation")).toBe("always");
  });

  it("Starter lands on /generate, not the DPP workspace page", () => {
    const body = buildGatedSessionBody({
      plan: planById("starter")!,
      email: "a@b.co",
      fields: new URLSearchParams({ visit_id: "chk_starter_1" }),
      successOrigin: "https://authichain.com",
    });
    const success = body.get("success_url") || "";
    const cancel = body.get("cancel_url") || "";

    // /dpp/thanks names a DPP workspace and 50 generations; Starter grants 100.
    expect(success).not.toContain("/dpp/thanks");
    expect(success).toContain("https://authichain.com/generate?paid=1");
    expect(cancel).toContain("https://authichain.com/generate?cancelled=1");

    // Attribution must survive the redirect, as it does on every other path.
    expect(success).toContain("visit_id=chk_starter_1");
    expect(cancel).toContain("visit_id=chk_starter_1");
    expect(success).toContain("session_id={CHECKOUT_SESSION_ID}");
  });

  it("keeps every non-Starter plan on its existing landing", () => {
    const dpp = buildGatedSessionBody({
      plan: planById("dpp_readiness")!,
      email: "a@b.co",
      fields: new URLSearchParams(),
      successOrigin: "https://authichain.com",
    });
    expect(dpp.get("success_url")).toContain("/dpp/thanks");
    expect(dpp.get("cancel_url")).toContain("/dpp?cancelled=1");

    const claim = buildGatedSessionBody({
      plan: planById("musa_claim_file")!,
      email: "a@b.co",
      fields: new URLSearchParams(),
      successOrigin: "https://authichain.com",
    });
    expect(claim.get("success_url")).toContain("/made-in-usa-claim-file/thanks");
  });

  it("refuses bots, prefetch, foreign origins, honeypot and missing email without calling Stripe", async () => {
    const fetchImpl = stripeOk();
    const env = { STRIPE_SECRET_KEY: "sk_test_x" };
    const cases: Array<[Request, number]> = [
      [
        post(
          "/checkout/creator",
          { email: "a@b.co" },
          { "user-agent": "curl/8.5.0" }
        ),
        403,
      ],
      [
        post("/checkout/creator", { email: "a@b.co" }, { "user-agent": "" }),
        403,
      ],
      [
        post(
          "/checkout/creator",
          { email: "a@b.co" },
          { "user-agent": "Mozilla/5.0 (compatible; bingbot/2.0)" }
        ),
        403,
      ],
      [
        post("/checkout/creator", { email: "a@b.co" }, { purpose: "prefetch" }),
        403,
      ],
      [
        post(
          "/checkout/creator",
          { email: "a@b.co" },
          { origin: "https://evil.example" }
        ),
        403,
      ],
      [post("/checkout/creator", { email: "a@b.co", website: "spam" }), 400],
      [post("/checkout/creator", {}), 400],
      [post("/checkout/creator", { email: "not-an-email" }), 400],
    ];
    for (const [req, status] of cases) {
      const res = await tryHandleGatedCheckout(req, env, { fetchImpl });
      expect(res!.status).toBe(status);
    }
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("keeps Stripe return URLs on an allowlisted host", () => {
    const evil = new Request("https://authichain.govchain.us/api/checkout", {
      method: "POST",
      headers: { origin: "https://evil.example" },
    });
    expect(checkoutReturnOrigin(evil)).toBe("https://authichain.govchain.us");

    const brand = new Request("https://authichain.govchain.us/api/checkout", {
      method: "POST",
      headers: { origin: "https://app.strainchain.io" },
    });
    expect(checkoutReturnOrigin(brand)).toBe("https://app.strainchain.io");

    const httpOrigin = new Request("https://authichain.com/api/checkout", {
      method: "POST",
      headers: { origin: "http://authichain.com" },
    });
    expect(checkoutReturnOrigin(httpOrigin)).toBe("https://authichain.com");

    const unknownHost = new Request("https://evil.example/api/checkout", {
      method: "POST",
    });
    expect(checkoutReturnOrigin(unknownHost)).toBe("https://authichain.com");
  });

  it("allows cross-site POST from the estate sites", () => {
    for (const o of [
      "https://strainchain.io",
      "https://qron.space",
      "https://govchain.us",
      "https://authichain.govchain.us",
    ]) {
      expect(
        isAllowedPostOrigin(
          new Request("https://authichain.com/checkout/creator", {
            method: "POST",
            headers: { origin: o },
          })
        )
      ).toBe(true);
    }
  });

  it("does not flag normal mobile/desktop browsers", () => {
    for (const ua of [
      HUMAN_UA,
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36",
      "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [LinkedInApp]",
    ]) {
      expect(
        isAutomatedCheckoutRequest(
          new Request("https://authichain.com/", {
            headers: { "user-agent": ua },
          })
        )
      ).toBe(false);
    }
  });

  it("returns 500-class HTML (no redirect) when Stripe is not configured", async () => {
    const res = await tryHandleGatedCheckout(
      post("/checkout/creator", { email: "a@b.co" }),
      {}
    );
    expect(res!.status).toBe(500);
  });
});
