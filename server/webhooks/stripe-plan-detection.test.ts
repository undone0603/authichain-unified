import { afterEach, describe, expect, it } from "vitest";
import { STRIPE_PRICE_TO_PLAN } from "../../shared/pricing";
import { detectPlan } from "./stripe-plan-detection";

afterEach(() => {
  // Tests mutate the lookup table; reset between tests.
  for (const k of Object.keys(STRIPE_PRICE_TO_PLAN)) delete STRIPE_PRICE_TO_PLAN[k];
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
    // For a Stripe subscription event we expect a B2B plan; non-B2B IDs
    // should fall through to amount-based detection so we don't mis-tag
    // a QRON checkout as a B2B plan.
    expect(detectPlan("price_qron_studio", 4_900)).toBe("starter"); // amount fallback
    expect(detectPlan("price_contract_setup", 250_000)).toBe("enterprise");
  });
});
