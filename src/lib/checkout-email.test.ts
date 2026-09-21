import { describe, expect, it } from "vitest";
import {
  CHECKOUT_REDIRECT_HEADERS,
  checkoutEmailFormHtml,
  checkoutRedirectResponse,
  looksLikeCheckoutEmail,
  pickCheckoutEmail,
} from "./checkout-email";

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
