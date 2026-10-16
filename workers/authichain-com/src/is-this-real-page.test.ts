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
  it("offers 3 free checks then the 5 cent x402 option", () => {
    expect(html).toContain("MAX=3");
    expect(html).toContain("$0.05 in USDC on Base");
    expect(html).toContain("/api/v1/agent-verify");
  });
  it("makes no live, customer or metric claims", () => {
    const text = html.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/g, "").replace(/<[^>]+>/g, " ");
    expect(text).not.toMatch(/\blive\b|customers|trusted by|\d+%/i);
  });
});
