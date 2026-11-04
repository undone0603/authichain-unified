import { generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  canonicalize,
  didFromPublicKey,
  issueRecord,
  STATEMENT,
  verifyRecord,
} from "../musa/claim-attestation.mjs";

const { privateKey, publicKey } = generateKeyPairSync("ed25519");
const issuer = didFromPublicKey(publicKey);
const input = {
  id: "claim-001",
  sku: "RB-100",
  company: "Example Co",
  claimWording: "Made in USA",
  evidence: [{ name: "bom.csv", sha256: "a".repeat(64) }],
  openItems: ["Fastener origin not yet confirmed"],
};
const now = new Date("2026-11-04T00:00:00.000Z");

describe("claim attestation", () => {
  it("issues a record that verifies against the expected issuer", () => {
    const record = issueRecord(input, privateKey, now);
    expect(record.issuer).toBe(issuer);
    expect(verifyRecord(record, { expectIssuer: issuer })).toEqual({
      ok: true,
      reasons: [],
    });
  });

  it("says it is not a certification and keeps open items", () => {
    const { credentialSubject } = issueRecord(input, privateKey, now);
    expect(credentialSubject.statement).toBe(STATEMENT);
    expect(STATEMENT).toContain("not a certification");
    expect(credentialSubject.openItems).toEqual(input.openItems);
  });

  it("rejects a changed record", () => {
    const record = issueRecord(input, privateKey, now);
    record.credentialSubject.openItems = [];
    expect(verifyRecord(record, { expectIssuer: issuer }).ok).toBe(false);
  });

  it("rejects a record signed by a different key, even though it self-verifies", () => {
    const other = generateKeyPairSync("ed25519").privateKey;
    const result = verifyRecord(issueRecord(input, other, now), {
      expectIssuer: issuer,
    });
    expect(result.ok).toBe(false);
    expect(result.reasons).toContain("issuer is not the expected issuer");
  });

  it("fails closed without an expected issuer", () => {
    expect(verifyRecord(issueRecord(input, privateKey, now)).ok).toBe(false);
  });

  it("rejects altered statement wording", () => {
    const record = issueRecord(input, privateKey, now);
    record.credentialSubject.statement =
      "This product is certified Made in USA.";
    expect(verifyRecord(record, { expectIssuer: issuer }).ok).toBe(false);
  });

  it("refuses to issue without evidence or claim wording", () => {
    expect(() =>
      issueRecord({ ...input, evidence: [] }, privateKey, now)
    ).toThrow("evidence");
    expect(() =>
      issueRecord({ ...input, claimWording: " " }, privateKey, now)
    ).toThrow("claimWording");
  });

  it("canonicalizes independent of key order", () => {
    expect(canonicalize({ b: 1, a: [true, null] })).toBe(
      canonicalize({ a: [true, null], b: 1 })
    );
  });
});
