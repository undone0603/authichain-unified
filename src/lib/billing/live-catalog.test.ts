import { describe, expect, it } from "vitest";
import {
  FIRST_STRANGER_SKU,
  LIVE_PRICE_MAP,
  UNLISTED_SMOKE,
  grantForPriceId,
  isFounderEmail,
  isPublicPlanId,
  publicCheckoutHref,
  resolveCheckoutPlanId,
} from "./live-catalog";
import { PUBLIC_PLAN_IDS, planByStripePriceId } from "../plans";

describe("catalog freeze 2026-09-28", () => {
  it("first stranger SKU is starter $29", () => {
    expect(FIRST_STRANGER_SKU).toBe("starter");
    expect(LIVE_PRICE_MAP.starter.priceId).toBe(
      "price_1UIoEVGqTruSqV8T61lp48wB"
    );
    expect(LIVE_PRICE_MAP.starter.grant).toBe(100);
    expect(LIVE_PRICE_MAP.starter.mode).toBe("payment");
  });

  it("public ids match plans.ts PUBLIC_PLAN_IDS", () => {
    expect([...PUBLIC_PLAN_IDS]).toEqual([
      "free",
      "qron_launch",
      "starter",
      "creator",
      "dpp_readiness",
      "strainchain_passport",
      "made_in_usa_claim_file",
      "made_in_usa_audit_bundle",
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
      resolveCheckoutPlanId({ plan: null, priceId: null, amountTotal: 2900 })
    ).toBe("starter");
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
    expect(resolveCheckoutPlanId({ amountTotal: 29900 })).toBeNull();
    expect(
      resolveCheckoutPlanId({ priceId: UNLISTED_SMOKE.first_dollar_human })
    ).toBeNull();
    expect(resolveCheckoutPlanId({ plan: "studio", amountTotal: 2900 })).toBe(
      "starter"
    );
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
  });

  it("price ids in LIVE_PRICE_MAP resolve in plans.ts", () => {
    for (const [id, row] of Object.entries(LIVE_PRICE_MAP)) {
      const plan = planByStripePriceId(row.priceId);
      expect(plan?.id).toBe(id);
    }
  });

  it("public checkout hrefs stay on apex", () => {
    expect(publicCheckoutHref("starter")).toBe(
      "https://authichain.com/checkout/starter"
    );
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
