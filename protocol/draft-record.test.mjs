import { describe, it, expect } from "vitest";
import { draftRecord, draftLog } from "./draft-record.mjs";
import { verifyRecord } from "./verifier.mjs";

describe("draft unsigned provenance record", () => {
  it("is unsigned, unsealed, and idempotent on generationId", () => {
    const record = draftRecord({ generationId: "gen_test_1", destination: "https://example.com" });
    expect(record.proof).toBe(null);
    expect(record.meta.seal).toBe(false);
    expect(draftRecord({ generationId: "gen_test_1" }).credentialSubject.id).toBe(record.credentialSubject.id);
  });

  it("fails the verifier because proof is missing", () => {
    const verdict = verifyRecord(draftRecord({ generationId: "gen_test_1" }));
    expect(verdict.verdict).toBe("invalid");
  });

  it("logs an unsigned draft, not a seal", () => {
    const log = draftLog({ generationId: "gen_test_1" });
    expect(log.event).toBe("draft_seal");
    expect(log.seal).toBe(false);
  });
});
