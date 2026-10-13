import { describe, expect, it } from "vitest";
import {
  isVerificationDecisionResponse,
  projectVerificationDecision,
} from "./verification-decision-response";

describe("verification decision response contract", () => {
  const verified = {
    decision: "verified" as const,
    valid: true,
    reasons: [],
    status: "active" as const,
    cryptographic_status: "valid" as const,
    issuer_status: "trusted",
    overall_valid: true,
  };

  it("accepts the canonical verified shape", () => {
    expect(isVerificationDecisionResponse(verified)).toBe(true);
  });

  it("accepts every fail-closed decision", () => {
    for (const decision of ["warning", "blocked", "revoked", "expired", "not_found", "risk", "indeterminate"] as const) {
      expect(isVerificationDecisionResponse({ ...verified, decision, valid: false, overall_valid: false })).toBe(true);
    }
  });

  it("rejects an invented decision vocabulary", () => {
    expect(isVerificationDecisionResponse({ ...verified, decision: "authentic" })).toBe(false);
  });

  it("projects only the shared trust decision fields", () => {
    expect(projectVerificationDecision(verified)).toEqual(verified);
  });
});
