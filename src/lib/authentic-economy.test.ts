import { describe, expect, it } from "vitest";
import { BASE_USDC, TOKENOMICS_PAY_TO as EVM_PAY_TO } from "../../scripts/lib/evm-chains";
import { BASE_USDC_ASSET, X402_PUBLISHED_PAY_TO } from "./x402";
import {
  AGENT_TOKENOMICS_DOC,
  BASE_AUTH_FEE,
  BASE_AUTH_FEE_UNIT,
  FEE_SPLIT_RATIOS,
  MONEY_RAILS,
  QRON_ERC20,
  QRON_TOTAL_SUPPLY,
  TOKENOMICS_PAY_TO,
  WEB3_IDENTITY_DOC,
  agentPricingDiscovery,
  calculateFeeDistribution,
} from "./authentic-economy";

describe("authentic-economy identity join", () => {
  it("uses the named payTo / USDC exports instead of a second treasury", () => {
    expect(TOKENOMICS_PAY_TO).toBe(X402_PUBLISHED_PAY_TO);
    expect(TOKENOMICS_PAY_TO).toBe(EVM_PAY_TO);
    expect(MONEY_RAILS.x402.publishedPayTo).toBe(X402_PUBLISHED_PAY_TO);
    expect(MONEY_RAILS.x402.asset).toBe(BASE_USDC_ASSET);
    expect(MONEY_RAILS.x402.asset).toBe(BASE_USDC);
    expect(MONEY_RAILS.qron.holder).toBe(TOKENOMICS_PAY_TO);
  });

  it("keeps $QRON off the x402 settlement rail", () => {
    expect(MONEY_RAILS.x402.isSettlement).toBe(true);
    expect(MONEY_RAILS.qron.isSettlement).toBe(false);
    expect(MONEY_RAILS.qron.theater).toBe(true);
    expect(MONEY_RAILS.qron.contract).toBe(QRON_ERC20);
    expect(MONEY_RAILS.qron.totalSupply).toBe(1_000_000_000);
    expect(QRON_TOTAL_SUPPLY).toBe(1_000_000_000);
    expect(MONEY_RAILS.x402.asset.toLowerCase()).not.toBe(
      QRON_ERC20.toLowerCase()
    );
    expect(BASE_AUTH_FEE_UNIT).toBe("QRON");
    expect(MONEY_RAILS.x402.unit).toBe("USDC");
  });

  it("does not treat the NFT deployer or Smart Wallet as payTo", () => {
    expect(TOKENOMICS_PAY_TO.toLowerCase()).not.toBe(
      "0xbad4e580ce467a4b22237ed4ad9746e718ed2b0d"
    );
    expect(TOKENOMICS_PAY_TO.toLowerCase()).not.toBe(
      "0xc0d26735fd9e868eacc60400ef3171fa4161177f"
    );
  });

  it("points discovery at identity + tokenomics docs", () => {
    const d = agentPricingDiscovery();
    expect(d.agentRail.asset).toBe(BASE_USDC_ASSET);
    expect(d.agentRail.publishedPayTo).toBe(X402_PUBLISHED_PAY_TO);
    expect(d.agentRail.identity).toBe(WEB3_IDENTITY_DOC);
    expect(d.agentRail.tokenomics).toBe(AGENT_TOKENOMICS_DOC);
    expect(d.agentRail.note).toMatch(/X402_PAY_TO/);
    expect(d.agentRail.note).toMatch(/\$QRON/);
    expect(d.humanCheckout.source).toBe("src/lib/plans.ts");
    expect(d.qron.isPaymentRail).toBe(false);
    expect(d.qron.totalSupply).toBe(QRON_TOTAL_SUPPLY);
  });
});

describe("calculateFeeDistribution", () => {
  it("splits an unstaked auth as 40/40/20 in $QRON, not USDC", () => {
    const dist = calculateFeeDistribution(0);
    expect(dist.tier).toBe("none");
    expect(dist.unit).toBe("QRON");
    expect(dist.gross).toBe(BASE_AUTH_FEE);
    expect(dist.net).toBe(0.05);
    expect(dist.stakerReward).toBeCloseTo(0.05 * FEE_SPLIT_RATIOS.stakerReward);
    expect(dist.treasury).toBeCloseTo(0.05 * FEE_SPLIT_RATIOS.treasury);
    expect(dist.burn).toBeCloseTo(0.05 * FEE_SPLIT_RATIOS.burn);
  });

  it("applies bronze / gold discounts without changing the unit", () => {
    const bronze = calculateFeeDistribution(1000);
    expect(bronze.tier).toBe("bronze");
    expect(bronze.net).toBeCloseTo(0.045);
    expect(bronze.unit).toBe("QRON");
    const gold = calculateFeeDistribution(100000);
    expect(gold.tier).toBe("gold");
    expect(gold.discount).toBe(0.4);
  });
});
