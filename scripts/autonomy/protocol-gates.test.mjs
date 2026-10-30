import { test } from "node:test";
import assert from "node:assert/strict";
import {
  REQUIRED_ROUNDTRIP_CHECKS,
  evaluateConformanceEvidence,
  evaluateRoundtripEvidence,
  runRoundtrip,
} from "./protocol-gates.mjs";
import { evaluateGate } from "./launch-gates.mjs";
import * as realVerifier from "../../protocol/verifier.mjs";

const now = new Date("2026-10-21T12:00:00Z");

test("the shipped verifier passes every required round trip check", () => {
  const evidence = runRoundtrip({ verifier: realVerifier, now });
  const bad = evidence.checks.filter((c) => !c.ok);
  assert.deepEqual(bad, [], JSON.stringify(bad));
  for (const name of REQUIRED_ROUNDTRIP_CHECKS)
    assert.ok(evidence.checks.some((c) => c.name === name), `missing ${name}`);
  assert.equal(evaluateRoundtripEvidence(evidence).status, "pass");
});

test("a verifier that accepts everything FAILS the gate", () => {
  const lax = { verifyRecord: () => ({ verdict: "valid-unanchored", reasons: [] }) };
  const r = evaluateRoundtripEvidence(runRoundtrip({ verifier: lax, now }));
  assert.equal(r.status, "fail");
  const text = r.reasons.join(" ");
  assert.match(text, /tampered-subject-rejected/);
  assert.match(text, /wrong-issuer-key-rejected/);
  assert.match(text, /anchor-commitment/);
});

test("a verifier that rejects everything FAILS the gate", () => {
  const strict = { verifyRecord: () => ({ verdict: "invalid", reasons: ["nope"] }) };
  const r = evaluateRoundtripEvidence(runRoundtrip({ verifier: strict, now }));
  assert.equal(r.status, "fail");
  assert.match(r.reasons.join(" "), /issue-and-verify/);
});

test("a throwing or missing verifier FAILS, never throws", () => {
  const boom = {
    verifyRecord: () => {
      throw new Error("boom");
    },
  };
  assert.equal(evaluateRoundtripEvidence(runRoundtrip({ verifier: boom, now })).status, "fail");
  assert.equal(evaluateRoundtripEvidence(runRoundtrip({ verifier: {}, now })).status, "fail");
});

test("missing example files FAIL the published-example checks", () => {
  const r = evaluateRoundtripEvidence(
    runRoundtrip({ verifier: realVerifier, now, examplesDir: "/nonexistent" })
  );
  assert.equal(r.status, "fail");
  assert.match(r.reasons.join(" "), /published-example-verifies/);
});

test("round trip evaluator fails on missing, empty or partial evidence", () => {
  assert.equal(evaluateRoundtripEvidence(undefined).status, "fail");
  assert.equal(evaluateRoundtripEvidence({ checks: [] }).status, "fail");
  const partial = { checks: [{ name: "issue-and-verify", ok: true }] };
  const r = evaluateRoundtripEvidence(partial);
  assert.equal(r.status, "fail");
  assert.match(r.reasons.join(" "), /check missing/);
});

test("conformance evaluator: exit 0 with output passes", () => {
  const r = evaluateConformanceEvidence({
    exit_code: 0,
    timed_out: false,
    stdout_tail: "42 passed",
  });
  assert.equal(r.status, "pass");
});

test("conformance evaluator: non-zero, timeout, silent and spawn errors FAIL", () => {
  const f = (e) => evaluateConformanceEvidence(e).status;
  assert.equal(f({ exit_code: 1, stdout_tail: "x" }), "fail");
  assert.equal(f({ exit_code: null, timed_out: true, stdout_tail: "x" }), "fail");
  assert.equal(f({ exit_code: 0, stdout_tail: "  \n" }), "fail");
  assert.equal(f({ exit_code: null, spawn_error: "ENOENT", stdout_tail: "" }), "fail");
  assert.equal(f(undefined), "fail");
});

test("launch gate dispatch for the new gate types", () => {
  const evidence = runRoundtrip({ verifier: realVerifier, now });
  assert.equal(
    evaluateGate({ id: "rt", type: "verify_roundtrip" }, evidence, now).status,
    "pass"
  );
  assert.equal(evaluateGate({ id: "rt", type: "verify_roundtrip" }, undefined, now).status, "fail");
  assert.equal(evaluateGate({ id: "rt", type: "verify_roundtrip" }, { error: "x" }, now).status, "fail");
  assert.equal(
    evaluateGate(
      { id: "pc", type: "protocol_conformance" },
      { exit_code: 0, stdout_tail: "ok" },
      now
    ).status,
    "pass"
  );
  assert.equal(
    evaluateGate({ id: "pc", type: "protocol_conformance" }, { exit_code: 2, stdout_tail: "x" }, now).status,
    "fail"
  );
});
