import { describe, expect, it } from "vitest";
import { verticalMayActOnVerified } from "./vertical-verification";

describe("vertical verification gate", () => {
  it("only permits action on the canonical verified response", () => {
    expect(verticalMayActOnVerified({ decision: "verified", valid: true })).toBe(true);
    for (const decision of ["warning", "blocked", "revoked", "expired", "risk", "indeterminate", "not_found"]) {
      expect(verticalMayActOnVerified({ decision, valid: true })).toBe(false);
    }
    expect(verticalMayActOnVerified({ decision: "verified", valid: false })).toBe(false);
  });

  it("refuses a verified body under an error status when the status is known", () => {
    const verified = { decision: "verified", valid: true };
    expect(verticalMayActOnVerified(verified, 200)).toBe(true);
    expect(verticalMayActOnVerified(verified, 409)).toBe(false);
    expect(verticalMayActOnVerified(verified, 503)).toBe(false);
  });
});
