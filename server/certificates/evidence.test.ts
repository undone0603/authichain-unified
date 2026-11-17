import { createHash, createHmac } from "crypto";
import { describe, expect, it, vi } from "vitest";
import { buildEvidenceBundle, canonicalize } from "./evidence";

describe("canonicalize", () => {
  it("is independent of key order and drops undefined", () => {
    expect(canonicalize({ b: 1, a: { d: 2, c: undefined, e: [3, { z: 1, y: 2 }] } })).toBe(
      canonicalize({ a: { e: [3, { y: 2, z: 1 }], d: 2 }, b: 1 })
    );
  });
  it("serialises Dates as ISO strings", () => {
    const d = new Date("2026-01-02T03:04:05.000Z");
    expect(canonicalize({ at: d })).toBe('{"at":"2026-01-02T03:04:05.000Z"}');
  });
});

describe("buildEvidenceBundle", () => {
  const payload = { certificate: { n: "AC-1" }, authentication: null };
  const now = new Date("2026-11-13T00:00:00.000Z");

  it("digests the canonical payload and is unsigned without a key", () => {
    vi.stubEnv("EVIDENCE_SIGNING_KEY", "");
    const b = buildEvidenceBundle(payload, { now });
    expect(b.digest).toBe(createHash("sha256").update(canonicalize(payload)).digest("hex"));
    expect(b.signature).toBeNull();
    expect(b.signatureAlgorithm).toBeNull();
    expect(b.generatedAt).toBe("2026-11-13T00:00:00.000Z");
    vi.unstubAllEnvs();
  });

  it("signs the digest with HMAC-SHA256 when a key is set", () => {
    const b = buildEvidenceBundle(payload, { now, signingKey: "k" });
    expect(b.signature).toBe(createHmac("sha256", "k").update(b.digest).digest("hex"));
    expect(b.signatureAlgorithm).toBe("HMAC-SHA256");
  });

  it("changes digest and signature if the payload is tampered with", () => {
    const a = buildEvidenceBundle(payload, { now, signingKey: "k" });
    const t = buildEvidenceBundle({ ...payload, certificate: { n: "AC-2" } }, { now, signingKey: "k" });
    expect(t.digest).not.toBe(a.digest);
    expect(t.signature).not.toBe(a.signature);
  });
});
