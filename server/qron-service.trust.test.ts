import { describe, expect, it } from "vitest";
import {
  EVIDENCE_TALLY_ABSENT_SENTENCE,
  EVIDENCE_TALLY_SENTENCE,
  computeTrustScore,
  evidenceTally,
  visualCompareResult,
} from "./qron-service";

describe("computeTrustScore", () => {
  it("does not call a full flag tally a passport", () => {
    const score = computeTrustScore({
      qrDecodePass: true,
      blockchainCertExists: true,
      communityVerified: 5,
      communityFlagged: 0,
      openArtRegistered: true,
      visualFingerprint: {
        pass: true,
        similarity: 1,
        verdict: "not_a_passport",
        details: "pattern match",
      },
    });
    expect(score.score).toBe(100);
    expect(score.verdict).toBe("not_a_passport");
    expect(JSON.stringify(score)).not.toMatch(
      /"authentic"|"suspicious"|"unregistered"|"genuine"|"verified":true/i
    );
  });
});

describe("evidenceTally", () => {
  it("counts stored server-observed evidence and keeps the retired names out", () => {
    const tally = evidenceTally({
      passport: {
        evidence: [
          {
            type: "visual_similarity",
            source: "phash",
            similarity: 0.95,
            aboveThreshold: true,
          },
          {
            type: "metrc_manifest_match",
            licenseNumber: "lic",
            manifestNumber: "man",
            packageTag: "tag",
            source: "metrc_readonly",
          },
          { type: "dscsa_package_ti", packageId: "pkg-1" },
          { type: "hash_publication" },
          {
            type: "visual_similarity",
            source: "clip",
            similarity: 0.5,
            aboveThreshold: false,
          },
          { type: "seal_observation", count: 2 },
          { type: "inspection", digest: "sha256:" + "ab".repeat(32) },
          { type: "note" },
          { nfcMatch: true, visualMatch: 100 },
        ],
      },
      qrDecodePass: true,
      blockchainCertExists: true,
      nfcMatch: true,
      visualMatch: 100,
    });
    expect(tally).toEqual({
      count: 5,
      verdict: "not_a_passport",
      message: EVIDENCE_TALLY_SENTENCE,
    });
    expect(Object.hasOwn(tally, "genuine")).toBe(false);
    expect(JSON.stringify(tally)).not.toMatch(
      /"authentic"|"suspicious"|"unregistered"|"genuine"/i
    );
    expect(tally.message).not.toMatch(
      /\bauthentic\b|\bsuspicious\b|\bunregistered\b/
    );
  });

  it("does not tally caller flags, a receipt, or an empty passport", () => {
    expect(evidenceTally(null)).toEqual({
      count: 0,
      verdict: "not_a_passport",
      message: EVIDENCE_TALLY_ABSENT_SENTENCE,
    });
    expect(
      evidenceTally({
        qrDecodePass: true,
        blockchainCertExists: true,
        nfcMatch: true,
        visualMatch: 100,
        communityVerified: 5,
        openArtRegistered: true,
        anchor: { status: "confirmed" },
        passport: { evidence: [] },
      })
    ).toEqual({
      count: 0,
      verdict: "not_a_passport",
      message: EVIDENCE_TALLY_ABSENT_SENTENCE,
    });
    expect(evidenceTally([{ type: "note" }, { genuine: true }])).toEqual({
      count: 0,
      verdict: "not_a_passport",
      message: EVIDENCE_TALLY_ABSENT_SENTENCE,
    });
  });
});

describe("visualCompareResult", () => {
  it("keeps a close visual match from being a passport", () => {
    const result = visualCompareResult(0.95, "phash");
    expect(result.pass).toBe(true);
    expect(result.verdict).toBe("not_a_passport");
    expect(JSON.stringify(result)).not.toMatch(
      /authentic|fake|suspicious|genuine|counterfeit/i
    );
  });

  it("keeps a distant visual match from being a passport", () => {
    const result = visualCompareResult(0.2, "clip");
    expect(result.pass).toBe(false);
    expect(result.verdict).toBe("not_a_passport");
    expect(result.details).toMatch(/product passport/);
  });
});
