import { createHash, generateKeyPairSync } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { signPassport } from "../protocol/passport.mjs";
import { signingBytes } from "../protocol/verifier.mjs";
import type {
  Attestation,
  Evidence,
  Identity,
} from "../protocol/attestation/types";
import {
  ATTESTATION_SIGNED_SENTENCE,
  ATTESTATION_UNSIGNED_SENTENCE,
  attestStoredPassport,
  type AttestSigner,
} from "./passport-attestation";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
const IDENTITY = "urn:authichain:item:example-1";

function b58(buf: Buffer): string {
  let num = BigInt("0x" + (buf.toString("hex") || "0"));
  let out = "";
  while (num > 0n) {
    out = B58[Number(num % 58n)] + out;
    num /= 58n;
  }
  for (const byte of buf) {
    if (byte !== 0) break;
    out = "1" + out;
  }
  return out;
}

function signedPassport() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const raw = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  const issuer =
    "did:key:z" + b58(Buffer.concat([Buffer.from([0xed, 0x01]), raw]));
  const record = signPassport({
    digitalIdentity: IDENTITY,
    privateKey,
    issuer,
  });
  const anchor = {
    recordHash:
      "sha256:" +
      createHash("sha256").update(signingBytes(record)).digest("hex"),
    chain: "polygon:137",
    txHash: "0x" + "ab".repeat(32),
    anchoredAt: "2026-01-01T00:05:00Z",
  };
  return { record, anchor };
}

function fakeSigner(calls: unknown[][]): AttestSigner {
  return async (objectId, identity, evidence, decision) => {
    calls.push([objectId, identity, evidence, decision]);
    const attestation: Attestation = {
      objectId,
      decision,
      issuer: "test",
      subject: identity,
      evidence,
      status: "active",
      verifiedAt: "2026-01-01T00:00:00.000Z",
      signature: { alg: "EdDSA", kid: "test", value: "signed-token" },
    };
    return attestation;
  };
}

describe("attestStoredPassport", () => {
  it("does not sign an approved row that has no genuine passport", async () => {
    const calls: unknown[][] = [];
    const result = await attestStoredPassport(
      { metadata: { status: "active" } },
      { metadata: { status: "approved" }, status: "approved", id: "cert-1" },
      { createAttestation: fakeSigner(calls) }
    );
    expect(result).toEqual({
      signed: false,
      reason: "passport_not_genuine",
      message: ATTESTATION_UNSIGNED_SENTENCE,
    });
    expect(calls).toEqual([]);
    expect(JSON.stringify(result)).not.toMatch(/"signature"/);
  });

  it("signs verified only from a genuine stored passport", async () => {
    const { record, anchor } = signedPassport();
    const calls: unknown[][] = [];
    const result = await attestStoredPassport(
      { metadata: { passport: { record, anchor } }, serialNumber: "unit-9" },
      { status: "revoked", id: "cert-9", serial_number: "unit-9" },
      { createAttestation: fakeSigner(calls) }
    );
    expect(result.signed).toBe(true);
    if (!result.signed) return;
    expect(result.digitalIdentity).toBe(IDENTITY);
    expect(result.message).toBe(
      ATTESTATION_SIGNED_SENTENCE.replace("{digitalIdentity}", IDENTITY)
    );
    expect(result.attestation.decision).toBe("verified");
    expect(calls).toHaveLength(1);
    const [objectId, identity, evidence, decision] = calls[0] as [
      string,
      Identity,
      Evidence[],
      string,
    ];
    expect(decision).toBe("verified");
    expect(objectId).toBe(IDENTITY);
    expect(identity).toEqual({
      profile: "generic-provenance",
      serial: "unit-9",
    });
    expect(evidence).toEqual([]);
    expect(JSON.stringify(calls[0])).not.toMatch(
      /revoked|approved|gtin|genuine/
    );
    expect(result.attestation.signature.value).toBe("signed-token");
  });

  it("keeps an unanchored passport unsigned", async () => {
    const { record } = signedPassport();
    const calls: unknown[][] = [];
    const result = await attestStoredPassport(
      null,
      { status: "approved", metadata: { passport: { record } } },
      { createAttestation: fakeSigner(calls) }
    );
    expect(result.signed).toBe(false);
    expect(calls).toEqual([]);
  });
});

describe("verify route stays unsigned", () => {
  it("returns certificationScanDecision and does not call createAttestation", () => {
    const root = path.join(import.meta.dirname, "..");
    const route = readFileSync(
      path.join(root, "src/app/api/v1/verify/route.ts"),
      "utf8"
    );
    const signer = readFileSync(
      path.join(import.meta.dirname, "passport-attestation.ts"),
      "utf8"
    );
    expect(route).toContain("certificationScanDecision");
    expect(route).not.toContain("createAttestation");
    expect(route).not.toContain("attestStoredPassport");
    expect(route).not.toContain("attestationEngine");
    expect(signer).not.toContain("seal-attestation");
    expect(signer).not.toMatch(/status === ["']approved["']|cert\.status/);
    expect(signer).toContain('"verified"');
  });
});
