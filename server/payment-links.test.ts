import { describe, expect, it } from "vitest";
import { planById } from "../src/lib/plans";
import { PAYMENT_LINKS } from "./payment-links";

/**
 * server/payment-links.ts builds PAYMENT_LINKS at import time, and
 * worker-app/dynamic-pages.ts imports it. If any offer() throws, the
 * production Worker fails to load. The 2026-10-08 EU DPP Payment Link was
 * replaced on 2026-11-02 by the active $299 link in src/lib/plans.ts. The
 * offer URL itself stays on the gated authichain.com checkout.
 */
describe("PAYMENT_LINKS", () => {
  it("loads the active dpp_readiness Payment Link and the gated checkout URL", () => {
    expect(planById("dpp_readiness")?.stripe_payment_link).toBe(
      "https://buy.stripe.com/5kQdR9fzP4t85iaePO1ND43",
    );
    expect(PAYMENT_LINKS.authichain.starter).toEqual({
      name: "EU DPP Workspace",
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
