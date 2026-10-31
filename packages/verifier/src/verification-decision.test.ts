import { describe, expect, it } from "vitest";
import { resolveVerificationDecision } from "./verification-decision";

const base = {
  cryptographicValid: true,
  issuerTrusted: true,
  claimStatus: "active" as const,
  signedDecision: "verified" as const,
  expired: false,
  found: true,
};

describe("resolveVerificationDecision", () => {
  it("returns verified only for a fully trusted active claim", () => {
    expect(resolveVerificationDecision(base)).toEqual({
      decision: "verified",
      valid: true,
      reasons: [],
    });
  });

  it("distinguishes missing identifiers from counterfeit claims", () => {
    expect(resolveVerificationDecision({ ...base, found: false })).toEqual({
      decision: "not_found",
      valid: false,
      reasons: ["identifier_or_attestation_not_found"],
    });
  });

  it("fails closed when cryptographic verification fails", () => {
    expect(resolveVerificationDecision({ ...base, cryptographicValid: false })).toEqual({
      decision: "indeterminate",
      valid: false,
      reasons: ["cryptographic_verification_failed"],
    });
  });

  it("fails closed when the issuer is not currently trusted", () => {
    expect(resolveVerificationDecision({ ...base, issuerTrusted: false })).toEqual({
      decision: "indeterminate",
      valid: false,
      reasons: ["issuer_not_trusted"],
    });
  });

  it("preserves durable revocation as a lifecycle decision", () => {
    expect(resolveVerificationDecision({ ...base, claimStatus: "revoked" })).toEqual({
      decision: "revoked",
      valid: false,
      reasons: ["durable_status_revoked"],
    });
  });

  it("distinguishes expiry from revocation", () => {
    expect(resolveVerificationDecision({ ...base, expired: true })).toEqual({
      decision: "expired",
      valid: false,
      reasons: ["expired"],
    });
  });

  it("preserves durable expiry as a lifecycle reason", () => {
    expect(resolveVerificationDecision({ ...base, claimStatus: "expired" })).toEqual({
      decision: "expired",
      valid: false,
      reasons: ["durable_status_expired"],
    });
  });

  it.each([
    ["warning", "warning", "decision_warning"],
    ["blocked", "blocked", "decision_blocked"],
  ] as const)("preserves issuer decision %s without calling it valid", (_label, signedDecision, reason) => {
    expect(
      resolveVerificationDecision({ ...base, signedDecision }),
    ).toEqual({ decision: signedDecision, valid: false, reasons: [reason] });
  });

  it("surfaces physical-world risk without overriding the cryptographic record", () => {
    expect(
      resolveVerificationDecision({ ...base, riskSignals: ["scan_velocity", "geo_spread"] }),
    ).toEqual({
      decision: "risk",
      valid: false,
      reasons: ["risk_scan_velocity", "risk_geo_spread"],
    });
  });

  it("treats supersession as a non-valid risk state", () => {
    expect(resolveVerificationDecision({ ...base, claimStatus: "superseded" })).toEqual({
      decision: "risk",
      valid: false,
      reasons: ["durable_status_superseded"],
    });
  });
});
