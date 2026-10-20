import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  EVIDENCE_TALLY_ABSENT_SENTENCE,
  EVIDENCE_TALLY_SENTENCE,
  VISUAL_COMPARE_ABSENT_SENTENCE,
  computeTrustScore,
  evidenceTally,
  visualCompareResult,
  visualEvidenceEntry,
} from "./qron-service";

const IDENTITY = "urn:authichain:item:example-1";

function passportMetadata(extra?: Record<string, unknown>) {
  return {
    ...extra,
    passport: {
      record: {
        type: ["VerifiableCredential", "DigitalProductPassport"],
        credentialSubject: { id: IDENTITY },
      },
    },
  };
}

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
    expect(result.details).toBe(VISUAL_COMPARE_ABSENT_SENTENCE);
    expect(result.evidence).toBeUndefined();
  });

  it("appends visual similarity beside a stored passport without setting genuine", () => {
    const metadata = passportMetadata({ visualMatch: 0.99 });
    const result = visualCompareResult(0.95, "phash", metadata);
    expect(result.verdict).toBe("not_a_passport");
    expect(result.pass).toBe(true);
    expect(result.evidence).toEqual({
      type: "visual_similarity",
      source: "phash",
      similarity: 0.95,
      threshold: 0.9,
      aboveThreshold: true,
    });
    expect(Object.hasOwn(result.evidence ?? {}, "genuine")).toBe(false);
    expect(Object.hasOwn(result, "genuine")).toBe(false);
    expect(JSON.stringify(result.evidence)).not.toContain("0.99");
    expect(JSON.stringify(result.evidence)).not.toContain("visualMatch");
    expect(result.details).toBe(
      `A server-side image compare recorded similarity 0.95 as evidence on passport ${IDENTITY}. It is not the genuineness verdict.`
    );
    const stored = result.metadata?.passport as {
      evidence?: unknown[];
      record?: { credentialSubject?: { id?: string } };
    };
    expect(stored.evidence).toEqual([result.evidence]);
    expect(stored.record?.credentialSubject?.id).toBe(IDENTITY);
    expect(result.metadata?.passport).toMatchObject({
      record: metadata.passport.record,
    });
  });

  it("records a below-threshold compare and ignores the caller visualMatch number", () => {
    const result = visualCompareResult(
      0.2,
      "clip",
      passportMetadata({ visualMatch: 1 })
    );
    expect(result.pass).toBe(false);
    expect(result.verdict).toBe("not_a_passport");
    expect(result.evidence).toEqual(visualEvidenceEntry(0.2, "clip"));
    expect(result.evidence?.threshold).toBe(0.85);
    expect(result.evidence?.aboveThreshold).toBe(false);
    expect(JSON.stringify(result.evidence)).not.toContain("visualMatch");
  });

  it("keeps a second compare as another evidence row on the same passport", () => {
    const first = visualCompareResult(0.95, "phash", passportMetadata());
    const second = visualCompareResult(0.91, "phash", first.metadata);
    const evidence = (second.metadata?.passport as { evidence?: unknown[] })
      .evidence;
    expect(evidence).toHaveLength(2);
    expect(second.verdict).toBe("not_a_passport");
    expect(Object.hasOwn(second, "genuine")).toBe(false);
  });
});

describe("computeTrustScore with visual evidence", () => {
  it("does not copy the evidence row into the tally", () => {
    const compared = visualCompareResult(0.95, "phash", passportMetadata());
    const score = computeTrustScore({
      qrDecodePass: false,
      blockchainCertExists: false,
      communityVerified: 0,
      communityFlagged: 1,
      openArtRegistered: false,
      visualFingerprint: compared,
    });
    expect(score.verdict).toBe("not_a_passport");
    expect(JSON.stringify(score)).not.toContain("visual_similarity");
    expect(JSON.stringify(score)).not.toMatch(/"genuine"/);
  });
});

describe("verifyVisualFingerprint wiring", () => {
  it("passes stored metadata into the compare and does not read visualMatch", () => {
    const src = readFileSync(
      path.join(import.meta.dirname, "qron-service.ts"),
      "utf8"
    );
    expect(src).toContain(
      'visualCompareResult(hashSim, "phash", params.metadata)'
    );
    expect(src).toContain('visualCompareResult(sim, "clip", params.metadata)');
    const entry = src.slice(
      src.indexOf("export function visualEvidenceEntry"),
      src.indexOf("export function visualEvidenceSentence")
    );
    expect(entry).not.toContain("visualMatch");
  });
});
