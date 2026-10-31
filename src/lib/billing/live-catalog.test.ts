import { describe, expect, it } from "vitest";
import {
  FIRST_STRANGER_SKU,
  LIVE_PRICE_MAP,
  UNLISTED_SMOKE,
  grantForPriceId,
  isFounderEmail,
  isPublicPlanId,
  publicCheckoutHref,
  liveTierForPriceId,
  liveTierGrantForPriceId,
  resolveCheckoutPlanId,
  starterAmountFallbackRefusals,
} from "./live-catalog";
import { PUBLIC_PLAN_IDS, planByStripePriceId } from "../plans";

describe("catalog freeze 2026-09-28", () => {
  it("first stranger SKU is starter $29", () => {
    expect(FIRST_STRANGER_SKU).toBe("starter");
    expect(LIVE_PRICE_MAP.starter.priceId).toBe("price_1UIoEVGqTruSqV8T61lp48wB");
    expect(LIVE_PRICE_MAP.starter.grant).toBe(100);
    expect(LIVE_PRICE_MAP.starter.mode).toBe("payment");
  });

  it("public ids match plans.ts PUBLIC_PLAN_IDS", () => {
    expect([...PUBLIC_PLAN_IDS]).toEqual([
      "free",
      "qron_launch",
      "qron_launch_annual",
      "starter",
      "creator",
      "dpp_readiness",
      "strainchain_passport",
      "musa_claim_file",
      "musa_audit_bundle",
    ]);
    for (const id of PUBLIC_PLAN_IDS) expect(isPublicPlanId(id)).toBe(true);
    expect(isPublicPlanId("strainchain_farm")).toBe(false);
    expect(isPublicPlanId("studio")).toBe(false);
  });

  it("does not grant unlisted $1 or Seal $99", () => {
    expect(grantForPriceId(UNLISTED_SMOKE.first_dollar_human)).toBeNull();
    expect(grantForPriceId(UNLISTED_SMOKE.seal_monthly)).toBeNull();
  });

  it("resolves a $29 Payment Link with no metadata to starter", () => {
    expect(
      resolveCheckoutPlanId({
        plan: null,
        priceId: null,
        amountTotal: 2900,
        allowAmountFallback: true,
      })
    ).toBe("starter");
    // Without the caller's paid/live/usd gate, the amount grants nothing.
    expect(
      resolveCheckoutPlanId({ plan: null, priceId: null, amountTotal: 2900 })
    ).toBeNull();
    expect(
      resolveCheckoutPlanId({
        plan: "",
        priceId: LIVE_PRICE_MAP.starter.priceId,
        amountTotal: null,
      })
    ).toBe("starter");
    expect(
      resolveCheckoutPlanId({
        plan: "starter",
        priceId: null,
        amountTotal: null,
      })
    ).toBe("starter");
  });

  it("does not guess a plan when the amount is shared or unlisted", () => {
    expect(
      resolveCheckoutPlanId({ amountTotal: 29900, allowAmountFallback: true })
    ).toBeNull();
    expect(
      resolveCheckoutPlanId({ amountTotal: 9900, allowAmountFallback: true })
    ).toBeNull();
    expect(
      resolveCheckoutPlanId({ amountTotal: 1900, allowAmountFallback: true })
    ).toBeNull();
    expect(
      resolveCheckoutPlanId({ priceId: UNLISTED_SMOKE.first_dollar_human })
    ).toBeNull();
    expect(
      resolveCheckoutPlanId({
        plan: "studio",
        amountTotal: 2900,
        allowAmountFallback: true,
      })
    ).toBe("starter");
    expect(
      resolveCheckoutPlanId({ plan: "studio", amountTotal: 2900 })
    ).toBeNull();
  });

  it("grants starter 100 and launch 100", () => {
    expect(grantForPriceId(LIVE_PRICE_MAP.starter.priceId)).toEqual({
      planId: "starter",
      grant: 100,
    });
    expect(grantForPriceId(LIVE_PRICE_MAP.qron_launch.priceId)).toEqual({
      planId: "qron_launch",
      grant: 100,
    });
    expect(grantForPriceId(LIVE_PRICE_MAP.qron_launch_annual.priceId)).toEqual({
      planId: "qron_launch_annual",
      grant: 1200,
    });
  });

  it("price ids in LIVE_PRICE_MAP resolve in plans.ts", () => {
    for (const [id, row] of Object.entries(LIVE_PRICE_MAP)) {
      if ("tier" in row) continue; // tier-only rows are not PlanIds
      const plan = planByStripePriceId(row.priceId);
      expect(plan?.id).toBe(id);
    }
  });

  it("public checkout hrefs stay on apex", () => {
    expect(publicCheckoutHref("starter")).toBe("https://authichain.com/checkout/starter");
    expect(publicCheckoutHref("free")).toBe("https://qron.space/generate");
  });

  it("founder emails are excluded from conversion math", () => {
    expect(isFounderEmail("undone.k@gmail.com")).toBe(true);
    expect(isFounderEmail("authichain@gmail.com")).toBe(true);
    expect(isFounderEmail("buyer@example.com")).toBe(false);
  });

  it("treats every alias on an owned @domain founder entry as founder", () => {
    expect(isFounderEmail("ops@authichain.com")).toBe(true);
    expect(isFounderEmail("smoke+dpp@authichain.com")).toBe(true);
    expect(isFounderEmail("a@authichain.com.au")).toBe(false);
    expect(isFounderEmail("buyer@farm.com")).toBe(false);
  });
});

describe("starterAmountFallbackRefusals", () => {
  const ok = {
    payment_status: "paid",
    currency: "usd",
    amount_total: 2900,
    amount_subtotal: 2900,
    total_details: { amount_discount: 0 },
  };
  it("allows a paid live USD $29.00 undiscounted session", () => {
    expect(starterAmountFallbackRefusals(ok, true)).toEqual([]);
  });
  it("refuses unpaid, test mode, non-USD, other amounts and discounts", () => {
    expect(
      starterAmountFallbackRefusals({ ...ok, payment_status: "unpaid" }, true)
    ).toContain("not_paid");
    expect(
      starterAmountFallbackRefusals(
        { ...ok, payment_status: "no_payment_required" },
        true
      )
    ).toContain("not_paid");
    expect(starterAmountFallbackRefusals(ok, false)).toContain("not_livemode");
    expect(starterAmountFallbackRefusals(ok, undefined)).toContain(
      "not_livemode"
    );
    expect(
      starterAmountFallbackRefusals({ ...ok, currency: "eur" }, true)
    ).toContain("not_usd");
    expect(
      starterAmountFallbackRefusals(
        { ...ok, amount_total: 2901, amount_subtotal: 2901 },
        true
      )
    ).toContain("amount_not_2900");
    expect(
      starterAmountFallbackRefusals(
        {
          ...ok,
          amount_subtotal: 9900,
          total_details: { amount_discount: 7000 },
        },
        true
      )
    ).toEqual(expect.arrayContaining(["subtotal_not_2900", "discounted"]));
  });
});

describe("StorePilot Pro price_1UTxvp", () => {
  const PRO = "price_1UTxvpGqTruSqV8TQu5gkqyc";

  it("is mapped to tier=pro, catalog_limit=200 in LIVE_PRICE_MAP", () => {
    expect(LIVE_PRICE_MAP.storepilot_pro.priceId).toBe(PRO);
    expect(LIVE_PRICE_MAP.storepilot_pro.tier).toBe("pro");
    expect(LIVE_PRICE_MAP.storepilot_pro.catalogLimit).toBe(200);
    expect(liveTierForPriceId(PRO)).toBe("pro");
    expect(liveTierForPriceId(LIVE_PRICE_MAP.starter.priceId)).toBeNull();
  });

  it("never resolves to Starter, even on an exact $29.00 fallback-eligible session", () => {
    for (const allowAmountFallback of [true, false]) {
      const r = resolveCheckoutPlanId({ priceId: PRO, amountTotal: 2900, allowAmountFallback });
      expect(r).not.toBe("starter");
      expect(r).toBeNull();
    }
    expect(grantForPriceId(PRO)).toBeNull();
  });

  it("grants tier=pro and catalog_limit=200 keyed to the checkout email", () => {
    const g = liveTierGrantForPriceId(PRO, "  Buyer@Example.com ");
    expect(g).toEqual({ email: "buyer@example.com", tier: "pro", catalog_limit: 200 });
    expect(g?.tier).not.toBe("starter");
    expect(liveTierGrantForPriceId(PRO, null)).toBeNull();
    expect(liveTierGrantForPriceId(LIVE_PRICE_MAP.starter.priceId, "a@b.co")).toBeNull();
  });
});
