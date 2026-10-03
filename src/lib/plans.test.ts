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

  it("caps free at 5 generations", () => {
    expect(planById("free")?.generations).toBe(5);
    expect(PLAN_CREDITS.free).toBe(5);
  });

  it("exposes live Payment Links for Passport, DPP, Farm, and hidden Theater", () => {
    expect(planById("strainchain_passport")?.price).toBe(49);
    expect(planPaymentLink("strainchain_passport")).toBe(
      "https://authichain.com/checkout/strainchain_passport"
    );
    expect(planPaymentLink("dpp_readiness")).toBe(
      "https://authichain.com/checkout/dpp_readiness"
    );
    expect(planPaymentLink("strainchain_farm")).toBe(
      "https://authichain.com/checkout/strainchain_farm"
    );
    expect(planPaymentLink("theater_1")).toBe(
      "https://authichain.com/checkout/theater_1"
    );
    expect(planPaymentLink("theater_3")).toBe(
      "https://authichain.com/checkout/theater_3"
    );
    expect(planById("theater_1")?.listed).toBe(false);
    expect(planById("theater_3")?.listed).toBe(false);
  });

  it("wires QRON Launch $19/mo to the live Stripe price", () => {
    expect(planById("qron_launch")?.price).toBe(19);
    expect(planById("qron_launch")?.stripe_mode).toBe("subscription");
    expect(planById("qron_launch")?.listed).not.toBe(false);
    expect(planByStripePriceId("price_1UJjzPGqTruSqV8TmhFSc8vh")?.id).toBe(
      "qron_launch"
    );
    expect(planByAmountCents(1900)?.id).toBe("qron_launch");
    expect(planPaymentLink("qron_launch")).toBe(
      "https://authichain.com/checkout/qron_launch"
    );
    expect(PLAN_CREDITS.qron_launch).toBe(100);
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
  });

  it("lists public QRON plans including Launch and hides Theater", () => {
    const qron = listedPlans("qron").map(p => p.id);
    expect(qron).toContain("free");
    expect(qron).toContain("qron_launch");
    expect(qron).toContain("starter");
    expect(qron).toContain("creator");
    expect(qron).toContain("dpp_readiness");
    expect(qron).not.toContain("theater_1");
    expect(qron).not.toContain("theater_3");
    expect(qron).not.toContain("studio");
  });

  it("exposes planUsd from the catalogue, not a second price table", () => {
    expect(planUsd("strainchain_passport")).toBe(49);
    expect(planUsd("dpp_readiness")).toBe(299);
    expect(planUsd("starter")).toBe(29);
    expect(planUsd("qron_launch")).toBe(19);
  });

  it("keeps the live self-serve money path at $19 / $29 / $99 / $299", () => {
    const byId = Object.fromEntries(listedPlans("qron").map(p => [p.id, p]));
    expect(byId.qron_launch.price).toBe(19);
    expect(byId.starter.price).toBe(29);
    expect(byId.creator.price).toBe(99);
    expect(byId.dpp_readiness.price).toBe(299);
    expect(planByStripePriceId("price_1UJjzPGqTruSqV8TmhFSc8vh")?.id).toBe(
      "qron_launch"
    );
    expect(planByAmountCents(1900)?.id).toBe("qron_launch");
    expect(planByAmountCents(2900)?.id).toBe("starter");
  });
});
