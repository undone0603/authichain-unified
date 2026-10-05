import { mkdtempSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { auditAllFarmPassports, auditFarmPassports } from "./passport-audit";

const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { recursive: true, force: true });
  }
});

describe("StrainChain passport audit", () => {
  it("audits the full source-to-fingerprint path without rewriting source data", () => {
    const audit = auditFarmPassports("mendo-love-farms");

    expect(audit.publication).toBe("withdrawn");
    expect(audit.certificateCount).toBe(12);
    expect(audit.fingerprintCount).toBe(audit.cultivarCount);
    expect(audit.status).toBe("blocked");
    expect(audit.issues).toContainEqual(
      expect.objectContaining({
        code: "derived_total_mismatch",
        subject: "certificate:260715S011-001",
        severity: "error",
      })
    );
    expect(
      audit.issues.some(issue => issue.code === "fingerprint_mismatch")
    ).toBe(false);
  });

  it("marks a remote source as unverified locally instead of fetching it", () => {
    const audit = auditFarmPassports("gtr-seeds", { includeUnlisted: true });

    expect(audit.publication).toBe("unlisted");
    expect(audit.issues).toContainEqual(
      expect.objectContaining({
        code: "source_not_locally_verifiable",
        subject: "certificate:C231203-41",
      })
    );
    expect(audit.issues.some(issue => issue.severity === "error")).toBe(false);
  });

  it("detects local source bytes that differ from the recorded digest", () => {
    const root = mkdtempSync(join(tmpdir(), "strainchain-audit-"));
    temporaryRoots.push(root);
    const coaDirectory = join(
      root,
      "content/strainchain/mendo-love-farms/coas"
    );
    mkdirSync(coaDirectory, { recursive: true });
    writeFileSync(join(coaDirectory, "240823Q009-001.pdf"), "tampered");
    writeFileSync(join(coaDirectory, "251104R041-001.pdf"), "tampered");

    const audit = auditFarmPassports("mendo-love-farms", {
      repositoryRoot: root,
    });

    expect(audit.issues).toContainEqual(
      expect.objectContaining({
        code: "source_hash_mismatch",
        subject: "certificate:240823Q009-001",
        severity: "error",
      })
    );
  });

  it("reports unknown farms as blocked and audits every known farm", () => {
    expect(auditFarmPassports("unknown-farm").status).toBe("blocked");
    expect(auditAllFarmPassports().map(audit => audit.farm)).toEqual([
      "mendo-love-farms",
    ]);
  });
});
