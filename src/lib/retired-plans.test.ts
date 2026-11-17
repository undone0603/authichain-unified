import { describe, expect, it } from "vitest";
import { tryHandleGatedCheckout } from "./checkout-gate";
import { catalogOffers } from "./plans";
import {
  RETIRED_GATED_PLAN_IDS,
  isRetiredPlan,
  openCatalogOffers,
} from "./retired-plans";

describe("openCatalogOffers", () => {
  it("drops exactly the retired plans from the catalogue", () => {
    const all = catalogOffers().map(o => o.id);
    const open = openCatalogOffers().map(o => o.id);

    for (const id of RETIRED_GATED_PLAN_IDS) {
      expect(all).toContain(id);
      expect(open).not.toContain(id);
      expect(isRetiredPlan(id)).toBe(true);
    }
    expect(open).toEqual(
      all.filter(id => !RETIRED_GATED_PLAN_IDS.includes(id))
    );
    expect(open).toContain("starter");
    expect(open).toContain("dpp_readiness");
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
