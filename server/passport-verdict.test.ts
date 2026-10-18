import { createHash, generateKeyPairSync } from "node:crypto";
import { describe, expect, it } from "vitest";
import { signPassport } from "../protocol/passport.mjs";
import { signingBytes } from "../protocol/verifier.mjs";
import {
  callerSignalReport,
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

function signedPassport() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const raw = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  const issuer =
    "did:key:z" + b58(Buffer.concat([Buffer.from([0xed, 0x01]), raw]));
  const record = signPassport({
    digitalIdentity: "urn:authichain:item:example-1",
    privateKey,
    issuer,
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
    expect(verdict.genuine).toBe(true);
    expect(verdict.digitalIdentity).toBe("urn:authichain:item:example-1");
    expect(record.credentialSubject.gtin).toBeUndefined();
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
