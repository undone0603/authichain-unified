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
});
