import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { BASE_USDC_ASSET, X402_PUBLISHED_PAY_TO } from "../../src/lib/x402";
import { agentPricingDiscovery } from "../../src/lib/authentic-economy";

const dir = dirname(fileURLToPath(import.meta.url));

describe("MCP tokenomics identity", () => {
  it("manifest asset matches published Base USDC, not $QRON", () => {
    const manifest = JSON.parse(
      readFileSync(join(dir, "manifest.json"), "utf8")
    ) as {
      pricing: { meteredVerification: { asset: string; network: string } };
    };
    expect(manifest.pricing.meteredVerification.asset).toBe(BASE_USDC_ASSET);
    expect(manifest.pricing.meteredVerification.network).toBe("base");
    expect(manifest.pricing.meteredVerification.asset.toLowerCase()).not.toBe(
      "0xaebfa6b08fb25b59748c93273ab8880e20ffe437"
    );
  });

  it("get_pricing discovery uses named payTo / USDC exports", () => {
    const d = agentPricingDiscovery();
    expect(d.agentRail.asset).toBe(BASE_USDC_ASSET);
    expect(d.agentRail.publishedPayTo).toBe(X402_PUBLISHED_PAY_TO);
    expect(d.qron.isPaymentRail).toBe(false);
  });
});
