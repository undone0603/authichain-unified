import { describe, expect, it } from "vitest";
import { currentClaimStatus, isIssuerTrustedAt } from "./trust-registry";

describe("attestation trust registry contract", () => {
  it("requires a trusted issuer inside its validity window", () => {
    const issuer = {
      issuerId: "urn:authichain:issuer:example",
      organization: "Example Agency",
      issuerType: "government" as const,
      jwksUri: "https://example.test/.well-known/jwks.json",
      status: "trusted" as const,
      validFrom: "2026-01-01T00:00:00Z",
      validUntil: "2027-01-01T00:00:00Z",
    };
    expect(isIssuerTrustedAt(issuer, new Date("2026-09-30T00:00:00Z"))).toBe(true);
    expect(isIssuerTrustedAt(issuer, new Date("2027-01-01T00:00:00Z"))).toBe(false);
  });

  it("treats suspended issuers as untrusted", () => {
    const issuer = {
      issuerId: "urn:authichain:issuer:example",
      organization: "Example Agency",
      issuerType: "government" as const,
      jwksUri: "https://example.test/.well-known/jwks.json",
      status: "suspended" as const,
      validFrom: "2026-01-01T00:00:00Z",
    };
    expect(isIssuerTrustedAt(issuer)).toBe(false);
  });

  it("keeps revocation/supersession as live claim status", () => {
    const record = {
      attestationId: "urn:authichain:attestation:v01:test",
      claimStatus: "revoked" as const,
      effectiveAt: "2026-09-30T00:00:00Z",
      issuerId: "urn:authichain:issuer:example",
      eventId: "urn:authichain:event:v01:test",
    };
    expect(currentClaimStatus(record, new Date("2026-09-30T00:01:00Z"))).toBe("revoked");
  });
});
