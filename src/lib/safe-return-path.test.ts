import { describe, it, expect } from "vitest";
import { safeReturnUrl } from "./safe-return-path";

const BASE = "https://authichain.com";
const FALLBACK = "/dashboard";

describe("safeReturnUrl", () => {
  it("keeps a same-origin path", () => {
    expect(safeReturnUrl(BASE, "/billing?tab=plan", FALLBACK)).toBe(
      "https://authichain.com/billing?tab=plan"
    );
  });

  it.each([
    "https://evil.example/phish",
    "//evil.example/phish",
    "/\\evil.example",
    "javascript:alert(1)",
    "dashboard",
    undefined,
    42,
  ])("falls back for %s", requested => {
    expect(safeReturnUrl(BASE, requested, FALLBACK)).toBe(
      "https://authichain.com/dashboard"
    );
  });
});
