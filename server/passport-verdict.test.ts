import { createHash, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { mapDbToIdentity } from "../protocol/attestation/mapper";
import { signPassport } from "../protocol/passport.mjs";
import { signingBytes } from "../protocol/verifier.mjs";
import {
  callerSignalReport,
  certificationScanDecision,
  compositionHeading,
  passportVerdict,
  trustScoreReply,
} from "./passport-verdict";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";

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

function signedPassport(sealSerial?: string) {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const raw = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  const issuer =
    "did:key:z" + b58(Buffer.concat([Buffer.from([0xed, 0x01]), raw]));
  const record = signPassport({
    digitalIdentity: "urn:authichain:item:example-1",
    privateKey,
    issuer,
    ...(sealSerial ? { sealSerial } : {}),
  });
  const anchor = {
    recordHash:
      "sha256:" + createHash("sha256").update(signingBytes(record)).digest("hex"),
    chain: "polygon:137",
    txHash: "0x" + "ab".repeat(32),
    anchoredAt: "2026-01-01T00:05:00Z",
  };
  return { record, anchor };
}

describe("passportVerdict", () => {
  it("treats an active row with no passport as on record and unverified", () => {
    const verdict = passportVerdict(
      { metadata: { status: "active" } },
      { metadata: { status: "active" } }
    );
    expect(verdict.verified).toBe(false);
    expect(verdict.onRecord).toBe(true);
    expect(verdict.genuine).toBeUndefined();
    expect(verdict.productBinding).toBeUndefined();
    expect(verdict.message).toBe("No product passport is stored for this record.");
    expect(JSON.stringify(verdict)).not.toMatch(/Polygon|counterfeit|METRC|GTIN/i);
  });

  it("says when nothing is on record", () => {
    expect(passportVerdict(null, null)).toEqual({
      verified: false,
      onRecord: false,
      message: "No product is on record for this id.",
    });
  });

  it("is genuine for an anchored passport under its digital identity", () => {
    const { record, anchor } = signedPassport();
    const verdict = passportVerdict(
      { metadata: { status: "active", passport: { record, anchor } } },
      null
    );
    expect(verdict.verified).toBe(true);
    expect(verdict.verified).toBe(verdict.genuine);
    expect(verdict.genuine).toBe(true);
    expect(verdict.digitalIdentity).toBe("urn:authichain:item:example-1");
    expect(verdict.message).toBe(
      "Genuine product passport for urn:authichain:item:example-1. This is the passport for that digital identity."
    );
    expect(verdict.productBinding).toEqual({
      method: "none",
      pass: false,
      reason: "seal_commitment_missing",
      samePassport: true,
    });
    expect(record.credentialSubject.gtin).toBeUndefined();
  });

  it("a matching seal does not change verified, and a missing seal keeps the passport sentence", () => {
    const seal = "SEAL-UNIT-0001-ABCD";
    const { record, anchor } = signedPassport(seal);
    const matched = passportVerdict(
      { metadata: { passport: { record, anchor } } },
      null,
      { sealSerial: seal, nfcMatch: true }
    );
    expect(matched.verified).toBe(true);
    expect(matched.genuine).toBe(true);
    expect(matched.verified).toBe(matched.genuine);
    expect(matched.digitalIdentity).toBe("urn:authichain:item:example-1");
    expect(matched.productBinding).toEqual({
      method: "seal_serial_sha256",
      pass: true,
      reason: null,
      samePassport: true,
    });
    expect(matched.message).toBe(
      "This scan presented the seal serial committed in the signed passport for urn:authichain:item:example-1. The passport signature verified. The chain transaction was not read, so publication of the hash is not confirmed. The seal serial is not in the QR. A copy of the QR alone does not pass this check. The commitment match does not prove the issuer attached that seal to the named object."
    );
    expect(matched.message).not.toContain(seal);
    const copied = passportVerdict({ metadata: { passport: { record, anchor } } }, null);
    expect(copied.verified).toBe(true);
    expect(copied.genuine).toBe(true);
    expect(copied.digitalIdentity).toBe(matched.digitalIdentity);
    expect(copied.productBinding?.reason).toBe("seal_serial_missing");
    expect(copied.message).toBe(
      "Genuine product passport for urn:authichain:item:example-1. This is the passport for that digital identity."
    );
    const flagged = passportVerdict(
      { metadata: { passport: { record, anchor } } },
      null,
      { nfcMatch: true, visualMatch: 100 }
    );
    expect(flagged.verified).toBe(true);
    expect(flagged.genuine).toBe(true);
    expect(flagged.productBinding).toEqual({
      method: "none",
      pass: false,
      reason: "caller_flag_not_a_binding",
      samePassport: true,
    });
    expect(flagged.message).toBe(copied.message);
    expect(passportVerdict(null, null, { sealSerial: seal })).toEqual({
      verified: false,
      onRecord: false,
      message: "No product is on record for this id.",
    });
  });

  it("keeps an unanchored stored passport unverified", () => {
    const { record } = signedPassport();
    const verdict = passportVerdict(null, {
      metadata: { passport: { record } },
    });
    expect(verdict.verified).toBe(false);
    expect(verdict.genuine).toBe(false);
    expect(verdict.digitalIdentity).toBe("urn:authichain:item:example-1");
  });
});

describe("certificationScanDecision", () => {
  it("does not sign an approved certification as verified", () => {
    const reply = certificationScanDecision(
      { metadata: { status: "active" } },
      { metadata: { status: "approved" } }
    );
    expect(reply.decision).toBe("blocked");
    expect(reply.verified).toBe(false);
    expect(reply.onRecord).toBe(true);
    expect(reply.message).toBe("No product passport is stored for this record.");
    expect(JSON.stringify(reply)).not.toMatch(/signature|DSCSA|METRC|GTIN/i);
  });

  it("follows an anchored stored passport", () => {
    const { record, anchor } = signedPassport();
    const reply = certificationScanDecision(
      { metadata: { passport: { record, anchor } } },
      { metadata: { status: "approved" } }
    );
    expect(reply.decision).toBe("verified");
    expect(reply.verified).toBe(true);
    expect(reply.digitalIdentity).toBe("urn:authichain:item:example-1");
    expect(JSON.stringify(reply)).not.toMatch(/"signature"/);
  });
});

describe("mapDbToIdentity", () => {
  it("does not label a pharma category as a DSCSA profile", () => {
    const identity = mapDbToIdentity(
      { category: "pharma", metadata: {} },
      { serial_number: "lot-1" }
    );
    expect(identity.profile).toBe("generic-provenance");
    expect(JSON.stringify(identity)).not.toMatch(/dscsa/i);
    expect(identity.gtin14).toBeUndefined();
  });

  it("does not label a medical category as a device profile", () => {
    const identity = mapDbToIdentity(
      { category: "medical", metadata: {} },
      { serial_number: "lot-1" }
    );
    expect(identity.profile).toBe("generic-provenance");
    expect(identity.udiDi).toBeUndefined();
    expect(JSON.stringify(identity)).not.toMatch(/medical-device-udi|dscsa/i);
  });
});

describe("compositionHeading", () => {
  it("names a materials table a passport only when the scan is genuine", () => {
    expect(compositionHeading(false)).toBe("Recorded composition");
    expect(compositionHeading(true)).toBe("Genuine product passport");
  });
});

describe("callerSignalReport", () => {
  it("records an omitted flag as false", () => {
    expect(callerSignalReport({})).toEqual({
      source: "caller_supplied",
      qrDecodePass: false,
      blockchainCertExists: false,
      nfcMatch: false,
      visualMatch: null,
      geoFenceOk: false,
    });
    expect(callerSignalReport(null)).toEqual(callerSignalReport({}));
  });

  it("keeps a flag the caller set", () => {
    const report = callerSignalReport({
      qrDecodePass: true,
      blockchainCertExists: false,
      nfcMatch: true,
      visualMatch: 140,
      geoFenceOk: true,
    });
    expect(report.qrDecodePass).toBe(true);
    expect(report.blockchainCertExists).toBe(false);
    expect(report.nfcMatch).toBe(true);
    expect(report.visualMatch).toBe(100);
    expect(report.geoFenceOk).toBe(true);
    expect(JSON.stringify(report)).not.toMatch(/authentic|genuine|verified/i);
  });
});

describe("trustScoreReply", () => {
  it("does not treat a full set of caller flags as a passport", () => {
    const signals = callerSignalReport({
      qrDecodePass: true,
      blockchainCertExists: true,
      nfcMatch: true,
      visualMatch: 100,
      geoFenceOk: true,
    });
    const reply = trustScoreReply(null, signals);
    expect(reply.verified).toBe(false);
    expect(reply.onRecord).toBe(false);
    expect(reply.message).toMatch(/product id/);
    expect(reply.callerSignals).toEqual(signals);
    expect(JSON.stringify(reply)).not.toMatch(/authentic/i);
  });

  it("keeps verified on the stored passport when every flag is true", () => {
    const scan = passportVerdict({ metadata: { status: "active" } }, null);
    const reply = trustScoreReply(
      scan,
      callerSignalReport({
        qrDecodePass: true,
        blockchainCertExists: true,
        nfcMatch: true,
        visualMatch: 100,
        geoFenceOk: true,
      })
    );
    expect(reply.verified).toBe(false);
    expect(reply.genuine).toBeUndefined();
    expect(reply.onRecord).toBe(true);
    expect(reply.callerSignals.qrDecodePass).toBe(true);
    expect(reply.callerSignals.source).toBe("caller_supplied");
  });
});
