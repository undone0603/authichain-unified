import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
  BASE_USDC,
  COINBASE_SMART_WALLET,
  NFT_DEPLOYER_EOA,
  POLYGON_AUTHICHAIN_NFT,
  QRON_ERC20,
  TOKENOMICS_PAY_TO,
} from "../../scripts/lib/evm-chains";
import { planPaymentLink, planUsd, PLANS } from "./plans";
import {
  BASE_USDC_ASSET,
  X402_PUBLISHED_PAY_TO,
  buildPaymentRequired,
  x402Catalog,
  x402HealthReport,
} from "./x402";
import {
  MONEY_RAILS,
  NFT_DEPLOYER_EOA as ECONOMY_NFT_DEPLOYER,
  POLYGON_AUTHICHAIN_NFT as ECONOMY_NFT,
  agentPricingDiscovery,
} from "./authentic-economy";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");

describe("canonical web3 identity lock", () => {
  it("keeps payTo, Coinbase Smart Wallet, and NFT deployer distinct", () => {
    const named = [
      TOKENOMICS_PAY_TO,
      COINBASE_SMART_WALLET,
      NFT_DEPLOYER_EOA,
    ].map(a => a.toLowerCase());
    expect(new Set(named).size).toBe(3);
    expect(TOKENOMICS_PAY_TO).toBe(X402_PUBLISHED_PAY_TO);
    expect(ECONOMY_NFT_DEPLOYER).toBe(NFT_DEPLOYER_EOA);
    expect(ECONOMY_NFT).toBe(POLYGON_AUTHICHAIN_NFT);
  });

  it("places $QRON on Polygon and USDC on Base", () => {
    expect(MONEY_RAILS.qron.network).toBe("polygon");
    expect(MONEY_RAILS.qron.chainId).toBe("137");
    expect(MONEY_RAILS.qron.contract).toBe(QRON_ERC20);
    expect(MONEY_RAILS.x402.network).toBe("base");
    expect(MONEY_RAILS.x402.chainId).toBe("8453");
    expect(MONEY_RAILS.x402.asset).toBe(BASE_USDC_ASSET);
    expect(BASE_USDC_ASSET).toBe(BASE_USDC);
    expect(MONEY_RAILS.x402.asset.toLowerCase()).not.toBe(
      QRON_ERC20.toLowerCase()
    );
  });

  it("does not fall back to published payTo when X402_PAY_TO is unset", async () => {
    delete process.env.X402_PAY_TO;
    delete process.env.X402_FACILITATOR_URL;
    const report = await x402HealthReport({});
    expect(report.payTo).toBeNull();
    expect(report.payTo).not.toBe(X402_PUBLISHED_PAY_TO);
    expect(report.status).toBe("not_configured");
  });

  it("copies runtime payTo from env, not from the published identity constant", async () => {
    const envPayTo = "0xabc0000000000000000000000000000000000001";
    const catalog = await x402Catalog({
      X402_PAY_TO: envPayTo,
      X402_NETWORK: "base",
    });
    expect(catalog.payTo).toBe(envPayTo);
    expect(catalog.payTo).not.toBe(X402_PUBLISHED_PAY_TO);
    expect(catalog.humanCheckout.source).toBe("src/lib/plans.ts");
    expect(catalog.humanCheckout.passportUsd).toBe(
      planUsd("strainchain_passport")
    );
    expect(catalog.humanCheckout.dppUsd).toBe(planUsd("dpp_readiness"));
    expect(catalog.humanCheckout.passportPaymentLink).toBe(
      planPaymentLink("strainchain_passport")
    );
    expect(catalog.humanCheckout.dppPaymentLink).toBe(
      planPaymentLink("dpp_readiness")
    );
    expect(catalog.humanCheckout.farmPaymentLink).toBe(
      planPaymentLink("strainchain_farm")
    );
    expect(catalog.humanCheckout.farmUsd).toBe(planUsd("strainchain_farm"));
    expect(new URL(catalog.humanCheckout.farmPaymentLink ?? "").hostname).toBe(
      "buy.stripe.com"
    );
  });

  it("keeps $QRON out of x402 accepts[]", () => {
    const r = buildPaymentRequired({
      resource: "https://authichain.com/api/x402",
      priceUsd: 0.05,
      payTo: X402_PUBLISHED_PAY_TO,
    });
    expect(r.body.accepts).toHaveLength(1);
    expect(r.body.accepts[0].asset).toBe(BASE_USDC_ASSET);
    expect(r.body.accepts[0].network).toBe("base");
    const assets = r.body.accepts.map(a => a.asset.toLowerCase());
    expect(assets).not.toContain(QRON_ERC20.toLowerCase());
    expect(assets).not.toContain(POLYGON_AUTHICHAIN_NFT.toLowerCase());
  });

  it("treats plans.ts as the Stripe charge source of truth", () => {
    expect(MONEY_RAILS.stripe.source).toBe("src/lib/plans.ts");
    expect(MONEY_RAILS.stripe.skus.passportUsd).toBe(
      planUsd("strainchain_passport")
    );
    expect(MONEY_RAILS.stripe.skus.dppUsd).toBe(planUsd("dpp_readiness"));
    expect(MONEY_RAILS.stripe.skus.farmUsd).toBe(planUsd("strainchain_farm"));
    expect(PLANS.find(p => p.id === "strainchain_passport")?.price).toBe(49);
    expect(PLANS.find(p => p.id === "dpp_readiness")?.price).toBe(299);
    expect(PLANS.find(p => p.id === "strainchain_farm")?.price).toBe(149);
    const d = agentPricingDiscovery();
    expect(d.humanCheckout.source).toBe("src/lib/plans.ts");
    expect(d.humanCheckout.strainchain_passport).toBe("$49 one-time");
    expect(d.humanCheckout.strainchain_farm).toBe("$149/month");
    expect(d.humanCheckout.checkout.farm).toBe(
      planPaymentLink("strainchain_farm")
    );
    expect(new URL(d.humanCheckout.checkout.farm ?? "").hostname).toBe(
      "buy.stripe.com"
    );
    expect(d.nft.deployer).toBe(NFT_DEPLOYER_EOA);
    expect(d.nft.contract).toBe(POLYGON_AUTHICHAIN_NFT);
  });

  it("joins Next MCP get_pricing and chain-data literals to the named exports", () => {
    const mcp = readFileSync(join(root, "src/app/api/mcp/route.ts"), "utf8");
    expect(mcp).toContain("agentPricingDiscovery");
    expect(mcp).not.toMatch(/register_product:\s*"\$0\.50"/);
    expect(mcp).not.toMatch(/check_eu_dpp:\s*"\$5\.00"/);
    expect(mcp).not.toContain("Polygon POS");

    const chainData = readFileSync(
      join(root, "workers/authichain-chain-data/index.js"),
      "utf8"
    );
    expect(chainData).toContain(QRON_ERC20);
    expect(chainData).toContain(POLYGON_AUTHICHAIN_NFT);

    const tokenMetrics = readFileSync(
      join(root, "server/jobs/token-metrics.ts"),
      "utf8"
    );
    expect(tokenMetrics).toContain("QRON_ERC20");
    expect(tokenMetrics).toContain("POLYGON_QRON_TOKEN");
  });
});
