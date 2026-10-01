import { describe, expect, it } from "vitest";
import { getEvidenceCollectionState, isSha256Digest, validateSupplierEvidence } from "./supplier-evidence";

describe("MUSA supplier evidence", () => {
  it("accepts canonical SHA-256 digests", () => {
    expect(isSha256Digest(`sha256:${"a".repeat(64)}`)).toBe(true);
    expect(isSha256Digest("sha256:bad")).toBe(false);
  });

  it("fails closed on malformed evidence", () => {
    expect(validateSupplierEvidence({ evidenceType: "", title: "", documentHash: "not-a-digest" })).toEqual([
      "evidenceType is required",
      "title is required",
      "documentHash must be sha256:<64 lowercase hexadecimal characters>",
    ]);
  });

  it("requires valid non-expired evidence for COMPLETE", () => {
    const future = new Date(Date.now() + 86_400_000).toISOString();
    expect(getEvidenceCollectionState([{ status: "valid", expires_at: future }])).toBe("COMPLETE");
  });

  it("fails closed for review-required evidence", () => {
    expect(getEvidenceCollectionState([{ status: "review_required" }])).toBe("REVIEW_REQUIRED");
  });
});
