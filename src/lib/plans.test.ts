import { describe, it, expect } from "vitest";
import {
  PLANS,
  PLAN_CREDITS,
  PLAN_TIER,
  isPurchasable,
  listedPlans,
  planByAmountCents,
  planById,
  planByStripePriceId,
  planPaymentLink,
  planUsd,
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

  it("exposes live Payment Links for Passport, DPP, Farm, and Theater", () => {
    expect(planById("strainchain_passport")?.price).toBe(49);
    expect(planPaymentLink("strainchain_passport")).toBe(
      "https://buy.stripe.com/cNi9ATdrH4t811U4ba1ND3y"
    );
    expect(planPaymentLink("dpp_readiness")).toBe(
      "https://buy.stripe.com/bJe7sLgDTaRwh0S9vu1ND0c"
    );
    expect(planPaymentLink("strainchain_farm")).toBe(
      "https://buy.stripe.com/00waEXafv2l03a2bDC1ND3z"
    );
    expect(planPaymentLink("theater_1")).toBe(
      "https://buy.stripe.com/00w4gzgDT6Bg5iagXW1ND3A"
    );
    expect(planPaymentLink("theater_3")).toBe(
      "https://buy.stripe.com/7sYdR95ZfcZEcKCfTS1ND3B"
    );
    expect(new URL(planPaymentLink("theater_1") ?? "").hostname).toBe(
      "buy.stripe.com"
    );
    expect(new URL(planPaymentLink("theater_3") ?? "").hostname).toBe(
      "buy.stripe.com"
    );
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
    for (const brand of ["qron", "strainchain"] as const) {
      for (const p of listedPlans(brand)) {
        expect(isPurchasable(p), `${p.id} is listed but not purchasable`).toBe(
          true
        );
      }
    }
  });

  it("keeps the StrainChain SKUs off the QRON pricing page", () => {
    const qron = listedPlans("qron").map(p => p.id);
    expect(qron).not.toContain("strainchain_passport");
    expect(qron).not.toContain("strainchain_farm");
  });

  it("lists StrainChain SKUs when live Stripe prices exist", () => {
    const strainchain = listedPlans("strainchain")
      .map(p => p.id)
      .sort();
    expect(strainchain).toEqual(["strainchain_farm", "strainchain_passport"]);

    const byId = Object.fromEntries(PLANS.map(p => [p.id, p]));
    expect(byId.strainchain_passport.stripe_price_id).toBe(
      "price_1UHjCZGqTruSqV8T35M6AmoJ"
    );
    expect(byId.strainchain_farm.stripe_price_id).toBe(
      "price_1UHjJWGqTruSqV8TePctYzO5"
    );
    expect(planByStripePriceId("price_1UHjCZGqTruSqV8T35M6AmoJ")?.id).toBe(
      "strainchain_passport"
    );
    expect(planByStripePriceId("price_1UHjJWGqTruSqV8TePctYzO5")?.id).toBe(
      "strainchain_farm"
    );
    expect(planByAmountCents(4900)?.id).toBe("strainchain_passport");
    expect(planByAmountCents(14900)?.id).toBe("strainchain_farm");
  });

  it("matches the offer sent to Mendo Love Farms", () => {
    const byId = Object.fromEntries(PLANS.map(p => [p.id, p]));
    expect(byId.strainchain_passport.price).toBe(49);
    expect(byId.strainchain_passport.stripe_mode).toBe("payment");
    expect(byId.strainchain_passport.stripe_payment_link).toBe(
      "https://buy.stripe.com/cNi9ATdrH4t811U4ba1ND3y"
    );
    expect(byId.strainchain_farm.price).toBe(149);
    expect(byId.strainchain_farm.price_suffix).toBe("/month");
    expect(byId.strainchain_farm.stripe_mode).toBe("subscription");
    expect(byId.strainchain_farm.stripe_payment_link).toBe(
      "https://buy.stripe.com/00waEXafv2l03a2bDC1ND3z"
    );
  });

  it("still lists the existing QRON plans", () => {
    const qron = listedPlans("qron").map(p => p.id);
    expect(qron).toContain("starter");
    expect(qron).toContain("creator");
    expect(qron).toContain("theater_1");
    expect(qron).toContain("theater_3");
  });

  it("exposes planUsd from the catalogue, not a second price table", () => {
    expect(planUsd("strainchain_passport")).toBe(49);
    expect(planUsd("dpp_readiness")).toBe(299);
    expect(planUsd("starter")).toBe(29);
  });

  it("keeps the live self-serve money path at $29 / $99 / $299", () => {
    const byId = Object.fromEntries(listedPlans("qron").map(p => [p.id, p]));
    expect(byId.starter.price).toBe(29);
    expect(byId.creator.price).toBe(99);
    expect(byId.dpp_readiness.price).toBe(299);
    expect(planByStripePriceId("price_1TGOM9GqTruSqV8TdV7j3DuL")?.id).toBe(
      "starter"
    );
    expect(planByStripePriceId("price_1TGAiZGqTruSqV8Tb4ZdCVKr")?.id).toBe(
      "creator"
    );
    expect(planByStripePriceId("price_1TwmD8GqTruSqV8TpAF8dfyA")?.id).toBe(
      "dpp_readiness"
    );
    expect(planByAmountCents(2900)?.id).toBe("starter");
    expect(planByAmountCents(9900)?.id).toBe("creator");
    expect(planByAmountCents(29900)?.id).toBe("dpp_readiness");
  });
});
