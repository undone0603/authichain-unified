import { describe, expect, it } from "vitest";
import { isIsThisRealPath, renderIsThisRealPage, IS_THIS_REAL_SOURCE } from "./is-this-real-page";

describe("/is-this-real", () => {
  const html = renderIsThisRealPage();
  it("matches only its path", () => {
    expect(isIsThisRealPath("/is-this-real")).toBe(true);
    expect(isIsThisRealPath("/is-this-real/")).toBe(true);
    expect(isIsThisRealPath("/is-this")).toBe(false);
  });
  it("has seal, email and a required consent box", () => {
    expect(html).toContain('name="sealId"');
    expect(html).toContain('type="email"');
    expect(html).toMatch(/id="consent"[^>]*required/);
  });
  it("stores via existing lead capture with its own source", () => {
    expect(html).toContain("/api/leads/capture");
    expect(html).toContain(`source:"${IS_THIS_REAL_SOURCE}"`);
  });
  it("offers 3 free checks then a price-free x402 option", () => {
    expect(html).toContain("MAX=3");
    expect(html).toContain("an unpaid call returns HTTP 402 with the price");
    expect(html).toContain("not a paid receipt");
    expect(html).toContain("daily free allowance");
    expect(html).toContain("A non-UUID sealId is HTTP 400 before payment");
    expect(html).not.toContain('{"sealId":"..."}');
    expect(html).not.toContain('{"sealId":"demo"}');
    expect(html).not.toMatch(/\$0\.05|5 cents|5&cent;|¢|USDC/);
    expect(html).toContain("/api/v1/agent-verify");
  });
  it("names the demonstration example without a product claim", () => {
    expect(html).toContain("polygon-anchor-1");
    expect(html).toContain("published demonstration record, not a product");
    expect(html).toContain("not a physical inspection");
    expect(html).toContain("does not itself read the anchor transaction");
    expect(html).not.toContain("printed on an AuthiChain-sealed product");
    expect(html).not.toContain("polygonscan.com");
    expect(html).not.toContain('{"sealId":"demo"}');
  });
  it("makes no live, customer or metric claims", () => {
    const text = html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");
    expect(text).not.toMatch(/\blive\b|customers|trusted by|\d+%/i);
  });
});
