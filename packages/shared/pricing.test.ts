import { describe, expect, it } from "vitest";
import {
  B2B_PLANS,
  QRON_PLANS,
  CONTRACT,
  B2B_BRANDS,
  STRIPE_PRICE_TO_PLAN,
  getPlanQuota,
  lookupPlanByPriceId,
  getMonthlyAmountCents,
  getAnnualAmountCents,
} from "./pricing";

describe("B2B_PLANS", () => {
  it("has three tiers at the agreed prices", () => {
    expect(B2B_PLANS.starter.monthlyCents).toBe(19_900);
    expect(B2B_PLANS.professional.monthlyCents).toBe(49_900);
    expect(B2B_PLANS.enterprise.monthlyCents).toBe(99_900);
  });

  it("has the agreed quotas (Professional bumped to 10K to match contract track)", () => {
    expect(B2B_PLANS.starter.quota).toBe(500);
    expect(B2B_PLANS.professional.quota).toBe(10_000);
    expect(B2B_PLANS.enterprise.quota).toBe(25_000);
  });

  it("uses unique Stripe product names", () => {
    const products = [
      B2B_PLANS.starter.product,
      B2B_PLANS.professional.product,
      B2B_PLANS.enterprise.product,
    ];
    expect(new Set(products).size).toBe(3);
  });
});

describe("QRON_PLANS", () => {
  it("Launch Pack is one-time, Studio tiers are recurring", () => {
    expect(QRON_PLANS.launch_pack.oneTimeCents).toBe(3_900);
    expect(QRON_PLANS.studio.monthlyCents).toBe(4_900);
    expect(QRON_PLANS.studio_pro.monthlyCents).toBe(9_900);
  });

  it("Studio Pro is unlimited (sentinel -1)", () => {
    expect(QRON_PLANS.studio_pro.generationsPerMonth).toBe(-1);
  });
});

describe("CONTRACT", () => {
  it("uses the $2,500 setup + reuses Professional for recurring", () => {
    expect(CONTRACT.setupCents).toBe(250_000);
    expect(CONTRACT.recurringPlan).toBe("professional");
    expect(CONTRACT.setupProduct).toBe("contract_setup");
  });
});

describe("B2B_BRANDS", () => {
  it("contains exactly authichain, strainchain, govchain", () => {
    expect([...B2B_BRANDS].sort()).toEqual(["authichain", "govchain", "strainchain"]);
  });
});

describe("getPlanQuota", () => {
  it("returns the B2B quota by plan key", () => {
    expect(getPlanQuota("starter")).toBe(500);
    expect(getPlanQuota("professional")).toBe(10_000);
    expect(getPlanQuota("enterprise")).toBe(25_000);
  });
});

describe("lookupPlanByPriceId", () => {
  it("returns undefined for unknown price IDs", () => {
    expect(lookupPlanByPriceId("price_doesNotExist")).toBeUndefined();
  });

  it("returns the configured plan for known IDs (after Stripe setup populates table)", () => {
    // STRIPE_PRICE_TO_PLAN starts empty; this test documents the contract.
    // After scripts/setup-stripe-products.ts runs, real IDs land in the table.
    Object.entries(STRIPE_PRICE_TO_PLAN).forEach(([id, plan]) => {
      expect(lookupPlanByPriceId(id)).toBe(plan);
    });
  });
});

describe("getMonthlyAmountCents / getAnnualAmountCents", () => {
  it("returns the monthly cents for a B2B plan", () => {
    expect(getMonthlyAmountCents("professional")).toBe(49_900);
  });

  it("annual is monthly * 12 with 20% discount", () => {
    const monthly = getMonthlyAmountCents("starter");
    expect(getAnnualAmountCents("starter")).toBe(Math.round(monthly * 12 * 0.8));
  });
});
