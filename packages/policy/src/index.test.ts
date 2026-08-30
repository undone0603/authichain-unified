import { describe, it, expect } from "vitest";
import { PolicyEngine } from ".";
import { MandatoryEvidenceRule } from "./rules";
import { Evidence } from "@authichain/evidence";

describe("PolicyEngine", () => {
  const engine = new PolicyEngine({
    id: "test_policy",
    version: "1.0",
    rules: [MandatoryEvidenceRule],
  });

  it("verifies when all evidence is present", () => {
    const evidence: Evidence[] = [
      {
        id: "1",
        subject_id: "prod1",
        type: "manufacturing",
        issuer: { id: "i1", name: "n1" },
        timestamp: "2026-08-30T10:00:00Z",
        digest: "sha256:..." as any,
        signature: "s1",
      },
      {
        id: "2",
        subject_id: "prod1",
        type: "inspection",
        issuer: { id: "i1", name: "n1" },
        timestamp: "2026-08-30T10:00:00Z",
        digest: "sha256:..." as any,
        signature: "s2",
      },
    ];
    expect(engine.evaluate(evidence)).toBe("verified");
  });

  it("blocks when manufacturing evidence is missing", () => {
    const evidence: Evidence[] = [
      {
        id: "2",
        subject_id: "prod1",
        type: "inspection",
        issuer: { id: "i1", name: "n1" },
        timestamp: "2026-08-30T10:00:00Z",
        digest: "sha256:..." as any,
        signature: "s2",
      },
    ];
    expect(engine.evaluate(evidence)).toBe("blocked");
  });
});
