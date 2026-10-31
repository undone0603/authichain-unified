import test from "node:test";
import assert from "node:assert/strict";
import { publishedRecord } from "./published-record.mjs";
import { verifySubmitted } from "./protocol-verify.mjs";

test("the demonstration id resolves to the mined record", () => {
  const hit = publishedRecord("polygon-anchor-1");
  assert.equal(hit.source, "published_example");
  const out = verifySubmitted(hit.record, hit.anchor);
  assert.equal(out.verdict, "verified");
  assert.equal(out.checks.signature, true);
  assert.equal(out.checks.anchorHash, true);
});

test("the public URL resolves to the same record", () => {
  const hit = publishedRecord("https://authichain.com/protocol/examples/polygon-anchor-1");
  assert.equal(hit.record.credentialSubject.name.includes("Not a product"), true);
});

test("an unknown id is not the demonstration", () => {
  assert.equal(publishedRecord("AC-DEADBEEF"), null);
  assert.equal(publishedRecord("AC-7C2A91E4"), null);
});
