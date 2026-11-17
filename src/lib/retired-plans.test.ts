import { describe, expect, it } from "vitest";
import { tryHandleGatedCheckout } from "./checkout-gate";
import { catalogOffers } from "./plans";
import {
  RETIRED_GATED_PLAN_IDS,
  isPublicAgentOffer,
  isRetiredPlan,
  openCatalogOffers,
} from "./retired-plans";

const F886_3_CHECKOUT_IDS = [
  "theater_1",
  "theater_3",
  "strainchain_farm",
  "gov_provenance_pilot",
] as const;

describe("openCatalogOffers", () => {
  it("drops retired offers from the agent catalogue", () => {
    const all = catalogOffers().map(o => o.id);
    const open = openCatalogOffers().map(o => o.id);

    for (const id of RETIRED_GATED_PLAN_IDS) {
      expect(all).toContain(id);
      expect(open).not.toContain(id);
      expect(isRetiredPlan(id)).toBe(true);
      expect(isPublicAgentOffer(id)).toBe(false);
    }
    expect(open).toEqual(all.filter(id => isPublicAgentOffer(id)));
    expect(open).toEqual(
      expect.arrayContaining([
        "starter",
        "creator",
        "dpp_readiness",
        "strainchain_passport",
        "musa_claim_file",
        "musa_audit_bundle",
        "battery_gap_report",
        "battery_gap_report_extra",
      ])
    );
    expect(open).not.toContain("qron_launch");
    expect(open).not.toContain("qron_launch_annual");
    expect(open).not.toContain("theater_1");
    expect(open).not.toContain("theater_3");
    expect(open).not.toContain("strainchain_farm");
    expect(open).not.toContain("gov_provenance_pilot");
  });

  it("never lists an offer whose checkout only redirects to /pricing", async () => {
    for (const offer of openCatalogOffers()) {
      const res = await tryHandleGatedCheckout(
        new Request(offer.checkout, { method: "GET" }),
        {} as never
      );
      expect(res, offer.id).not.toBeNull();
      expect(res!.headers.get("Location"), offer.id).not.toBe("/pricing");
    }
  });
});

describe("F886-3 retired checkout URLs", () => {
  it("redirects Theater, Farm, and the federal provenance pilot to /pricing", async () => {
    for (const id of F886_3_CHECKOUT_IDS) {
      for (const method of ["GET", "HEAD", "POST"]) {
        const res = await tryHandleGatedCheckout(
          new Request(`https://authichain.com/checkout/${id}`, {
            method,
            headers: {
              origin: "https://authichain.com",
              "content-type": "application/x-www-form-urlencoded",
              "user-agent":
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
            },
            body: method === "POST" ? "email=ops%40brand.com" : undefined,
          }),
          { STRIPE_SECRET_KEY: "sk_test_unused" }
        );
        expect(res, `${id} ${method}`).not.toBeNull();
        expect([301, 302, 303], `${id} ${method}`).toContain(res!.status);
        expect(res!.headers.get("location"), `${id} ${method}`).toBe(
          "/pricing"
        );
        expect(await res!.text(), `${id} ${method}`).not.toContain("<form");
      }
    }
  });
});
