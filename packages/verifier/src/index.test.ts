import { describe, expect, it } from "vitest";
import { generateKeyPair, exportJWK } from "jose";
import {
  parseJws,
  verifyAttestationJws,
  validateAttestation,
  canonicalize,
  signAttestation,
  getKeyId,
} from ".";
import fixture from "../../../fixtures/attestation-v0.1-valid.json";
import jwks from "../../../fixtures/attestation-v0.1-jwks.json";
import fs from "node:fs";
import path from "node:path";

const validJws = fs
  .readFileSync(path.join(process.cwd(), "fixtures/attestation-v0.1-valid.jws"), "utf8")
  .trim();
const tamperedJws = fs
  .readFileSync(path.join(process.cwd(), "fixtures/attestation-v0.1-tampered.jws"), "utf8")
  .trim();

async function signVariant(
  variant: Record<string, unknown>,
  keyId = "proof-test-kid"
) {
  const { privateKey } = await generateKeyPair("Ed25519");
  const jws = await signAttestation(
    structuredClone(variant) as typeof fixture,
    privateKey,
    keyId
  );
  const publicJwk = await exportJWK(privateKey);
  delete (publicJwk as Record<string, unknown>).d;
  publicJwk.kid = keyId;
  return { jws, publicJwk };
}

describe("AuthiChain Attestation Contract v0.1", () => {
  it("verifies the canonical signed fixture", async () => {
    const attestation = await verifyAttestationJws(validJws, jwks.keys[0]);
    expect(canonicalize(attestation as never)).toBe(
      canonicalize(fixture as never)
    );
    expect(attestation.decision).toBe("verified");
  });

  it("rejects a tampered payload", async () => {
    await expect(verifyAttestationJws(tamperedJws, jwks.keys[0])).rejects.toThrow();
  });

  it("rejects an altered signature", async () => {
    const parts = validJws.split(".");
    parts[2] = parts[2].slice(0, -1) + (parts[2].endsWith("A") ? "B" : "A");
    await expect(verifyAttestationJws(parts.join("."), jwks.keys[0])).rejects.toThrow();
  });

  it("rejects a valid signature paired with the wrong key id", async () => {
    await expect(
      verifyAttestationJws(validJws, { ...jwks.keys[0], kid: "wrong-key" })
    ).rejects.toThrow(/kid does not match/);
  });

  it("rejects a signed attestation with the wrong subject", async () => {
    const { jws, publicJwk } = await signVariant({
      ...fixture,
      subject: { ...fixture.subject, object_id: "authi_wrong_object" },
    });
    await expect(
      verifyAttestationJws(jws, publicJwk, { expectedObjectId: fixture.subject.object_id })
    ).rejects.toThrow(/subject object_id/);
  });

  it("rejects a revoked attestation", async () => {
    const { jws, publicJwk } = await signVariant({
      ...fixture,
      status: "revoked",
    });
    await expect(verifyAttestationJws(jws, publicJwk)).rejects.toThrow(/status is revoked/);
  });

  it("rejects a stale/expired attestation", async () => {
    const { jws, publicJwk } = await signVariant({
      ...fixture,
      issued_at: "2024-01-01T00:00:00.000Z",
      expires_at: "2024-01-02T00:00:00.000Z",
    });
    await expect(verifyAttestationJws(jws, publicJwk, { now: Date.parse("2024-01-03T00:00:00.000Z") }))
      .rejects.toThrow(/expired/);
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
        evidence: [{ ...fixture.evidence[0], digest: "sha256:not-a-digest" },
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

  it("documents the boundary between cryptographic validity and physical identity continuity", async () => {
    const attestation = await verifyAttestationJws(validJws, jwks.keys[0]);
    expect(attestation.subject.object_id).toBe("ac_fixture_001");
    expect(attestation.subject.serial).toBe("SN-001");
    expect(attestation.subject.gtin).toBe("00012345678905");
  });
});
