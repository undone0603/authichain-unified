/**
 * StrainChain SealLock v0.2: read-only MANUFACTURER DESIGN preflight.
 *
 * This accepts SHA-256 references and self-reported gate results, but no
 * evidence bytes, product identifiers, manufacturer identities, network
 * locations, secrets or credentials. A "ready" result is only a packet
 * completeness assessment, NEVER a seal certificate or unit release.
 * Qualified third-party signoff is intentionally out of scope.
 */
export const REQUIRED_DESIGN_GATES = Object.freeze([
  "barrier_design",
  "process_controls",
  "bypass_challenge",
  "seal_strength",
  "leak_method_if_applicable",
  "unit_trace",
  "retail_handoff",
]);
const PASS = new Set(["pass", "fail", "unknown", "not_applicable"]);
const YES_NO_UNKNOWN = new Set(["yes", "no", "unknown"]);
const SHA = /^[a-f0-9]{64}$/;
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/;
const ROLES = new Set(["issuer_claim", "laboratory_claim", "independent_reviewer_claim"]);
const EXACT_RECORD_KEYS = ["result", "artifact_sha256", "recorded_by"];
const EXACT_GEOMETRY_KEYS = [
  "irreversible_barrier_present",
  "barrier_before_reclosure",
  "all_access_paths_protected",
];
const FAIL_STATE = "BLOCK_REPORTED_BYPASS_OR_FAILED_GATE";
const INCOMPLETE = "BLOCK_INCOMPLETE_DESIGN_EVIDENCE";
const READY = "READY_FOR_INDEPENDENT_REVIEW_ONLY";

function exactKeys(value, keys, name) {
  if (!value || typeof value !== "object" || Array.isArray(value) ||
      Object.keys(value).length !== keys.length ||
      Object.keys(value).some(key => !keys.includes(key))) {
    throw new Error("invalid_" + name + "_shape");
  }
}

function assertHash(value, name) {
  if (typeof value !== "string" || !SHA.test(value)) {
    throw new Error("invalid_" + name + "_sha256");
  }
}

export function assessSealDesignPreflight(input) {
  exactKeys(input, [
    "design_id", "revision", "geometry", "criteria_sha256",
    "sample_plan_sha256", "challenge", "gates",
  ], "design");
  if (!SAFE_ID.test(input.design_id) || !SAFE_ID.test(input.revision)) {
    throw new Error("invalid_design_identity");
  }
  exactKeys(input.geometry, EXACT_GEOMETRY_KEYS, "geometry");
  for (const k of EXACT_GEOMETRY_KEYS) {
    if (!YES_NO_UNKNOWN.has(input.geometry[k])) throw new Error("invalid_geometry_" + k);
  }
  assertHash(input.criteria_sha256, "criteria");
  assertHash(input.sample_plan_sha256, "sample_plan");

  exactKeys(input.challenge, [
    "access_without_barrier_damage", "first_opening_sequence_recorded",
    "all_access_routes_attempted", "number_of_units",
  ], "challenge");
  for (const k of ["access_without_barrier_damage", "first_opening_sequence_recorded",
                    "all_access_routes_attempted"]) {
    if (!YES_NO_UNKNOWN.has(input.challenge[k])) {
      throw new Error("invalid_challenge_" + k);
    }
  }
  if (!Number.isSafeInteger(input.challenge.number_of_units) ||
      input.challenge.number_of_units < 0 ||
      input.challenge.number_of_units > 1000000) {
    throw new Error("invalid_sample_count");
  }
  exactKeys(input.gates, REQUIRED_DESIGN_GATES, "gate_set");
  const gateResults = {};
  for (const name of REQUIRED_DESIGN_GATES) {
    const record = input.gates[name];
    exactKeys(record, EXACT_RECORD_KEYS, "gate_" + name);
    if (!PASS.has(record.result)) throw new Error("invalid_gate_result_" + name);
    if (record.result === "not_applicable" && name !== "leak_method_if_applicable") {
      throw new Error("unsupported_na_" + name);
    }
    if (record.result === "not_applicable") {
      // Applicability must be documented, not silently skipped.
      assertHash(record.artifact_sha256, name);
    } else if (record.result === "pass" || record.result === "fail") {
      assertHash(record.artifact_sha256, name);
    } else if (record.artifact_sha256 !== null) {
      assertHash(record.artifact_sha256, name);
    }
    if (!ROLES.has(record.recorded_by)) {
      throw new Error("invalid_reviewer_role_" + name);
    }
    gateResults[name] = record.result;
  }

  const reasons = [];
  if (input.geometry.irreversible_barrier_present === "no") {
    reasons.push("NO_IRREVERSIBLE_FIRST_OPENING_BARRIER_REPORTED");
  }
  if (input.geometry.barrier_before_reclosure === "no") {
    reasons.push("REUSABLE_CLOSURE_PRECEDES_BARRIER");
  }
  if (input.geometry.all_access_paths_protected === "no") {
    reasons.push("ACCESS_ROUTE_WITHOUT_BARRIER_REPORTED");
  }
  if (input.challenge.access_without_barrier_damage === "yes") {
    reasons.push("SILENT_ACCESS_REPORTED_IN_CHALLENGE");
  }
  if (Object.values(gateResults).some(x => x === "fail")) {
    reasons.push("GATE_FAILURE_REPORTED");
  }
  const blocked = reasons.length > 0;
  const allGeometryYes = EXACT_GEOMETRY_KEYS.every(k => input.geometry[k] === "yes");
  const challengeComplete =
    input.challenge.access_without_barrier_damage === "no" &&
    input.challenge.first_opening_sequence_recorded === "yes" &&
    input.challenge.all_access_routes_attempted === "yes" &&
    input.challenge.number_of_units > 0;
  const allGates = REQUIRED_DESIGN_GATES.every(k =>
    gateResults[k] === "pass" ||
    (k === "leak_method_if_applicable" && gateResults[k] === "not_applicable")
  );
  // An auditor must still confirm the submitter, artifacts, full test
  // applicability, process data and acceptance thresholds OUTSIDE this tool.
  const packetComplete = allGeometryYes && challengeComplete && allGates;
  const decision = blocked ? FAIL_STATE : packetComplete ? READY : INCOMPLETE;
  if (!blocked && !packetComplete) reasons.push("QUALIFICATION_PACKET_INCOMPLETE");

  return Object.freeze({
    design_id: input.design_id,
    revision: input.revision,
    decision,
    reasons: Object.freeze(reasons),
    release_gate: "HOLD",
    reviewer_action: "INDEPENDENT_REVIEW_REQUIRED",
    // A label alone is NOT a certification, even in the happy-path fixture.
    certified: false,
    unit_authenticity: "NOT_ASSESSED",
    fraud_determination: "NOT_ASSESSED",
    legal_compliance: "NOT_ASSESSED",
    note: "Self-reported metadata and SHA-256 pointers never prove physical sealing or issuer authority.",
  });
}
