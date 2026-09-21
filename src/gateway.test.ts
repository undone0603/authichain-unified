import { describe, expect, it } from "vitest";
import { DEFAULT_AI_CATALOG } from "./gateway";
import { X402_PUBLISHED_PAY_TO } from "./lib/x402";

describe("gateway default ai-catalog", () => {
  it("points at live x402 catalog without hardcoding a second payTo", () => {
    const x402 = DEFAULT_AI_CATALOG.services[1];
    expect(x402.id).toBe("authichain-x402");
    expect(x402.network).toBe("base");
    expect(x402.unitOfAccount).toBe("USDC");
    expect(x402.catalog).toBe("https://authichain.com/api/x402/catalog");
    expect(x402.identity).toContain("WEB3_IDENTITY.md");
    expect(x402.note).toMatch(/X402_PAY_TO/);
    expect(JSON.stringify(DEFAULT_AI_CATALOG)).not.toContain(X402_PUBLISHED_PAY_TO);
    expect(JSON.stringify(DEFAULT_AI_CATALOG).toLowerCase()).not.toContain(
      "0xaebfa6b08fb25b59748c93273ab8880e20ffe437"
    );
  });
});
