import { describe, expect, it } from "vitest";
import { planById } from "../src/lib/plans";
import { PAYMENT_LINKS } from "./payment-links";

/**
 * server/payment-links.ts builds PAYMENT_LINKS at import time, and
 * worker-app/dynamic-pages.ts imports it. If any offer() throws, the
 * production Worker fails to load. Stripe deactivated the EU DPP Workspace
 * Payment Link on 2026-10-08; the plan still sells by Stripe price ID through
 * the gated checkout, so it must not need a raw buy.stripe.com link.
 */
describe("PAYMENT_LINKS", () => {
  it("loads when dpp_readiness has no raw Stripe Payment Link", () => {
    expect(planById("dpp_readiness")?.stripe_payment_link).toBeUndefined();
    expect(PAYMENT_LINKS.authichain.starter).toEqual({
      name: "EU DPP Readiness",
      price: "$299",
      url: "https://authichain.com/checkout/dpp_readiness",
    });
  });

  it("every offer points at the gated authichain.com confirm page", () => {
    for (const group of Object.values(PAYMENT_LINKS)) {
      for (const offer of Object.values(group)) {
        expect(offer.url).toMatch(
          /^https:\/\/authichain\.com\/checkout\/[\w-]+$/
        );
      }
    }
  });
});
