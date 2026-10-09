import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const src = readFileSync(join(__dirname, "page.tsx"), "utf8");

describe("StrainChain passport thank-you copy (ADM-172)", () => {
  it("names a real refund address, never a placeholder", () => {
    expect(src).not.toContain("[SUPPORT EMAIL]");
    expect(src).toContain("mailto:support@authichain.com");
    expect(src).toContain("refund you in full");
  });
  it("makes no delivery-date promise", () => {
    expect(src).not.toMatch(/within \d|business days|\bhours\b/i);
  });
});
