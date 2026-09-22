import { afterEach, describe, expect, it } from "vitest";
import { STRIPE_PRICE_TO_PLAN } from "../../shared/pricing";
import { detectPlan } from "./stripe-plan-detection";
import { planByStripePriceId } from "../../src/lib/plans";

afterEach(() => {
  // Tests mutate the lookup table; reset between tests.
  for (const k of Object.keys(STRIPE_PRICE_TO_PLAN))
    delete STRIPE_PRICE_TO_PLAN[k];
});

describe("detectPlan", () => {
  it("returns the B2B plan when the price ID is in the lookup table", () => {
    STRIPE_PRICE_TO_PLAN["price_known_pro"] = "professional";
    expect(detectPlan("price_known_pro", 49_900)).toBe("professional");
  });

  it("falls back to amount-based detection when price ID is unknown", () => {
    expect(detectPlan("price_unknown", 99_900)).toBe("enterprise");
    expect(detectPlan("price_unknown", 49_900)).toBe("professional");
    expect(detectPlan("price_unknown", 19_900)).toBe("starter");
    expect(detectPlan("price_unknown", 0)).toBe("starter");
  });

  it("falls back to amount-based detection when price ID is missing", () => {
    expect(detectPlan(null, 99_900)).toBe("enterprise");
    expect(detectPlan(undefined, 19_900)).toBe("starter");
  });

  it("does NOT match QRON or contract_setup as B2B plans (they are non-B2B keys)", () => {
    STRIPE_PRICE_TO_PLAN["price_qron_studio"] = "studio";
    STRIPE_PRICE_TO_PLAN["price_contract_setup"] = "contract_setup";
    expect(detectPlan("price_qron_studio", 4_900)).toBeNull();
    expect(detectPlan("price_contract_setup", 250_000)).toBeNull();
  });

  it("does not amount-map live plans.ts prices onto B2B SKUs", () => {
    const dpp = planByStripePriceId("price_1TwmD8GqTruSqV8TpAF8dfyA");
    expect(dpp?.id).toBe("dpp_readiness");
    expect(detectPlan("price_1TwmD8GqTruSqV8TpAF8dfyA", 29_900)).toBeNull();
    expect(detectPlan("price_1TGAiZGqTruSqV8Tb4ZdCVKr", 9_900)).toBeNull();
    expect(detectPlan("price_1TGOM9GqTruSqV8TdV7j3DuL", 2_900)).toBeNull();
    const farm = planByStripePriceId("price_1UHjJWGqTruSqV8TePctYzO5");
    expect(farm?.id).toBe("strainchain_farm");
    expect(detectPlan("price_1UHjJWGqTruSqV8TePctYzO5", 14_900)).toBeNull();
    const passport = planByStripePriceId("price_1UHjCZGqTruSqV8T35M6AmoJ");
    expect(passport?.id).toBe("strainchain_passport");
    expect(detectPlan("price_1UHjCZGqTruSqV8T35M6AmoJ", 4_900)).toBeNull();
  });
});
