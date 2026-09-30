import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { assessChainRead, expectedRecordHash, verifySubmitted } from "./protocol-verify.mjs";

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
