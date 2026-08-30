import { describe, it, expect } from "vitest";
import { EvidenceSchema } from ".";

describe("EvidenceSchema", () => {
  it("validates a correct manufacturing event", () => {
    const validEvidence = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      subject_id: "ac_prod_123",
      type: "manufacturing",
      issuer: { id: "issuer_1", name: "Acme Corp" },
      timestamp: "2026-08-30T10:00:00Z",
      digest:
        "sha256:e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855",
      signature: "base64sig",
    };
    expect(EvidenceSchema.safeParse(validEvidence).success).toBe(true);
  });

  it("rejects malformed digest", () => {
    const invalidEvidence = {
      id: "550e8400-e29b-41d4-a716-446655440000",
      subject_id: "ac_prod_123",
      type: "manufacturing",
      issuer: { id: "issuer_1", name: "Acme Corp" },
      timestamp: "2026-08-30T10:00:00Z",
      digest: "invalid-digest",
      signature: "base64sig",
    };
    expect(EvidenceSchema.safeParse(invalidEvidence).success).toBe(false);
  });
});
