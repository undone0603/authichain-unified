import { describe, it, expect } from "vitest";
import {
  PLANS,
  PLAN_CREDITS,
  PLAN_TIER,
  isPurchasable,
  listedPlans,
} from "./plans";

describe("plan catalogue integrity", () => {
  it("keeps the PlanId-keyed records exhaustive", () => {
    for (const p of PLANS) {
      expect(PLAN_CREDITS, `PLAN_CREDITS missing ${p.id}`).toHaveProperty(p.id);
      expect(PLAN_TIER, `PLAN_TIER missing ${p.id}`).toHaveProperty(p.id);
    }
  });

  it("has no duplicate ids", () => {
    const ids = PLANS.map(p => p.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe("isPurchasable", () => {
  it("rejects a paid plan with no Stripe price behind it", () => {
    expect(
      isPurchasable({
        price: 49,
        stripe_price_id: null,
        stripe_mode: "payment",
      } as never)
    ).toBe(false);
  });

  it("accepts a paid plan with a price id, or a payment link", () => {
    expect(
      isPurchasable({ price: 49, stripe_price_id: "price_x" } as never)
    ).toBe(true);
    expect(
      isPurchasable({
        price: 49,
        stripe_price_id: null,
        stripe_payment_link: "https://x",
      } as never)
    ).toBe(true);
  });

  it("accepts a free plan, which needs no price", () => {
    expect(isPurchasable({ price: 0, stripe_price_id: null } as never)).toBe(
      true
    );
  });
});

describe("listedPlans", () => {
  it("never advertises a price nothing can charge", () => {
    for (const p of listedPlans("qron")) {
      expect(isPurchasable(p), `${p.id} is listed but not purchasable`).toBe(
        true
      );
    }
  });

  it("keeps the StrainChain SKUs off the QRON pricing page", () => {
    const qron = listedPlans("qron").map(p => p.id);
    expect(qron).not.toContain("strainchain_passport");
    expect(qron).not.toContain("strainchain_farm");
  });

  it("withholds the StrainChain SKUs until a live Stripe price exists", () => {
    // Defined so the numbers live in code rather than only in a sent proposal,
    // but deliberately unsellable until a human creates the price.
    expect(listedPlans("strainchain")).toEqual([]);

    const defined = PLANS.filter(p => p.brand === "strainchain");
    expect(defined.map(p => p.id).sort()).toEqual([
      "strainchain_farm",
      "strainchain_passport",
    ]);
    for (const p of defined) expect(p.stripe_price_id).toBeNull();
  });

  it("matches the offer sent to Mendo Love Farms", () => {
    const byId = Object.fromEntries(PLANS.map(p => [p.id, p]));
    expect(byId.strainchain_passport.price).toBe(49);
    expect(byId.strainchain_passport.stripe_mode).toBe("payment");
    expect(byId.strainchain_farm.price).toBe(149);
    expect(byId.strainchain_farm.price_suffix).toBe("/month");
    expect(byId.strainchain_farm.stripe_mode).toBe("subscription");
  });

  it("still lists the existing QRON plans", () => {
    const qron = listedPlans("qron").map(p => p.id);
    expect(qron).toContain("starter");
    expect(qron).toContain("creator");
  });
});
