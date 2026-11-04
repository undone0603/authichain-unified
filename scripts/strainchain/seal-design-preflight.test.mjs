import assert from "node:assert/strict";
import test from "node:test";
import {
  assessSealDesignPreflight,
  REQUIRED_DESIGN_GATES,
} from "./seal-design-preflight.mjs";

const hash = n => n.toString(16).padStart(64, "0");
function validSubmission() {
  return {
    design_id: "seal-lock-pouch-example",
    revision: "r1",
    geometry: {
      irreversible_barrier_present: "yes",
      barrier_before_reclosure: "yes",
      all_access_paths_protected: "yes",
    },
    criteria_sha256: hash(100),
    sample_plan_sha256: hash(101),
    challenge: {
      access_without_barrier_damage: "no",
      first_opening_sequence_recorded: "yes",
      all_access_routes_attempted: "yes",
      number_of_units: 4,
    },
    gates: Object.fromEntries(REQUIRED_DESIGN_GATES.map((name, index) => [
      name,
      { result: "pass", artifact_sha256: hash(200 + index),
        recorded_by: "issuer_claim" },
    ])),
  };
}
const evaluate = change => assessSealDesignPreflight({
  ...validSubmission(), ...change,
});

test("complete manufacturer packet is review-ready, never physically certified", () => {
  const r = evaluate();
  assert.equal(r.decision, "READY_FOR_INDEPENDENT_REVIEW_ONLY");
  assert.equal(r.release_gate, "HOLD");
  assert.equal(r.certified, false);
  assert.equal(r.legal_compliance, "NOT_ASSESSED");
  assert.equal(r.unit_authenticity, "NOT_ASSESSED");
});

test("missing irreversible first-opening barrier is a blocking report", () => {
  const r = evaluate({ geometry: {
    ...validSubmission().geometry,
    irreversible_barrier_present: "no",
  }});
  assert.equal(r.decision, "BLOCK_REPORTED_BYPASS_OR_FAILED_GATE");
  assert.ok(r.reasons.includes("NO_IRREVERSIBLE_FIRST_OPENING_BARRIER_REPORTED"));
});

test("zipper accessible before barrier blocks design", () => {
  const r = evaluate({ geometry: {
    ...validSubmission().geometry, barrier_before_reclosure: "no",
  }});
  assert.ok(r.reasons.includes("REUSABLE_CLOSURE_PRECEDES_BARRIER"));
  assert.equal(r.release_gate, "HOLD");
});

test("unprotected side seam route blocks a nominally welded bag", () => {
  const r = evaluate({ geometry: {
    ...validSubmission().geometry, all_access_paths_protected: "no",
  }});
  assert.ok(r.reasons.includes("ACCESS_ROUTE_WITHOUT_BARRIER_REPORTED"));
});

test("silent entry during challenge is an explicit review failure", () => {
  const r = evaluate({ challenge: {
    ...validSubmission().challenge, access_without_barrier_damage: "yes",
  }});
  assert.ok(r.reasons.includes("SILENT_ACCESS_REPORTED_IN_CHALLENGE"));
  assert.equal(r.decision, "BLOCK_REPORTED_BYPASS_OR_FAILED_GATE");
});

test("missing sample, partial route challenge, or unknown geometry cannot become ready", () => {
  const base = validSubmission();
  const cases = [
    { challenge: { ...base.challenge, number_of_units: 0 } },
    { challenge: { ...base.challenge, all_access_routes_attempted: "no" } },
    { challenge: { ...base.challenge, first_opening_sequence_recorded: "unknown" } },
    { geometry: { ...base.geometry, all_access_paths_protected: "unknown" } },
  ];
  for (const change of cases) {
    const r = evaluate(change);
    assert.equal(r.decision, "BLOCK_INCOMPLETE_DESIGN_EVIDENCE");
    assert.equal(r.certified, false);
  }
});

test("failing strength test or process controls blocks review", () => {
  const base = validSubmission();
  for (const name of ["seal_strength", "process_controls"]) {
    const gates = { ...base.gates,
      [name]: { ...base.gates[name], result: "fail" } };
    assert.equal(evaluate({ gates }).decision, "BLOCK_REPORTED_BYPASS_OR_FAILED_GATE");
  }
});

test("seal leak test may be not applicable only with a documented rationale hash", () => {
  const base = validSubmission();
  const gates = { ...base.gates,
    leak_method_if_applicable: { result: "not_applicable",
      artifact_sha256: hash(600), recorded_by: "laboratory_claim" } };
  assert.equal(evaluate({ gates }).decision, "READY_FOR_INDEPENDENT_REVIEW_ONLY");
  gates.leak_method_if_applicable = {
    ...gates.leak_method_if_applicable, artifact_sha256: null,
  };
  assert.throws(() => evaluate({ gates }), /invalid_leak_method_if_applicable_sha256/);
  const forbidden = { ...base.gates,
    seal_strength: { result: "not_applicable", artifact_sha256: hash(7),
      recorded_by: "issuer_claim" } };
  assert.throws(() => evaluate({ gates: forbidden }), /unsupported_na_seal_strength/);
});

test("unknown or missing gate result cannot be treated as a pass", () => {
  const base = validSubmission();
  const gates = { ...base.gates,
    process_controls: { result: "unknown", artifact_sha256: null,
      recorded_by: "issuer_claim" } };
  assert.equal(evaluate({ gates }).decision, "BLOCK_INCOMPLETE_DESIGN_EVIDENCE");
  delete gates.process_controls;
  assert.throws(() => evaluate({ gates }), /invalid_gate_set_shape/);
});

test("a self-asserted reviewer role is never independent attestation", () => {
  const base = validSubmission();
  const gates = Object.fromEntries(Object.entries(base.gates).map(([name, record]) =>
    [name, { ...record, recorded_by: "independent_reviewer_claim" }]
  ));
  const r = evaluate({ gates });
  assert.equal(r.certified, false);
  assert.equal(r.release_gate, "HOLD");
  assert.equal(r.reviewer_action, "INDEPENDENT_REVIEW_REQUIRED");
});

test("missing or malformed hashes and unsupported reviewer values are rejected", () => {
  const base = validSubmission();
  assert.throws(() => evaluate({ criteria_sha256: "unproven" }), /invalid_criteria_sha256/);
  assert.throws(() => evaluate({ sample_plan_sha256: "" }), /invalid_sample_plan_sha256/);
  const gates = { ...base.gates, barrier_design:
    { ...base.gates.barrier_design, artifact_sha256: "garbage" } };
  assert.throws(() => evaluate({ gates }), /invalid_barrier_design_sha256/);
  gates.barrier_design = { ...base.gates.barrier_design, recorded_by: "approved_by_ai" };
  assert.throws(() => evaluate({ gates }), /invalid_reviewer_role_barrier_design/);
});

test("unbounded samples and unexpected private identifiers fail closed", () => {
  assert.throws(() => evaluate({
    challenge: { ...validSubmission().challenge, number_of_units: -1 },
  }), /invalid_sample_count/);
  assert.throws(() => evaluate({
    challenge: { ...validSubmission().challenge, number_of_units: 1.5 },
  }), /invalid_sample_count/);
  assert.throws(() => evaluate({ manufacturer: "private-case-name" }), /invalid_design_shape/);
  assert.throws(() => evaluate({
    gates: { ...validSubmission().gates, owner_contact: "email" },
  }), /invalid_gate_set_shape/);
});

test("metadata never allows a seal to be released, regardless of gate values", () => {
  const base = validSubmission();
  for (const count of [1, 5, 500]) {
    const r = evaluate({ challenge: { ...base.challenge, number_of_units: count } });
    assert.equal(r.release_gate, "HOLD");
    assert.equal(r.fraud_determination, "NOT_ASSESSED");
  }
});
