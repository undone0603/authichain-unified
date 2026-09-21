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
  looksLikeCheckoutEmail,
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
  it("GETs the live checkout path with a required email field", () => {
    const html = checkoutEmailFormHtml({
      action: "/api/checkout/dpp",
      label: "Start DPP checkout — $299",
      formId: "dpp-checkout-form",
      inputId: "dpp-email",
    });
    expect(html).toContain('action="/api/checkout/dpp"');
    expect(html).toContain('method="get"');
    expect(html).toContain('name="email"');
    expect(html).toContain("required");
    expect(html).toContain("Not a newsletter");
    expect(html).not.toContain("javascript:");
  });
});

describe("catalogPaymentLinkHtml", () => {
  it("uses the live Passport Payment Link from plans.ts", () => {
    const html = catalogPaymentLinkHtml({
      planId: "strainchain_passport",
      label: "Pay $49 on Stripe",
    });
    expect(html).toContain(
      'href="https://buy.stripe.com/cNi9ATdrH4t811U4ba1ND3y"'
    );
    expect(html).toContain("Pay $49 on Stripe");
    expect(html).not.toContain("/api/checkout");
  });

  it("uses the live DPP Payment Link from plans.ts", () => {
    const html = catalogPaymentLinkHtml({
      planId: "dpp_readiness",
      label: "Pay $299 on Stripe",
    });
    expect(html).toContain(
      'href="https://buy.stripe.com/bJe7sLgDTaRwh0S9vu1ND0c"'
    );
  });
});

describe("planIdFromCheckoutAction", () => {
  it("maps DPP, protocol DPP, and plan checkout paths", () => {
    expect(planIdFromCheckoutAction("/api/checkout/dpp")).toBe("dpp_readiness");
    expect(
      planIdFromCheckoutAction("https://authichain.com/api/checkout/dpp")
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
    expect(html).toContain('action="/api/checkout/dpp"');
    expect(html).toContain('name="email"');
    expect(html).toContain(
      'href="https://buy.stripe.com/bJe7sLgDTaRwh0S9vu1ND0c"'
    );
    expect(html).toContain("Pay $299 on Stripe");
    expect(html).not.toContain('href="/api/checkout/dpp"');
  });
});

describe("checkoutNeedEmailRedirect", () => {
  it("sends DPP and plan one-clicks to landings that capture email", () => {
    expect(checkoutNeedEmailRedirect("dpp", "dpp_abc")).toBe(
      "https://authichain.com/dpp?need_email=1&visit_id=dpp_abc"
    );
    expect(checkoutNeedEmailRedirect("plan")).toBe(
      "https://authichain.com/pricing?need_email=1"
    );
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

  it("maps DPP and Passport checkout paths to catalogue Payment Links", () => {
    expect(rewriteCheckoutHref("/api/checkout/dpp")).toBe(dpp);
    expect(
      rewriteCheckoutHref("/protocol/checkout/dpp?visit_id=dpp_anon")
    ).toBe(dpp);
    expect(
      rewriteCheckoutHref(
        "https://authichain.com/api/checkout/plan/strainchain_passport"
      )
    ).toBe(passport);
  });

  it("leaves email forms, foreign hosts, and SKUs without a Payment Link", () => {
    expect(rewriteCheckoutHref("/pricing")).toBeUndefined();
    expect(
      rewriteCheckoutHref("https://strainchain.io/api/checkout/dpp")
    ).toBeUndefined();
    expect(
      rewriteCheckoutHref("/api/checkout/plan/strainchain_farm")
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
