import test from "node:test";
import assert from "node:assert/strict";
import { generateKeyPairSync, sign as edSign } from "node:crypto";
import { passportToRecordPayload } from "./adapter.mjs";
import { signingBytes, verifyRecord } from "../verifier.mjs";

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58Encode(buf) {
  let num = BigInt("0x" + (buf.toString("hex") || "0"));
  let out = "";
  while (num > 0n) { out = B58[Number(num % 58n)] + out; num /= 58n; }
  for (const b of buf) { if (b !== 0) break; out = "1" + out; }
  return out;
}
function didFor(publicKey) {
  const raw = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  return "did:key:z" + base58Encode(Buffer.concat([Buffer.from([0xed, 0x01]), raw]));
}
const passport = {
  schema: "authichain.high-value-asset-passport/v0.1",
  assetClass: "precious_metal_bar", issuer: "Valcambi SA",
  identity: { scheme: "issuer_serial", objectId: "urn:authichain:issuer:valcambi:serial:REDACTED-PILOT-SERIAL", issuerNamespace: "urn:authichain:issuer:valcambi", serial: "REDACTED-PILOT-SERIAL" },
  claims: [{ id: "claim-metal", field: "metal", value: "platinum", issuer: "Valcambi SA", evidenceIds: ["assay"] }],
  evidence: [{ id: "assay", type: "assay_certificate", issuer: "Valcambi SA", capturedAt: "2026-10-01T00:00:00Z" }],
  inspections: [], lifecycle: [], status: "unknown",
};

test("passportToRecordPayload", async () => {
  await test("maps a passport into the existing VC/provenance record contract", () => {
    const { publicKey } = generateKeyPairSync("ed25519");
    const record = passportToRecordPayload(passport, { issuerDid: didFor(publicKey), validFrom: "2026-10-01T00:00:00Z" });
    assert.ok(record.type.includes("ProvenanceRecord"));
    assert.ok(record.type.includes("HighValueAssetPassport"));
    assert.equal(record.credentialSubject.id, passport.identity.objectId);
    assert.deepEqual(record.credentialSubject.claims[0].evidenceIds, ["assay"]);
    assert.equal(record.proof.proofValue, "");
  });
  await test("maps GS1 identity to a Digital Link subject id", () => {
    const { publicKey } = generateKeyPairSync("ed25519");
    const record = passportToRecordPayload({ ...passport, identity: { scheme: "gs1", objectId: "ignored", gtin: "09506000134352", serial: "SERIAL 123" } }, { issuerDid: didFor(publicKey), validFrom: "2026-10-01T00:00:00Z" });
    assert.equal(record.credentialSubject.id, "https://id.gs1.org/01/09506000134352/21/SERIAL%20123");
  });
  await test("round-trips through the existing verifier after signing", () => {
    const { publicKey, privateKey } = generateKeyPairSync("ed25519");
    const record = passportToRecordPayload(passport, { issuerDid: didFor(publicKey), validFrom: "2026-01-01T00:00:00Z" });
    record.proof.proofValue = "z" + base58Encode(edSign(null, signingBytes(record), privateKey));
    const result = verifyRecord(record, null, { now: "2026-10-01T00:00:00Z" });
    assert.equal(result.verdict, "valid-unanchored");
    assert.equal(result.checks.signature, true);
  });
  await test("does not accept a non-did:key issuer", () => {
    assert.throws(() => passportToRecordPayload(passport, { issuerDid: "Valcambi SA", validFrom: "2026-10-01T00:00:00Z" }), /did:key/);
  });
});