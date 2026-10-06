import { describe, expect, it } from "vitest";
import { grantForSku } from "./cash-entitlement";

describe("grantForSku", () => {
  it("grants 50 generations for DPP and zero credit", () => {
    expect(grantForSku("dpp_readiness")).toEqual({
      sku: "dpp_readiness",
      generations: 50,
      amountCents: 29900,
      creditCents: 0,
    });
  });

  it("grants one passport and refuses the $2500 bundle", () => {
    expect(grantForSku("strainchain_passport")?.generations).toBe(1);
    expect(grantForSku("made_in_usa_audit_bundle")).toBeNull();
  });
});
