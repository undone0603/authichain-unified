import { describe, expect, it } from "vitest";
import { isLlmsTxtPath, renderLlmsTxt, tryHandleLlmsTxt } from "./llms-txt";

describe("llms.txt", () => {
  it("recognizes agent discovery paths", () => {
    expect(isLlmsTxtPath("/llms.txt")).toBe(true);
    expect(isLlmsTxtPath("/.well-known/llms.txt")).toBe(true);
    expect(isLlmsTxtPath("/llms.txt/")).toBe(true);
    expect(isLlmsTxtPath("/robots.txt")).toBe(false);
    expect(isLlmsTxtPath("/")).toBe(false);
  });

  it("points agents at Payment Links and unpaid POST x402, not GET checkout", () => {
    const text = renderLlmsTxt();
    expect(text).toContain("# AuthiChain");
    expect(text).toContain("POST https://authichain.com/api/x402");
    expect(text).toContain("https://authichain.com/api/x402/catalog");
    expect(text).toContain("https://authichain.com/.well-known/x402.json");
    expect(text).toContain("https://buy.stripe.com/bJe7sLgDTaRwh0S9vu1ND0c");
    expect(text).toContain("https://buy.stripe.com/cNi9ATdrH4t811U4ba1ND3y");
    expect(text).not.toContain("GET /api/checkout");
    expect(text.toLowerCase()).not.toContain("facilitator.payai");
  });

  it("answers GET and ignores other paths", async () => {
    const hit = tryHandleLlmsTxt(
      new Request("https://authichain.com/llms.txt")
    );
    expect(hit).not.toBeNull();
    expect(hit?.status).toBe(200);
    expect(hit?.headers.get("content-type")).toMatch(/text\/plain/);
    expect(await hit!.text()).toContain("POST https://authichain.com/api/x402");
    expect(
      tryHandleLlmsTxt(new Request("https://authichain.com/pricing"))
    ).toBeNull();
  });
});
