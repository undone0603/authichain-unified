import assert from "node:assert/strict";
import test from "node:test";
import { assessPackageSeal, SEAL_REVIEW_STATES } from "./seal-evidence.mjs";

const hash = x => x.toString(16).padStart(64, "0");
const ref = (n = 1, opts = {}) => ({
  sha256: hash(n),
  phase: "unknown",
  role: "interior_mouth",
  custody: "observer_statement",
  ...opts,
});
const allUnknown = () => ({
  mouth_open: "unknown",
  tear_feature_intact: "unknown",
  interior_access_reported_without_tearing: "unknown",
  continuous_first_opening_video: "unknown",
  independent_witness_present: "unknown",
  first_opening_barrier_visible: "unknown",
});
const make = (observations = {}, evidence = [ref()]) => ({
  case_id: "case-seal-001",
  evidence,
  observations: { ...allUnknown(), ...observations },
});

test("image 2 observation: mouth open + intact tear feature is flagged", () => {
  const result = assessPackageSeal(make({
    mouth_open: "yes",
    tear_feature_intact: "yes",
  }));
  assert.equal(result.state, SEAL_REVIEW_STATES.OPEN_MOUTH_TEAR_FEATURE_INTACT);
  assert.ok(result.flags.includes("OPEN_MOUTH_WITH_TEAR_FEATURE_INTACT"));
  assert.equal(result.release_gate, "HOLD");
  assert.ok(result.limitations.includes("No counterfeit conclusion"));
});

test("reported bypass with no contemporaneous witness is NOT verified", () => {
  const result = assessPackageSeal(make({
    mouth_open: "yes",
    tear_feature_intact: "yes",
    interior_access_reported_without_tearing: "yes",
  }));
  assert.equal(result.state, SEAL_REVIEW_STATES.BYPASS_SUSPECTED);
  assert.ok(!result.flags.includes("INDEPENDENT_REVIEW_REQUIRED"));
});

test("claims of witnesses without authenticated opening video stay suspected", () => {
  const result = assessPackageSeal(make({
    mouth_open: "yes",
    tear_feature_intact: "yes",
    interior_access_reported_without_tearing: "yes",
    continuous_first_opening_video: "yes",
    independent_witness_present: "yes",
  }));
  assert.equal(result.state, SEAL_REVIEW_STATES.BYPASS_SUSPECTED);
});

test("qualified first-opening witness evidence still requires human review", () => {
  const result = assessPackageSeal(make({
    mouth_open: "yes",
    tear_feature_intact: "yes",
    interior_access_reported_without_tearing: "yes",
    continuous_first_opening_video: "yes",
    independent_witness_present: "yes",
  }, [ref(2, {
    role: "first_opening_video",
    phase: "as_received_before_first_open",
    custody: "independent_witness",
  })]));
  assert.equal(result.state, SEAL_REVIEW_STATES.BYPASS_WITNESSED_REVIEW_REQUIRED);
  assert.equal(result.release_gate, "HOLD");
});

test("visible weld can be recorded but not called qualified", () => {
  const result = assessPackageSeal(make({
    first_opening_barrier_visible: "yes",
  }));
  assert.equal(result.state, SEAL_REVIEW_STATES.FIRST_OPENING_BARRIER_OBSERVED);
  assert.equal(result.release_gate, "HOLD");
  assert.ok(result.flags.includes("BARRIER_VISUALLY_OBSERVED_NOT_QUALIFIED"));
});

test("empty evidence cannot issue any physical claim", () => {
  const result = assessPackageSeal(make({
    tear_feature_intact: "yes",
    mouth_open: "yes",
  }, []));
  assert.equal(result.state, SEAL_REVIEW_STATES.NOT_ASSESSED);
});

test("a zipper and tear feature alone do not qualify as a seal", () => {
  const result = assessPackageSeal(make({ tear_feature_intact: "yes" }));
  assert.equal(result.state, SEAL_REVIEW_STATES.INDETERMINATE);
  assert.equal(result.release_gate, "HOLD");
});

test("private image bytes and external links cannot be embedded", () => {
  assert.throws(() => assessPackageSeal(make({}, [{ ...ref(), imageData: "secret" }])), /unexpected_evidence_field/);
  assert.throws(() => assessPackageSeal(make({}, [{ ...ref(), publicUrl: "https://example.org" }])), /unexpected_evidence_field/);
});

test("rejects duplicate/malformed hashes and unsupported provenance", () => {
  assert.throws(() => assessPackageSeal(make({}, [ref(), ref()])), /duplicate_image_hash/);
  assert.throws(() => assessPackageSeal(make({}, [{ ...ref(), sha256: "not-sha" }])), /evidence_sha256_required/);
  assert.throws(() => assessPackageSeal(make({}, [{ ...ref(), custody: "verified_by_ai" }])), /invalid_evidence_provenance/);
});

test("rejects uncontrolled status categories", () => {
  assert.throws(() => assessPackageSeal(make({ mouth_open: "maybe" })), /invalid_observation_mouth_open/);
  assert.throws(() => assessPackageSeal(make({ verified_counterfeit: "yes" })), /invalid_observations/);
  assert.throws(() => assessPackageSeal({ ...make(), case_id: "??" }), /invalid_case_id/);
});

test("classification deterministic and never asserts release", () => {
  const x = make({
    mouth_open: "yes",
    tear_feature_intact: "yes",
    interior_access_reported_without_tearing: "yes",
  });
  const a = assessPackageSeal(x), b = assessPackageSeal(x);
  assert.deepEqual(a, b);
  assert.equal(a.release_gate, "HOLD");
});
