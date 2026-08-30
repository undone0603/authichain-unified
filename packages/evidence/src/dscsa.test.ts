import { describe, it, expect } from "vitest";
import { DsCsaEvidenceSchema } from "./index";

describe("DsCsaEvidenceSchema", () => {
  it("validates a correct DSCSA event", () => {
    const validDscsaEvidence = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      subject_id: "prod_123",
      type: "manufacturing",
      issuer: { id: "issuer_1", name: "Pharma Co" },
      timestamp: "2026-08-30T10:00:00Z",
      digest:
        "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      signature: "base64sig",
      metadata: {
        lotNumber: "LOT123",
        expirationDate: "2027-08-30T00:00:00Z",
        tradingPartnerId: "PARTNER_1",
        transactionId: "TX_999",
      },
    };
    expect(DsCsaEvidenceSchema.safeParse(validDscsaEvidence).success).toBe(
      true
    );
  });

  it("rejects DSCSA event missing required metadata", () => {
    const invalidDscsaEvidence = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      subject_id: "prod_123",
      type: "manufacturing",
      issuer: { id: "issuer_1", name: "Pharma Co" },
      timestamp: "2026-08-30T10:00:00Z",
      digest:
        "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      signature: "base64sig",
      metadata: {
        lotNumber: "LOT123",
        // Missing expirationDate
        tradingPartnerId: "PARTNER_1",
        transactionId: "TX_999",
      },
    };
    expect(DsCsaEvidenceSchema.safeParse(invalidDscsaEvidence).success).toBe(
      false
    );
  });
});
