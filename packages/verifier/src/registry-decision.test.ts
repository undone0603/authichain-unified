import { describe, expect, it } from "vitest";
import { registryLookupDecision } from "./registry-decision";

const now = Date.parse("2026-10-15T12:00:00Z");

describe("registryLookupDecision", () => {
  it("a missing record is not_found and says it is not evidence of counterfeit", () => {
    const d = registryLookupDecision(null, now);
    expect(d).toMatchObject({ valid: false, decision: "not_found", registry: { found: false } });
    expect(d.message).toMatch(/not evidence the item is counterfeit/);
    expect(JSON.stringify(d)).not.toMatch(/"counterfeit"|may be counterfeit/i);
  });

  it("an active record is never verified on its own", () => {
    const d = registryLookupDecision({ status: "active", blockchainTxHash: "0xabc" }, now);
    expect(d).toMatchObject({
      valid: false,
      decision: "indeterminate",
      reasons: ["registry_record_only", "no_signed_attestation_presented"],
      registry: { found: true, status: "active", anchored: true },
    });
    expect(d.next_step).toContain("/api/v1/attestation/verify");
  });

  it("surfaces a revoked record as revoked", () => {
    expect(registryLookupDecision({ status: "REVOKED" }, now)).toMatchObject({ valid: false, decision: "revoked" });
  });

  it("expires by status or by time", () => {
    expect(registryLookupDecision({ status: "expired" }, now).decision).toBe("expired");
    expect(registryLookupDecision({ status: "active", expiresAt: "2026-10-01T00:00:00Z" }, now)).toMatchObject({
      decision: "expired",
      reasons: ["expired"],
    });
    expect(registryLookupDecision({ status: "active", expiresAt: "2027-01-01T00:00:00Z" }, now).decision).toBe(
      "indeterminate",
    );
  });

  it("anchored only reports that a transaction hash is recorded", () => {
    expect(registryLookupDecision({ status: "active", blockchainTxHash: "  " }, now).registry.anchored).toBe(false);
    expect(registryLookupDecision({ status: "active" }, now).registry.anchored).toBe(false);
  });
});
