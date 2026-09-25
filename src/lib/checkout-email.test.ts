import { describe, expect, it } from "vitest";
import {
  CHECKOUT_NEED_EMAIL_BANNER_HTML,
  CHECKOUT_NEED_EMAIL_DECORATE_JS,
  CHECKOUT_REDIRECT_HEADERS,
  catalogPaymentLinkHtml,
  checkoutEmailFormHtml,
  checkoutNeedEmailRedirect,
  checkoutRedirectResponse,
  emailCheckoutWithPaymentLinkHtml,
  emailPaymentLinkHtml,
  looksLikeCheckoutEmail,
  paymentLinkWithPrefilledEmail,
  pickCheckoutEmail,
  planIdFromCheckoutAction,
  rewriteCheckoutHref,
  rewriteCheckoutHrefsInHtml,
  rewriteProxiedCheckoutHtml,
} from "./checkout-email";
import { planPaymentLink } from "./plans";

describe("looksLikeCheckoutEmail", () => {
  it("accepts a normal work address", () => {
    expect(looksLikeCheckoutEmail("buyer@example.com")).toBe(true);
    expect(looksLikeCheckoutEmail("  Buyer@Example.com  ")).toBe(true);
  });

  it("rejects strings Stripe would 400 on", () => {
    expect(looksLikeCheckoutEmail("")).toBe(false);
    expect(looksLikeCheckoutEmail("not-an-email")).toBe(false);
    expect(looksLikeCheckoutEmail("a@b")).toBe(false);
    expect(looksLikeCheckoutEmail("buyer@")).toBe(false);
  });
});

describe("pickCheckoutEmail", () => {
  it("returns the first valid candidate", () => {
    expect(pickCheckoutEmail("nope", "ops@brand.com", "also@x.com")).toBe(
      "ops@brand.com"
    );
    expect(pickCheckoutEmail(undefined, "")).toBe("");
  });
});

describe("checkoutEmailFormHtml", () => {
  it("POSTs to the gated confirm path with a required email field", () => {
    const html = checkoutEmailFormHtml({
      action: "/api/checkout/dpp",
      label: "Start DPP checkout — $299",
      formId: "dpp-checkout-form",
      inputId: "dpp-email",
    });
    expect(html).toContain('action="https://authichain.com/checkout/dpp_readiness"');
    expect(html).toContain('method="post"');
    expect(html).not.toContain('method="get"');
    expect(html).toContain('name="email"');
    expect(html).toContain("required");
    expect(html).toContain("No newsletter");
    expect(html).not.toContain("javascript:");
  });
});

describe("catalogPaymentLinkHtml", () => {
  it("links the gated Passport confirm page, never buy.stripe.com", () => {
    const html = catalogPaymentLinkHtml({
      planId: "strainchain_passport",
      label: "Pay $49 on Stripe",
    });
    expect(html).toContain(
      'href="https://authichain.com/checkout/strainchain_passport"'
    );
    expect(html).not.toContain("buy.stripe.com");
    expect(html).toContain("Pay $49 on Stripe");
    expect(html).not.toContain("/api/checkout");
  });

  it("links the gated DPP confirm page", () => {
    const html = catalogPaymentLinkHtml({
      planId: "dpp_readiness",
      label: "Pay $299 on Stripe",
    });
    expect(html).toContain(
      'href="https://authichain.com/checkout/dpp_readiness"'
    );
  });
});

describe("planIdFromCheckoutAction", () => {
  it("maps DPP, protocol DPP, and plan checkout paths", () => {
    expect(planIdFromCheckoutAction("/api/checkout/dpp")).toBe("dpp_readiness");
    expect(
      planIdFromCheckoutAction("https://authichain.govchain.us/api/checkout/dpp")
    ).toBe("dpp_readiness");
    expect(planIdFromCheckoutAction("/protocol/checkout/dpp")).toBe(
      "dpp_readiness"
    );
    expect(
      planIdFromCheckoutAction("/api/checkout/plan/strainchain_passport")
    ).toBe("strainchain_passport");
  });

  it("ignores generate and unknown plan ids", () => {
    expect(planIdFromCheckoutAction("/generate")).toBeUndefined();
    expect(planIdFromCheckoutAction("/api/checkout/plan/nope")).toBeUndefined();
  });
});

describe("emailCheckoutWithPaymentLinkHtml", () => {
  it("keeps the email form and appends the catalogue Payment Link", () => {
    const html = emailCheckoutWithPaymentLinkHtml({
      action: "/api/checkout/dpp",
      label: "Start DPP checkout — $299",
    });
    expect(html).toContain('action="https://authichain.com/checkout/dpp_readiness"');
    expect(html).toContain('name="email"');
    expect(html).toContain(
      'href="https://authichain.com/checkout/dpp_readiness"'
    );
    expect(html).toContain("Pay $299 on Stripe");
    expect(html).not.toContain('href="/api/checkout/dpp"');
    expect(html).not.toContain("prefilled_email=");
  });
});

describe("paymentLinkWithPrefilledEmail (gated)", () => {
  it("uses ?email= for the gated confirm page", () => {
    const gated = "https://authichain.com/checkout/creator?utm_source=email";
    expect(paymentLinkWithPrefilledEmail(gated, "a@b.co")).toBe(
      `${gated}&email=a%40b.co`
    );
  });
});

describe("rewriteCheckoutHref (buy.stripe.com)", () => {
  it("maps a raw Payment Link to the gated page, keeping email + utm", () => {
    expect(
      rewriteCheckoutHref(
        "https://buy.stripe.com/cNi9ATdrH4t811U4ba1ND3y?prefilled_email=a%40b.co&utm_source=x"
      )
    ).toBe(
      "https://authichain.com/checkout/strainchain_passport?email=a%40b.co&utm_source=x"
    );
    expect(rewriteCheckoutHref("https://buy.stripe.com/unknown")).toBeUndefined();
    expect(rewriteCheckoutHref("https://authichain.com/checkout/creator")).toBeUndefined();
  });
});

describe("paymentLinkWithPrefilledEmail", () => {
  const dpp = "https://buy.stripe.com/bJe7sLgDTaRwh0S9vu1ND0c";

  it("appends encoded prefilled_email when an address is present", () => {
    const url = paymentLinkWithPrefilledEmail(dpp, "buyer@brand.com");
    expect(url).toContain("prefilled_email=buyer%40brand.com");
    expect(url).toContain("locked_prefilled_email=buyer%40brand.com");
    expect(url.startsWith(`${dpp}?`)).toBe(true);
    expect(url).not.toContain("??");
  });

  it("returns the bare slug when email is absent or invalid", () => {
    expect(paymentLinkWithPrefilledEmail(dpp)).toBe(dpp);
    expect(paymentLinkWithPrefilledEmail(dpp, "")).toBe(dpp);
    expect(paymentLinkWithPrefilledEmail(dpp, "not-an-email")).toBe(dpp);
  });

  it("does not introduce a second ? when the slug already has a query", () => {
    const withUtm = `${dpp}?utm_source=email`;
    const url = paymentLinkWithPrefilledEmail(withUtm, "buyer@brand.com");
    expect(url).toContain("utm_source=email");
    expect(url).toContain("prefilled_email=buyer%40brand.com");
    expect(url).not.toContain("??");
    expect(url.split("?").length).toBe(2);
  });
});

describe("emailPaymentLinkHtml", () => {
  it("prefills ?email= on the gated confirm page when email is present", () => {
    const html = emailPaymentLinkHtml({
      planId: "dpp_readiness",
      label: "Pay $299 on Stripe",
      email: "buyer@brand.com",
    });
    expect(html).toContain('href="https://authichain.com/checkout/dpp_readiness?email=buyer%40brand.com"');
    expect(html).not.toContain("buy.stripe.com");
    expect(html).not.toContain("prefilled_email=");
    expect(html).toContain("Pay $299 on Stripe");
  });

  it("keeps the bare slug when email is absent", () => {
    const html = emailPaymentLinkHtml({
      planId: "dpp_readiness",
      label: "Pay $299 on Stripe",
    });
    expect(html).toContain(
      'href="https://authichain.com/checkout/dpp_readiness"'
    );
    expect(html).not.toContain("email=");
  });
});

describe("checkoutNeedEmailRedirect", () => {
  it("sends DPP and plan one-clicks to the gated confirm page / chooser", () => {
    expect(checkoutNeedEmailRedirect("dpp", "dpp_abc")).toBe(
      "https://authichain.com/checkout/dpp_readiness?need_email=1&visit_id=dpp_abc"
    );
    expect(checkoutNeedEmailRedirect("plan")).toBe(
      "https://authichain.com/checkout?need_email=1"
    );
    expect(
      checkoutNeedEmailRedirect("plan", undefined, "strainchain_farm")
    ).toBe("https://authichain.com/checkout/strainchain_farm?need_email=1");
  });

  it("keeps visit_id when decorating bounced checkout forms", () => {
    expect(CHECKOUT_NEED_EMAIL_BANNER_HTML).toContain(
      'id="checkout-need-email-banner"'
    );
    expect(CHECKOUT_NEED_EMAIL_DECORATE_JS).toContain("need_email");
    expect(CHECKOUT_NEED_EMAIL_DECORATE_JS).toContain("visit_id");
  });
});

describe("checkoutRedirectResponse", () => {
  it("303s with noindex so Bing cannot rank the session URL", () => {
    const res = checkoutRedirectResponse(
      "https://checkout.stripe.com/c/pay/cs_test"
    );
    expect(res.status).toBe(303);
    expect(res.headers.get("location")).toBe(
      "https://checkout.stripe.com/c/pay/cs_test"
    );
    expect(res.headers.get("x-robots-tag")).toBe("noindex, nofollow");
    expect(res.headers.get("cache-control")).toMatch(/no-store/);
    expect(CHECKOUT_REDIRECT_HEADERS["X-Robots-Tag"]).toBe("noindex, nofollow");
  });
});

describe("rewriteCheckoutHref", () => {
  const dpp = planPaymentLink("dpp_readiness");
  const passport = planPaymentLink("strainchain_passport");

  it("maps DPP, Passport, and Farm checkout paths to catalogue Payment Links", () => {
    expect(rewriteCheckoutHref("/api/checkout/dpp")).toBe(dpp);
    expect(
      rewriteCheckoutHref("/protocol/checkout/dpp?visit_id=dpp_anon")
    ).toBe(`${dpp}?visit_id=dpp_anon`);
    expect(
      rewriteCheckoutHref(
        "https://authichain.govchain.us/api/checkout/plan/strainchain_passport"
      )
    ).toBe(passport);
    expect(rewriteCheckoutHref("/api/checkout/plan/strainchain_farm")).toBe(
      planPaymentLink("strainchain_farm")
    );
    expect(rewriteCheckoutHref("/api/checkout/plan/theater_1")).toBe(
      planPaymentLink("theater_1")
    );
    expect(rewriteCheckoutHref("/api/checkout/plan/theater_3")).toBe(
      planPaymentLink("theater_3")
    );
  });

  it("leaves email forms, foreign hosts, and SKUs without a Payment Link", () => {
    expect(rewriteCheckoutHref("/pricing")).toBeUndefined();
    expect(
      rewriteCheckoutHref("https://strainchain.io/api/checkout/dpp")
    ).toBeUndefined();
  });
});

describe("rewriteCheckoutHrefsInHtml", () => {
  it("rewrites anchors and leaves form actions for email capture", () => {
    const dpp = planPaymentLink("dpp_readiness") ?? "";
    const html =
      '<a href="/api/checkout/dpp">DPP</a>' +
      '<form action="/api/checkout/dpp"><input name="email"></form>';
    const out = rewriteCheckoutHrefsInHtml(html);
    expect(out).toContain(`href="${dpp}"`);
    expect(out).toContain('action="/api/checkout/dpp"');
    expect(out).not.toContain('href="/api/checkout/dpp"');
  });
});

describe("rewriteProxiedCheckoutHtml", () => {
  it("skips JSON so API bodies are not rewritten", async () => {
    const body = JSON.stringify({ href: "/api/checkout/dpp" });
    const res = await rewriteProxiedCheckoutHtml(
      new Response(body, {
        status: 200,
        headers: { "Content-Type": "application/json" },
      })
    );
    expect(await res.text()).toBe(body);
  });

  it("rewrites HTML proxied from a stale APP_WORKER", async () => {
    const dpp = planPaymentLink("dpp_readiness") ?? "";
    const res = await rewriteProxiedCheckoutHtml(
      new Response('<a href="/api/checkout/dpp">DPP checkout</a>', {
        status: 200,
        headers: { "Content-Type": "text/html; charset=UTF-8" },
      })
    );
    const html = await res.text();
    expect(html).toContain(`href="${dpp}"`);
    expect(html).not.toContain('href="/api/checkout/dpp"');
  });
});
