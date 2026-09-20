import { describe, expect, it } from "vitest";
import {
  isX402DocsPath,
  renderX402DocsPage,
  X402_PUBLIC,
} from "./x402-docs-page";

describe("x402 public docs page", () => {
  it("matches the published live rail (payTo, Base USDC, $0.05)", () => {
    expect(X402_PUBLIC.payTo).toBe(
      "0x5db511706FB6317cd23A7655F67450c5AC6e6AA2"
    );
    expect(X402_PUBLIC.asset).toBe(
      "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913"
    );
    expect(X402_PUBLIC.chainId).toBe("8453");
    expect(X402_PUBLIC.priceUsd).toBe("$0.05");
    expect(X402_PUBLIC.healthUrl).toBe(
      "https://authichain.com/api/x402/health"
    );
  });

  it("recognizes /x402 and /docs/x402 only", () => {
    expect(isX402DocsPath("/x402")).toBe(true);
    expect(isX402DocsPath("/docs/x402")).toBe(true);
    expect(isX402DocsPath("/api/x402")).toBe(false);
    expect(isX402DocsPath("/api/x402/health")).toBe(false);
    expect(isX402DocsPath("/dpp")).toBe(false);
  });

  it("renders HTML with health + unpaid 402 curls and no facilitator URL", () => {
    const html = renderX402DocsPage();
    expect(html).toContain("<title>x402 agent pay — AuthiChain</title>");
    expect(html).toContain(X402_PUBLIC.payTo);
    expect(html).toContain(X402_PUBLIC.asset);
    expect(html).toContain("curl -sS https://authichain.com/api/x402/health");
    expect(html).toContain(
      "curl -sS -i -X POST https://authichain.com/api/x402"
    );
    expect(html).toContain("HTTP 402");
    expect(html.toLowerCase()).not.toContain("facilitator.payai");
    expect(html).not.toMatch(/X402_FACILITATOR_URL/);
    expect(html).not.toMatch(/0x[a-fA-F0-9]{64}/);
  });
});
