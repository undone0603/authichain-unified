import { describe, expect, it } from "vitest";
import { tryHandleGatedCheckout } from "./checkout-gate";
import { catalogOffers } from "./plans";
import {
  NON_PUBLIC_AGENT_OFFER_IDS,
  RETIRED_GATED_PLAN_IDS,
  isPublicAgentOffer,
  isRetiredPlan,
  openCatalogOffers,
} from "./retired-plans";

describe("openCatalogOffers", () => {
  it("drops retired and non-public offers from the agent catalogue", () => {
    const all = catalogOffers().map(o => o.id);
    const open = openCatalogOffers().map(o => o.id);

    for (const id of RETIRED_GATED_PLAN_IDS) {
      expect(all).toContain(id);
      expect(open).not.toContain(id);
      expect(isRetiredPlan(id)).toBe(true);
      expect(isPublicAgentOffer(id)).toBe(false);
    }
    for (const id of NON_PUBLIC_AGENT_OFFER_IDS) {
      expect(all).toContain(id);
      expect(open).not.toContain(id);
      expect(isRetiredPlan(id)).toBe(false);
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
