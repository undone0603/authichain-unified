import { describe, expect, it, vi } from "vitest";
import { createHmac } from "node:crypto";
import {
  buildGatedSessionBody,
  gatedCheckoutPlanIds,
  gatedConfirmUrl,
  checkoutReturnOrigin,
  isAllowedPostOrigin,
  isAutomatedCheckoutRequest,
  planFromGatedPath,
  renderCheckoutChooserPage,
  renderCheckoutConfirmPage,
  tryHandleGatedCheckout,
  isQronGatedPlan,
  verifyQronAttestationToken,
} from "./checkout-gate";
import { planById, planPaymentLink } from "./plans";

vi.mock("./checkout-protection", () => ({
  claimCheckoutAttempt: async () => ({ allowed: true }),
  recordCheckoutSession: async () => true,
}));

const HUMAN_UA =
  "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

const protection = {
  claimCheckout: vi.fn(async () => ({ allowed: true as const })),
  recordSession: vi.fn(async () => true),
};

function stripeOk() {
  return vi.fn<typeof fetch>().mockResolvedValue(
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
    expect(planFromGatedPath("/checkout/launch")?.id).toBe("qron_launch");
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
    const launch = await tryHandleGatedCheckout(
      new Request("https://authichain.com/checkout/launch"),
      {}
    );
    // qron_launch is retired for new buyers (RES-86c): alias goes to /pricing.
    expect(launch!.status).toBe(303);
    expect(launch!.headers.get("location")).toBe("/pricing");
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
      { fetchImpl, ...protection }
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
    const first = await tryHandleGatedCheckout(request(), env, {
      fetchImpl,
      ...protection,
    });
    expect(first!.status).toBe(502);
    expect(await first!.text()).toContain(checkoutKey);

    const retry = await tryHandleGatedCheckout(request(), env, {
      fetchImpl,
      ...protection,
    });
    expect(retry!.status).toBe(303);
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    for (const [, init] of fetchImpl.mock.calls) {
      expect(init?.headers).toMatchObject({
        "Idempotency-Key": checkoutKey,
      });
    }
  });

  it("both Launch plans reach Stripe with no attestation token on the form", async () => {
    // Regression: qron_launch used to 403 unless a `qron_attestation` field was
    // posted, but the confirm page never rendered it and nothing issues tokens.
    for (const id of ["qron_launch", "qron_launch_annual"] as const) {
      const fetchImpl = stripeOk();
      const res = await tryHandleGatedCheckout(
        post(`/checkout/${id}`, {
          email: "buyer@example.com",
          checkout_key: "12345678-1234-4234-8234-123456789abc",
        }),
        { STRIPE_SECRET_KEY: "sk_test_x" },
        { fetchImpl, ...protection }
      );
      expect(res!.status).toBe(303);
      expect(res!.headers.get("location")).toBe(
        "https://checkout.stripe.com/c/pay/cs_test_gate"
      );
      expect(fetchImpl).toHaveBeenCalledOnce();
      const [, init] = fetchImpl.mock.calls[0] as unknown as [
        string,
        { body: URLSearchParams },
      ];
      const body = new URLSearchParams(String(init.body));
      expect(body.get("mode")).toBe("subscription");
      expect(body.get("line_items[0][price]")).toBe(
        planById(id)!.stripe_price_id
      );
      expect(body.get("metadata[plan]")).toBe(id);
    }
  });

  it("the Launch confirm page does not ask for an attestation token", () => {
    const html = renderCheckoutConfirmPage({
      plan: planById("qron_launch")!,
      params: new URLSearchParams(),
    });
    expect(html).not.toContain("qron_attestation");
  });

  it("lets Checkout choose payment methods for Launch Annual", () => {
    const body = buildGatedSessionBody({
      plan: planById("qron_launch_annual")!,
      email: "a@b.co",
      fields: new URLSearchParams(),
    });
    expect(body.get("mode")).toBe("subscription");
    expect(body.get("line_items[0][price]")).toBe(
      planById("qron_launch_annual")!.stripe_price_id
    );
    expect(
      [...body.keys()].some(key => key.startsWith("payment_method_types"))
    ).toBe(false);
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

    // /dpp/thanks names a DPP workspace; Starter grants 100.
    expect(success).not.toContain("/dpp/thanks");
    expect(success).toContain("https://authichain.com/generate?paid=1");
    expect(cancel).toContain("https://authichain.com/generate?cancelled=1");

    // Attribution must survive the redirect, as it does on every other path.
    expect(success).toContain("visit_id=chk_starter_1");
    expect(cancel).toContain("visit_id=chk_starter_1");
    expect(success).toContain("session_id={CHECKOUT_SESSION_ID}");
  });

  it("Starter carries plan metadata on the session and the PaymentIntent", () => {
    const body = buildGatedSessionBody({
      plan: planById("starter")!,
      email: "a@b.co",
      fields: new URLSearchParams({ visit_id: "chk_starter_2" }),
      successOrigin: "https://authichain.com",
    });
    expect(body.get("mode")).toBe("payment");
    expect(body.get("metadata[plan]")).toBe("starter");
    expect(body.get("metadata[stripe_price_id]")).toBe(
      planById("starter")!.stripe_price_id
    );
    expect(body.get("payment_intent_data[metadata][plan]")).toBe("starter");
    expect(body.get("payment_intent_data[metadata][stripe_price_id]")).toBe(
      planById("starter")!.stripe_price_id
    );
    expect(body.get("subscription_data[metadata][plan]")).toBeNull();
  });

  it("does not add PaymentIntent metadata to non-Starter plans", () => {
    for (const id of ["creator", "dpp_readiness", "qron_launch"] as const) {
      const body = buildGatedSessionBody({
        plan: planById(id)!,
        email: "a@b.co",
        fields: new URLSearchParams(),
      });
      expect(body.get("payment_intent_data[metadata][plan]")).toBeNull();
    }
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
    expect(claim.get("success_url")).toContain(
      "/made-in-usa-claim-file/thanks"
    );
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

describe("CFA-460: /checkout/starter confirm copy", () => {
  it("shows the Research PASS FREE-PREVIEW sentence and no Launch $19 copy", async () => {
    const res = await tryHandleGatedCheckout(
      new Request("https://authichain.com/checkout/starter"),
      {}
    );
    expect(res).not.toBeNull();
    expect(res!.status).toBe(200);
    const html = await res!.text();
    expect(html).toContain(
      "100 AI QR generations for $29, paid once. No subscription. Starting a monthly plan replaces unused pack credits."
    );
    expect(html).not.toContain("$19");
    expect(html).not.toContain("qron_launch");
    expect(html).not.toContain("Launch subscription");
    expect(html).not.toContain("never expire");
    expect(html).not.toContain("never-expire");
    expect(html).not.toContain("no expiry");
    expect(html).not.toContain("no-expiry");
    expect(html).not.toContain("50 workspace generations");
  });

  it("plans.ts Starter pricing copy uses the Advisor-GO replace-only sentence", () => {
    expect(planById("starter")?.description).toBe(
      "100 AI QR generations for $29, paid once. No subscription. Starting a monthly plan replaces unused pack credits."
    );
    expect(planById("starter")?.features).toContain(
      "Starting a monthly plan replaces unused pack credits"
    );
    expect(planById("starter")?.description).not.toContain("never expire");
    expect(planById("starter")?.features?.join(" ")).not.toContain(
      "never expire"
    );
  });
});

describe("Launch Annual cadence", () => {
  it("shows $190/yr on the confirm page and the plan chooser", () => {
    const annual = planById("qron_launch_annual");
    const monthly = planById("qron_launch");
    expect(annual).toBeTruthy();
    expect(monthly).toBeTruthy();
    const confirm = renderCheckoutConfirmPage({ plan: annual! });
    expect(confirm).toContain("$190/yr");
    expect(confirm).not.toContain("$190/mo");
    expect(renderCheckoutConfirmPage({ plan: monthly! })).toContain("$19/mo");
    const chooser = renderCheckoutChooserPage();
    // Direct chooser links. listed stays false, so /pricing and /generate do not grow Launch buttons.
    expect(chooser).toContain('href="/checkout/qron_launch"');
    expect(chooser).toContain('href="/checkout/qron_launch_annual"');
    expect(chooser).toContain("$19/mo");
    expect(chooser).toContain("$190/yr");
    expect(planById("qron_launch")?.listed).toBe(false);
    expect(planById("qron_launch_annual")?.listed).toBe(false);
  });

  it("opens a subscription session for the annual price", () => {
    const plan = planById("qron_launch_annual")!;
    const body = buildGatedSessionBody({
      plan,
      email: "a@b.co",
      fields: new URLSearchParams(),
    });
    expect(body.get("mode")).toBe("subscription");
    expect(body.get("line_items[0][price]")).toBe(plan.stripe_price_id);
  });

  it("lands generation buyers on /generate, not the DPP thanks page", () => {
    for (const id of [
      "qron_launch",
      "qron_launch_annual",
      "creator",
    ] as const) {
      const body = buildGatedSessionBody({
        plan: planById(id)!,
        email: "a@b.co",
        fields: new URLSearchParams({ visit_id: "v1" }),
        successOrigin: "https://authichain.com",
      });
      const success = body.get("success_url") || "";
      expect(success, id).toContain("https://authichain.com/generate?paid=1");
      expect(success, id).not.toContain("/dpp/thanks");
    }
  });
});

function mintTestQronToken(
  secret: string,
  nonce = "testnonce01",
  expiresAt = Math.floor(Date.now() / 1000) + 3600
): string {
  const payload = `QRON-${nonce}.${expiresAt}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return `${payload}.${sig}`;
}

describe("QRON Interdiction Gate (qron_launch)", () => {
  const secret = "test_qron_interdiction_secret_key_2026";
  const validToken = mintTestQronToken(secret, "unit_00012345");

  it("verifies a valid HMAC-SHA256 QRON attestation token and rejects tampered tokens", async () => {
    expect(await verifyQronAttestationToken(validToken, secret)).toBe(true);
    expect(await verifyQronAttestationToken("QRON-spoofed", secret)).toBe(
      false
    );
    expect(
      await verifyQronAttestationToken(
        validToken.slice(0, -2) + (validToken.endsWith("00") ? "ff" : "00"),
        secret
      )
    ).toBe(false);
    expect(await verifyQronAttestationToken("", secret)).toBe(false);
    expect(await verifyQronAttestationToken(validToken, "")).toBe(false);
  });

  it("renders a visible qron_attestation input on the qron_launch confirm page without duplicating it as hidden", () => {
    const plan = planById("qron_launch")!;
    const params = new URLSearchParams({
      email: "buyer@example.com",
      qron_attestation: validToken,
    });
    const html = renderCheckoutConfirmPage({ plan, params });

    expect(html).toContain('id="checkout-confirm-attestation"');
    expect(html).toContain(`value="${validToken}"`);
    expect(html).not.toContain('<input type="hidden" name="qron_attestation"');
  });

  // Both QRON gated plans are retired (RES-86c follow-up): the retired check
  // runs before the attestation gate, so POSTs 303 to /pricing.
  it("retired: POST /checkout/qron_launch_annual with an unsigned attestation 303s to /pricing", async () => {
    const body = new URLSearchParams({
      email: "founder@authichain.com",
      qron_attestation: "QRON-spoofed",
    });
    const req = new Request(
      "https://authichain.com/checkout/qron_launch_annual",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": HUMAN_UA,
          Origin: "https://authichain.com",
        },
        body: body.toString(),
      }
    );

    const res = await tryHandleGatedCheckout(req, {
      STRIPE_SECRET_KEY: "sk_test_mock",
      QRON_INTERDICTION_SECRET: secret,
    });

    expect(res?.status).toBe(303);
    expect(res?.headers.get("location")).toBe("/pricing");
    expect(await res!.text()).not.toContain("<form");
  });

  it("retired: POST /checkout/qron_launch_annual with a valid signed token never calls Stripe", async () => {
    let capturedStripeBody = null as URLSearchParams | null;
    const body = new URLSearchParams({
      email: "founder@authichain.com",
      qron_attestation: validToken,
      checkout_key: "11111111-2222-3333-4444-555555555555",
    });
    const req = new Request(
      "https://authichain.com/checkout/qron_launch_annual",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
          "User-Agent": HUMAN_UA,
          Origin: "https://authichain.com",
        },
        body: body.toString(),
      }
    );

    const res = await tryHandleGatedCheckout(
      req,
      {
        STRIPE_SECRET_KEY: "sk_test_mock",
        QRON_INTERDICTION_SECRET: secret,
      },
      {
        claimCheckout: async () => ({ allowed: true }),
        recordSession: async () => true,
        fetchImpl: async (_url, init) => {
          capturedStripeBody = new URLSearchParams(String(init?.body ?? ""));
          return new Response(
            JSON.stringify({
              url: "https://checkout.stripe.com/c/pay/cs_test_qron",
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
          );
        },
      }
    );

    expect(res?.status).toBe(303);
    expect(res?.headers.get("Location")).toBe("/pricing");
    expect(capturedStripeBody).toBeNull();
  });
});

describe("QRON Interdiction Gate hardening", () => {
  const secret = "test_qron_interdiction_secret_key_2026";

  function postCheckout(planId: string, attestation?: string) {
    const body = new URLSearchParams({
      email: "founder@authichain.com",
      checkout_key: "11111111-2222-3333-4444-555555555555",
    });
    if (attestation) body.set("qron_attestation", attestation);
    return new Request(`https://authichain.com/checkout/${planId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
        "User-Agent": HUMAN_UA,
        Origin: "https://authichain.com",
      },
      body: body.toString(),
    });
  }

  it("rejects an expired token and accepts it only before its signed expiry", async () => {
    const expiresAt = Math.floor(Date.now() / 1000) + 60;
    const token = mintTestQronToken(secret, "expiry_test_01", expiresAt);
    expect(await verifyQronAttestationToken(token, secret)).toBe(true);
    expect(
      await verifyQronAttestationToken(token, secret, (expiresAt + 1) * 1000)
    ).toBe(false);
    const past = mintTestQronToken(
      secret,
      "expiry_test_02",
      Math.floor(Date.now() / 1000) - 10
    );
    expect(await verifyQronAttestationToken(past, secret)).toBe(false);
  });

  it("rejects a token whose expiry was edited after signing", async () => {
    const expiresAt = Math.floor(Date.now() / 1000) - 10;
    const token = mintTestQronToken(secret, "expiry_test_03", expiresAt);
    const extended = token.replace(`.${expiresAt}.`, `.${expiresAt + 86400}.`);
    expect(await verifyQronAttestationToken(extended, secret)).toBe(false);
  });

  it("keeps qron_launch_annual QRON-gated but retired, so POSTs never reach Stripe", async () => {
    expect(isQronGatedPlan("qron_launch")).toBe(true);
    expect(isQronGatedPlan("qron_launch_annual")).toBe(true);
    expect(isQronGatedPlan("starter")).toBe(false);

    const denied = await tryHandleGatedCheckout(
      postCheckout("qron_launch_annual"),
      { STRIPE_SECRET_KEY: "sk_test_mock", QRON_INTERDICTION_SECRET: secret }
    );
    expect(denied?.status).toBe(303);
    expect(denied?.headers.get("location")).toBe("/pricing");

    const fetchImpl = vi.fn(
      async () =>
        new Response(
          JSON.stringify({
            url: "https://checkout.stripe.com/c/pay/cs_test_annual",
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        )
    );
    const allowed = await tryHandleGatedCheckout(
      postCheckout(
        "qron_launch_annual",
        mintTestQronToken(secret, "annual_test_01")
      ),
      { STRIPE_SECRET_KEY: "sk_test_mock", QRON_INTERDICTION_SECRET: secret },
      {
        claimCheckout: async () => ({ allowed: true }),
        recordSession: async () => true,
        fetchImpl,
      }
    );
    expect(allowed?.status).toBe(303);
    expect(allowed?.headers.get("location")).toBe("/pricing");
    expect(fetchImpl).not.toHaveBeenCalled();
  });

  it("redirects the retired qron_launch_annual confirm page to /pricing", async () => {
    const res = await tryHandleGatedCheckout(
      new Request("https://authichain.com/checkout/qron_launch_annual"),
      {}
    );
    expect(res!.status).toBe(303);
    expect(res!.headers.get("location")).toBe("/pricing");
  });
});
describe("retired /checkout/qron_launch (RES-86c)", () => {
  it("no longer renders the confirm form for any method", async () => {
    for (const method of ["GET", "HEAD", "POST"]) {
      const res = await tryHandleGatedCheckout(
        new Request("https://authichain.com/checkout/qron_launch?ref=x", {
          method,
          headers: {
            origin: "https://authichain.com",
            "content-type": "application/x-www-form-urlencoded",
          },
          body: method === "POST" ? "email=a%40b.co" : undefined,
        }),
        { STRIPE_SECRET_KEY: "sk_test_unused" }
      );
      expect(res!.status, method).toBe(303);
      expect(res!.headers.get("location"), method).toBe("/pricing");
      const html = await res!.text();
      expect(html, method).not.toContain("<form");
    }
  });

  it("leaves the plan itself intact for existing subscribers", () => {
    expect(planById("qron_launch")?.stripe_price_id).toBeTruthy();
    expect(isQronGatedPlan("qron_launch")).toBe(true);
  });

  it("redirects the retired annual plan to /pricing with no form", async () => {
    const res = await tryHandleGatedCheckout(
      new Request("https://authichain.com/checkout/qron_launch_annual"),
      {}
    );
    expect(res!.status).toBe(303);
    expect(res!.headers.get("location")).toBe("/pricing");
    expect(await res!.text()).not.toContain("<form");
  });
});

describe("wording sweep 2026-10-16: gap report and gov pilot gated SKUs", () => {
  it("resolves /checkout/<id> to the approved live prices", () => {
    expect(
      planFromGatedPath("/checkout/battery_gap_report")?.stripe_price_id
    ).toBe("price_1UREvgGqTruSqV8TMMYXVF69");
    expect(
      planFromGatedPath("/checkout/battery_gap_report_extra")?.stripe_price_id
    ).toBe("price_1UREviGqTruSqV8T04Pr9DR1");
    expect(
      planFromGatedPath("/checkout/gov_provenance_pilot")?.stripe_price_id
    ).toBe("price_1UREvjGqTruSqV8TzUZ4fxya");
    for (const id of [
      "battery_gap_report",
      "battery_gap_report_extra",
      "gov_provenance_pilot",
    ] as const) {
      expect(planPaymentLink(id)).toBe(`https://authichain.com/checkout/${id}`);
      expect(planById(id)?.stripe_payment_link).toBeUndefined();
      expect(planById(id)?.listed).toBe(false);
    }
  });
  it("extra model enables adjustable quantity 1-20; others do not", () => {
    const extra = buildGatedSessionBody({
      plan: planById("battery_gap_report_extra")!,
      email: "a@b.co",
      fields: new URLSearchParams(),
    });
    expect(extra.get("line_items[0][adjustable_quantity][enabled]")).toBe(
      "true"
    );
    expect(extra.get("line_items[0][adjustable_quantity][minimum]")).toBe("1");
    expect(extra.get("line_items[0][adjustable_quantity][maximum]")).toBe("20");
    const report = buildGatedSessionBody({
      plan: planById("battery_gap_report")!,
      email: "a@b.co",
      fields: new URLSearchParams(),
    });
    expect(
      report.get("line_items[0][adjustable_quantity][enabled]")
    ).toBeNull();
    expect(report.get("line_items[0][quantity]")).toBe("1");
  });
  it("service SKUs return to their offer page, not the DPP workspace page", () => {
    const gov = buildGatedSessionBody({
      plan: planById("gov_provenance_pilot")!,
      email: "a@b.co",
      fields: new URLSearchParams(),
    });
    expect(gov.get("success_url")).toMatch(
      /^https:\/\/authichain\.com\/made-in-america\?paid=1/
    );
    expect(gov.get("cancel_url")).toMatch(
      /^https:\/\/authichain\.com\/made-in-america\?cancelled=1/
    );
    const rep = buildGatedSessionBody({
      plan: planById("battery_gap_report")!,
      email: "a@b.co",
      fields: new URLSearchParams(),
    });
    expect(rep.get("success_url")).not.toContain("/dpp/thanks");
    expect(rep.get("success_url")).toMatch(
      /^https:\/\/authichain\.com\/battery-passport\?paid=1/
    );
  });
  it("gap-report confirm page uses email/no-call delivery, not 10 business days", () => {
    const html = renderCheckoutConfirmPage({
      plan: planById("battery_gap_report")!,
    });
    expect(html).toContain("arrives by email as a written document. No call.");
    expect(html).not.toContain("10 business days");
    expect(html).toContain("$950");
  });
});
