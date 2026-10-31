// @vitest-environment node
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { verifyRecord } from "../../protocol/verifier.mjs";
import { sealBaseline } from "./seal-baseline";

const fixture = JSON.parse(
  readFileSync("protocol/conformance/fixtures/valid-unanchored.json", "utf8")
);
const now = "2026-10-28T00:00:00.000Z";

describe("buyer-verifiable seal baseline", () => {
  it("returns the original signed evidence and a reproducible verdict", () => {
    const answer = sealBaseline(
      { qr_payload: JSON.stringify({ record: fixture.record }) },
      now
    );
    expect(answer.verified).toBe(false);
    expect(answer.checks.signature).toBe("checked");
    expect(answer.baseline.evidence.record).toEqual(fixture.record);
    expect(answer.baseline).toMatchObject(
      verifyRecord(answer.baseline.evidence.record, null, { now })
    );
    expect(answer.baseline.verdict).toBe("valid-unanchored");
    expect(answer.baseline.unknowns).toContain(
      "issuer_identity_not_authenticated"
    );
  });

  it("rejects a changed subject despite an unchanged proof", () => {
    const record = structuredClone(fixture.record);
    record.credentialSubject.serial = "FORGED";
    const answer = sealBaseline({ qr_payload: JSON.stringify(record) }, now);
    expect(answer.baseline.verdict).toBe("invalid");
    expect(answer.baseline.checks).toMatchObject({ signature: false });
  });

  it.each([
    null,
    { qr_payload: "https://authichain.com/verify" },
    { qr_payload: "{bad json" },
  ])("keeps missing and unsigned evidence explicit: %j", seal => {
    const answer = sealBaseline(seal, now);
    expect(answer.verified).toBe(false);
    expect(answer.baseline.verdict).toBe("unsigned");
    expect(answer.baseline.evidence.record).toBeNull();
    expect(answer.checks.signature).toBe("not_checked");
  });

  it("never treats a supplied anchor as an on-chain query", () => {
    const anchored = JSON.parse(
      readFileSync(
        "protocol/conformance/fixtures/valid-anchored-polygon.json",
        "utf8"
      )
    );
    const answer = sealBaseline(anchored, now);
    expect(answer.verified).toBe(false);
    expect(answer.baseline.verdict).toBe("valid-unanchored");
    expect(answer.baseline.evidence.anchor).toBeNull();
  });

  it("checks time validity, not only a correct signature", () => {
    const expired = JSON.parse(
      readFileSync("protocol/conformance/fixtures/time-expired.json", "utf8")
    );
    const answer = sealBaseline({ record: expired.record }, now);
    expect(answer.baseline.verdict).toBe("invalid");
    expect(answer.baseline.reasons).toContain("expired");
  });

  it("lets a separate buyer process accept evidence and reject tampering and wrong subjects", () => {
    const dir = mkdtempSync(join(tmpdir(), "baseline-"));
    try {
      const path = join(dir, "response.json");
      const response = {
        ...sealBaseline({ record: fixture.record }, now),
        subject: "expected-seal",
      };
      writeFileSync(path, JSON.stringify(response));
      const run = (subject = "expected-seal") =>
        spawnSync(
          process.execPath,
          ["scripts/verify-paid-baseline.mjs", path, subject],
          { encoding: "utf8" }
        );
      expect(run().status).toBe(0);
      expect(run("wrong-seal").status).toBe(1);
      response.baseline.evidence.record!.credentialSubject = { id: "forged" };
      writeFileSync(path, JSON.stringify(response));
      expect(run().status).toBe(1);
      const unsigned = {
        subject: "expected-seal",
        ...sealBaseline({ qr_payload: "https://authichain.com/verify" }, now),
      };
      writeFileSync(path, JSON.stringify(unsigned));
      expect(run().status).toBe(1);
      const expired = JSON.parse(
        readFileSync("protocol/conformance/fixtures/time-expired.json", "utf8")
      );
      writeFileSync(
        path,
        JSON.stringify({
          subject: "expected-seal",
          ...sealBaseline({ record: expired.record }, now),
        })
      );
      expect(run().status).toBe(1);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it("publishes an unpaid buyer walk labeled demonstration", () => {
    const walk = spawnSync(
      process.execPath,
      ["scripts/x402-buyer-example.mjs"],
      {
        encoding: "utf8",
      }
    );
    expect(walk.status).toBe(0);
    const body = JSON.parse(walk.stdout);
    expect(body.label).toBe("demonstration");
    expect(body.steps.join(" ")).toMatch(/X-PAYMENT/);
    expect(body.verifier).toMatch(/verify-paid-baseline/);
  });
});
