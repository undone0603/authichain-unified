import { describe, expect, it } from "vitest";
import {
  AUTHORITY_ORDER,
  agentzExecutionPolicy,
  classifyRevenue,
  founderBusinessCannotOverride,
  highestValueBlock,
  isFounderEmail,
  publicOfferIds,
  resolveCommerce,
  sealStripeApiPayload,
  surfaceOffers,
  x402Identity,
  X402_QRON_TOKEN,
  X402_TREASURY,
} from "./economic-authority";

describe("economic authority", () => {
  it("ranks the charter above founder-business", () => {
    expect(AUTHORITY_ORDER[0]).toBe("docs/OPERATING_CHARTER.md");
    expect(AUTHORITY_ORDER.at(-1)).toBe(".github/founder-business.json");
    expect(founderBusinessCannotOverride("public offers").allowed).toBe(false);
  });

  it("sells the eight public offers and no GovChain or AgentZ offer", () => {
    expect([...publicOfferIds()]).toEqual([
      "free",
      "qron_launch",
      "starter",
      "creator",
      "dpp_readiness",
      "strainchain_passport",
      "made_in_usa_claim_file",
      "made_in_usa_audit_bundle",
    ]);
    expect(resolveCommerce("musa_claim_file")).toMatchObject({
      plan_id: "made_in_usa_claim_file",
      publicly_sellable: true,
      alias: true,
    });
    expect(resolveCommerce("strainchain_farm").publicly_sellable).toBe(false);
    expect(resolveCommerce("theater_1").visibility).toBe("internal");
    expect(resolveCommerce("theater_3").visibility).toBe("internal");
    expect(surfaceOffers("govchain")).toEqual([]);
    expect(surfaceOffers("agentz")).toEqual([]);
  });

  it("freezes AgentZ auto and allows confirm and dry-run", () => {
    expect(agentzExecutionPolicy("auto").allowed).toBe(false);
    expect(agentzExecutionPolicy("AUTO").class).toBe("FROZEN");
    expect(agentzExecutionPolicy("confirm").allowed).toBe(true);
    expect(agentzExecutionPolicy("dry_run").mode).toBe("dry-run");
    expect(agentzExecutionPolicy("nope").allowed).toBe(false);
  });

  it("keeps the treasury distinct from the QRON token and unsettled", () => {
    const id = x402Identity();
    expect(id.treasury).toBe(X402_TREASURY);
    expect(id.qron_token).toBe(X402_QRON_TOKEN);
    expect(id.treasury.toLowerCase()).not.toBe(id.qron_token.toLowerCase());
    expect(id.settled).toBe(false);
    expect(id.settlement_status).toBe("HEALTHY_BUT_NOT_SETTLEMENT_READY");
  });

  it("keeps the DPP sale blocked, then blocks another conversion guess", () => {
    const live = highestValueBlock("2026-10-06", "2026-11-06");
    expect(live).toMatchObject({
      action_id: "sell_existing_dpp",
      priority: "L2",
      status: "BLOCKED",
      blocking_requirement: "verified_inbox",
      executable: false,
    });
    const stale = highestValueBlock("2026-12-01", "2026-11-06");
    expect(stale).toMatchObject({
      action_id: "revalidate_cvr",
      status: "BLOCKED",
      executable: false,
      blocking_requirement: "measured conversion, not another guess",
    });
  });

  it("does not trust a copied snapshot that claims livemode", () => {
    const sealed = sealStripeApiPayload({
      charges: [
        {
          id: "ch_live",
          object: "charge",
          livemode: true,
          amount: 29900,
          paid: true,
          customer_email: "buyer@example.com",
        },
      ],
    });
    expect(classifyRevenue(sealed).status).toBe("VERIFIED_REVENUE");
    const copied = JSON.parse(JSON.stringify(sealed));
    expect(classifyRevenue(copied).status).toBe("REVENUE_UNVERIFIED");
    expect(classifyRevenue(copied).qualifying).toBe(false);
  });

  it("treats owned @domain founder entries as founder, lookalikes as strangers", () => {
    expect(isFounderEmail("ops@authichain.com")).toBe(true);
    expect(isFounderEmail("smoke+dpp@authichain.com")).toBe(true);
    expect(isFounderEmail("undone.k@gmail.com")).toBe(true);
    expect(isFounderEmail("a@authichain.com.au")).toBe(false);
    expect(isFounderEmail("buyer@farm.com")).toBe(false);

    const founderCharge = sealStripeApiPayload({
      charges: [
        {
          id: "ch_ops",
          object: "charge",
          livemode: true,
          amount: 1900,
          paid: true,
          customer_email: "ops@authichain.com",
        },
      ],
    });
    expect(classifyRevenue(founderCharge).status).toBe("NO_QUALIFYING_REVENUE");
  });
});
