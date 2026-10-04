import { describe, expect, it } from "vitest";
import { prepareStrainchainLifecycle } from "./strainchain-lifecycle";

describe("StrainChain evidence-to-passport lifecycle", () => {
  it("holds withdrawn farms before fingerprint preparation or issuance", () => {
    const report = prepareStrainchainLifecycle("mendo-love-farms");

    expect(report.publication).toBe("withdrawn");
    expect(report.evidenceReview).toBe("blocked");
    expect(report.publicListing).toBe("blocked");
    expect(report.fingerprintPreparation).toBe("blocked");
    expect(report.issuerAction).toBe("blocked");
    expect(report.fingerprints).toEqual([]);
  });

  it("keeps unlisted farms private and requires a review before issuer action", () => {
    const report = prepareStrainchainLifecycle("gtr-seeds", {
      includeUnlisted: true,
    });

    expect(report.publication).toBe("unlisted");
    expect(report.publicListing).toBe("blocked");
    expect(report.fingerprintPreparation).toBe("blocked");
    expect(report.issuerAction).toBe("blocked");
    expect(report.fingerprints).toEqual([]);
  });

  it("fails closed for an unknown farm", () => {
    const report = prepareStrainchainLifecycle("unknown-farm");

    expect(report.publication).toBe("unknown");
    expect(report.evidenceReview).toBe("blocked");
    expect(report.publicListing).toBe("blocked");
    expect(report.issuerAction).toBe("blocked");
    expect(report.blockers.length).toBeGreaterThan(0);
  });
});
