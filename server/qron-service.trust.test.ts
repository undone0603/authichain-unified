import { describe, expect, it } from "vitest";
import { computeTrustScore, visualCompareResult } from "./qron-service";

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
    expect(JSON.stringify(score)).not.toMatch(/"authentic"|"genuine"|"verified":true/i);
  });
});

describe("visualCompareResult", () => {
  it("keeps a close visual match from being a passport", () => {
    const result = visualCompareResult(0.95, "phash");
    expect(result.pass).toBe(true);
    expect(result.verdict).toBe("not_a_passport");
    expect(JSON.stringify(result)).not.toMatch(/authentic|fake|suspicious|genuine|counterfeit/i);
  });

  it("keeps a distant visual match from being a passport", () => {
    const result = visualCompareResult(0.2, "clip");
    expect(result.pass).toBe(false);
    expect(result.verdict).toBe("not_a_passport");
    expect(result.details).toMatch(/product passport/);
  });
});
