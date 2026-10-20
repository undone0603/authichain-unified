import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { createHash, generateKeyPairSync } from "node:crypto";
import { productPassportMetadata, signPassport } from "../../../protocol/passport.mjs";
import { signingBytes } from "../../../protocol/verifier.mjs";
import {
  assessChainRead,
  expectedRecordHash,
  readStoredPassport,
  verifySubmitted,
} from "./protocol-verify.mjs";

const fixtures = join(
  dirname(fileURLToPath(import.meta.url)),
  "../../../protocol/conformance/fixtures",
);

function load(name) {
  return JSON.parse(readFileSync(join(fixtures, name), "utf8"));
}

test("a signed record with no anchor is valid-unanchored", () => {
  const fx = load("valid-unanchored.json");
  const out = verifySubmitted(fx.record, null);
  assert.equal(out.verdict, "valid-unanchored");
  assert.equal(out.decision, "valid-unanchored");
  assert.equal(out.anchored, false);
  assert.equal(out.anchorTransactionQueried, false);
  assert.equal(out.checks.signature, true);
});

test("a signed record and a mainnet-shaped anchor is verified, without querying the tx", () => {
  const fx = load("valid-anchored-polygon.json");
  const out = verifySubmitted(fx.record, fx.anchor);
  assert.equal(out.verdict, "verified");
  assert.equal(out.decision, out.verdict);
  assert.equal(out.anchored, true);
  assert.equal(out.anchorTransactionQueried, false);
  assert.equal(Object.hasOwn(out, "genuine"), false);
  assert.equal(Object.hasOwn(out, "productBinding"), false);
  assert.equal(Object.hasOwn(out, "productSentence"), false);
});

const B58 = "123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz";
function base58Encode(buf) {
  let num = BigInt("0x" + (buf.toString("hex") || "0"));
  let out = "";
  while (num > 0n) {
    out = B58[Number(num % 58n)] + out;
    num /= 58n;
  }
  for (const b of buf) {
    if (b !== 0) break;
    out = "1" + out;
  }
  return out;
}

function signedPassport() {
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const raw = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  const issuer = "did:key:z" + base58Encode(Buffer.concat([Buffer.from([0xed, 0x01]), raw]));
  const record = signPassport({
    digitalIdentity: "urn:authichain:item:example-1",
    privateKey,
    issuer,
  });
  const anchor = {
    recordHash: "sha256:" + createHash("sha256").update(signingBytes(record)).digest("hex"),
    chain: "polygon:137",
    txHash: "0x" + "ab".repeat(32),
    anchoredAt: "2026-01-01T00:05:00Z",
  };
  return { record, anchor };
}

test("a stored product passport is genuine only when the scan passes", () => {
  const { record, anchor } = signedPassport();
  assert.equal(record.credentialSubject.gtin, undefined);
  const stored = readStoredPassport(productPassportMetadata({ passport: { record, anchor } }));
  assert.equal(stored.record, record);
  assert.equal(stored.anchor, anchor);
  const proved = verifySubmitted(stored.record, stored.anchor);
  assert.equal(proved.genuine, true);
  assert.equal(proved.digitalIdentity, "urn:authichain:item:example-1");
  assert.equal(proved.verdict, "verified");
  const open = verifySubmitted(record, null);
  assert.equal(open.genuine, false);
  assert.equal(open.verdict, "valid-unanchored");
  assert.equal(readStoredPassport({ status: "active" }), null);
  assert.equal(readStoredPassport(null), null);
  assert.equal(proved.anchored, true);
  assert.equal(proved.productBinding.method, "none");
  assert.equal(proved.productBinding.pass, false);
  assert.equal(proved.productBinding.reason, "seal_commitment_missing");
  assert.equal(proved.productBinding.samePassport, true);
  assert.equal(Object.hasOwn(proved, "productSentence"), false);
});

test("a seal match does not change anchored or genuine", () => {
  const seal = "SEAL-UNIT-0001-ABCD";
  const { publicKey, privateKey } = generateKeyPairSync("ed25519");
  const raw = publicKey.export({ format: "der", type: "spki" }).subarray(-32);
  const issuer = "did:key:z" + base58Encode(Buffer.concat([Buffer.from([0xed, 0x01]), raw]));
  const record = signPassport({
    digitalIdentity: "urn:authichain:item:example-1",
    privateKey,
    issuer,
    sealSerial: seal,
  });
  const anchor = {
    recordHash: "sha256:" + createHash("sha256").update(signingBytes(record)).digest("hex"),
    chain: "polygon:137",
    txHash: "0x" + "ab".repeat(32),
    anchoredAt: "2026-01-01T00:05:00Z",
  };
  const matched = verifySubmitted(record, anchor, { sealSerial: seal });
  assert.equal(matched.genuine, true);
  assert.equal(matched.anchored, true);
  assert.equal(matched.anchorTransactionQueried, false);
  assert.equal(matched.productBinding.pass, true);
  assert.equal(matched.productBinding.method, "seal_serial_sha256");
  assert.equal(matched.productBinding.samePassport, true);
  assert.equal(matched.digitalIdentity, "urn:authichain:item:example-1");
  assert.equal(typeof matched.productSentence, "string");
  assert.equal(matched.productSentence.includes(seal), false);
  const copied = verifySubmitted(record, anchor, null);
  assert.equal(copied.genuine, true);
  assert.equal(copied.anchored, true);
  assert.equal(copied.digitalIdentity, matched.digitalIdentity);
  assert.equal(copied.productBinding.pass, false);
  assert.equal(copied.productBinding.reason, "seal_serial_missing");
  assert.equal(Object.hasOwn(copied, "productSentence"), false);
  const flagged = verifySubmitted(record, anchor, { nfcMatch: true });
  assert.equal(flagged.genuine, true);
  assert.equal(flagged.productBinding.pass, false);
  assert.equal(flagged.productBinding.reason, "caller_flag_not_a_binding");
});

test("a tampered subject is invalid", () => {
  const fx = load("sig-tampered-subject.json");
  const out = verifySubmitted(fx.record, null);
  assert.equal(out.verdict, "invalid");
  assert.equal(out.decision, "invalid");
  assert.ok(out.reasons.includes("signature_invalid"));
});

test("an id with no record is not a verdict", () => {
  assert.equal(verifySubmitted(null, null), null);
  assert.equal(verifySubmitted("AC-DEADBEEF", null), null);
});

test("the chain read is separate from the verdict", () => {
  const fx = load("valid-anchored-polygon.json");
  const hash = expectedRecordHash(fx.record);
  const present = assessChainRead({
    tx: { input: "0x" + hash },
    receipt: { status: "0x1", blockNumber: "0x10" },
    recordHash: hash,
  });
  assert.equal(present.onChain, true);
  assert.equal(present.status, "tx_contains_record_hash");

  const missing = assessChainRead({
    tx: null,
    receipt: null,
    recordHash: hash,
  });
  assert.equal(missing.queried, true);
  assert.equal(missing.onChain, false);
  assert.equal(missing.status, "tx_missing");

  const other = assessChainRead({
    tx: { input: "0x" + "ab".repeat(32) },
    receipt: { status: "0x1", blockNumber: "0x11" },
    recordHash: hash,
  });
  assert.equal(other.onChain, false);
  assert.equal(other.status, "hash_not_in_tx");
});
