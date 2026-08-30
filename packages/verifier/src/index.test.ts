import { describe, expect, it } from "vitest";
import {
  parseJws,
  verifyAttestationJws,
  validateAttestation,
  canonicalize,
} from ".";
import fixture from "../../../fixtures/attestation-v0.1-valid.json";
import jwks from "../../../fixtures/attestation-v0.1-jwks.json";
import fs from "node:fs";
import path from "node:path";

const validJws = fs
  .readFileSync(
    path.join(process.cwd(), "fixtures/attestation-v0.1-valid.jws"),
    "utf8"
  )
  .trim();
const tamperedJws = fs
  .readFileSync(
    path.join(process.cwd(), "fixtures/attestation-v0.1-tampered.jws"),
    "utf8"
  )
  .trim();

describe("AuthiChain Attestation Contract v0.1", () => {
  it("verifies the canonical signed fixture", async () => {
    const attestation = await verifyAttestationJws(validJws, jwks.keys[0]);
    expect(canonicalize(attestation as never)).toBe(
      canonicalize(fixture as never)
    );
    expect(attestation.decision).toBe("verified");
  });

  it("rejects a tampered payload", async () => {
    await expect(
      verifyAttestationJws(tamperedJws, jwks.keys[0])
    ).rejects.toThrow();
  });

  it("rejects a valid signature paired with the wrong key id", async () => {
    await expect(
      verifyAttestationJws(validJws, { ...jwks.keys[0], kid: "wrong-key" })
    ).rejects.toThrow(/kid does not match/);
  });

  it("rejects malformed compact JWS values", () => {
    expect(() => parseJws("not-a-jws")).toThrow(/invalid compact JWS/);
    expect(() => parseJws("a.b")).toThrow(/invalid compact JWS/);
  });

  it("rejects unsupported JWS algorithms and types before verification", async () => {
    const parsed = parseJws(validJws);
    const header = Buffer.from(
      JSON.stringify({ ...parsed.protected, alg: "HS256" })
    ).toString("base64url");
    const candidate = `${header}.${validJws.split(".")[1]}.${validJws.split(".")[2]}`;
    await expect(verifyAttestationJws(candidate, jwks.keys[0])).rejects.toThrow(
      /unsupported attestation JWS header/
    );
  });

  it("requires issuer identity fields", () => {
    expect(() =>
      validateAttestation({
        ...fixture,
        issuer: { id: "https://authichain.com" },
      })
    ).toThrow(/issuer.name/);
    expect(() =>
      validateAttestation({ ...fixture, issuer: { name: "AuthiChain" } })
    ).toThrow(/issuer.id/);
  });

  it("requires a provider-scoped object id", () => {
    expect(() =>
      validateAttestation({
        ...fixture,
        subject: { ...fixture.subject, object_id: "" },
      })
    ).toThrow(/object_id/);
  });

  it("rejects malformed or missing product identifiers", () => {
    expect(() =>
      validateAttestation({
        ...fixture,
        subject: { ...fixture.subject, gtin: "abc" },
      })
    ).toThrow(/gtin/);
    expect(() =>
      validateAttestation({
        ...fixture,
        subject: { ...fixture.subject, gtin: "1234567" },
      })
    ).toThrow(/gtin/);
    expect(() =>
      validateAttestation({
        ...fixture,
        subject: { ...fixture.subject, serial: 123 },
      })
    ).toThrow(/serial/);
    expect(() =>
      validateAttestation({
        ...fixture,
        subject: { ...fixture.subject, lot: 123 },
      })
    ).toThrow(/lot/);
  });

  it("rejects malformed evidence digests", () => {
    expect(() =>
      validateAttestation({
        ...fixture,
        evidence: [{ ...fixture.evidence[0], digest: "sha256:not-a-digest" }],
      })
    ).toThrow(/digest/);
  });

  it("rejects missing, malformed, or empty evidence entries", () => {
    expect(() => validateAttestation({ ...fixture, evidence: null })).toThrow(
      /evidence must be an array/
    );
    expect(() => validateAttestation({ ...fixture, evidence: [{}] })).toThrow(
      /evidence\[0\]\.id/
    );
    expect(() =>
      validateAttestation({
        ...fixture,
        evidence: [{ ...fixture.evidence[0], type: "" }],
      })
    ).toThrow(/evidence\[0\]\.type/);
  });

  it("rejects an expiry at or before issuance", () => {
    expect(() =>
      validateAttestation({ ...fixture, expires_at: fixture.issued_at })
    ).toThrow(/expires_at/);
    expect(() =>
      validateAttestation({ ...fixture, expires_at: "not-a-date" })
    ).toThrow(/expires_at/);
  });

  it("allows explicit warning, blocked, revoked, and unknown states to remain inspectable", () => {
    for (const decision of ["warning", "blocked"] as const) {
      expect(validateAttestation({ ...fixture, decision }).decision).toBe(
        decision
      );
    }
    for (const status of ["revoked", "unknown"] as const) {
      expect(validateAttestation({ ...fixture, status }).status).toBe(status);
    }
  });

  it("documents the boundary between cryptographic validity and physical identity continuity", async () => {
    const attestation = await verifyAttestationJws(validJws, jwks.keys[0]);
    expect(attestation.subject.object_id).toBe("ac_fixture_001");
    expect(attestation.subject.serial).toBe("SN-001");
    expect(attestation.subject.gtin).toBe("00012345678905");
    // A verifier may cryptographically validate this statement, but a copied QR
    // or transferred label still requires an external registry/evidence check to
    // prove that the scanned physical item is the same subject.
  });
});
