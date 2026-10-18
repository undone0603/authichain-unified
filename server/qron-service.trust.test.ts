import { describe, expect, it } from "vitest";
import { computeTrustScore } from "./qron-service";

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
        verdict: "authentic",
        details: "pattern match",
      },
    });
    expect(score.score).toBe(100);
    expect(score.verdict).toBe("not_a_passport");
    expect(JSON.stringify(score)).not.toMatch(/"authentic"|"genuine"|"verified":true/i);
  });
});
