import { test } from "node:test";
import assert from "node:assert/strict";
import {
  collectEstateEvidence,
  evaluateEstateEvidence,
} from "./estate-gate.mjs";
import { evaluateGate } from "./launch-gates.mjs";

const good = [
  { name: "a", disposition: "archive", archive: "docs/x.js", archive_exists: true },
  { name: "b", disposition: "retire", archive: null, archive_exists: null },
  { name: "c", disposition: "unrelated", archive: null, archive_exists: null },
];

test("all entries decided with existing archives passes", () => {
  assert.equal(evaluateEstateEvidence({ entries: good }).status, "pass");
});

test("an 'unknown' disposition FAILS and names the Worker", () => {
  const r = evaluateEstateEvidence({
    entries: [...good, { name: "storepilot", disposition: "unknown" }],
  });
  assert.equal(r.status, "fail");
  assert.match(r.reasons.join(" "), /storepilot: disposition is 'unknown'/);
});

test("invalid disposition and missing archive FAIL", () => {
  const bad = evaluateEstateEvidence({
    entries: [
      { name: "x", disposition: "keep" },
      { name: "y", disposition: "archive", archive: "docs/gone.js", archive_exists: false },
    ],
  });
  assert.equal(bad.status, "fail");
  assert.match(bad.reasons.join(" "), /invalid disposition keep/);
  assert.match(bad.reasons.join(" "), /archive file docs\/gone\.js is missing/);
});

test("missing or empty inventory FAILS", () => {
  assert.equal(evaluateEstateEvidence(undefined).status, "fail");
  assert.equal(evaluateEstateEvidence({ entries: [] }).status, "fail");
  assert.equal(evaluateEstateEvidence({ entries: [{ disposition: "retire" }] }).status, "fail");
});

test("collector reads the shipped config/estate.json", () => {
  const evidence = collectEstateEvidence();
  assert.ok(evidence.entries.length > 0);
  for (const e of evidence.entries) {
    assert.equal(typeof e.name, "string");
    if (e.archive) assert.equal(typeof e.archive_exists, "boolean");
  }
});

test("launch gate dispatch for estate_inventory", () => {
  const gate = { id: "estate", type: "estate_inventory" };
  assert.equal(evaluateGate(gate, { entries: good }).status, "pass");
  assert.equal(evaluateGate(gate, undefined).status, "fail");
  assert.equal(evaluateGate(gate, { error: "x" }).status, "fail");
});
