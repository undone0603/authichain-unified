/**
 * StrainChain SealLock v0.1: evidence-bound package observations.
 *
 * This does not verify authenticity, legality, contents, provenance, or
 * a real factory seal. It performs no network I/O, publication or writes.
 * An image hash is an integrity reference, not a proof the image is truthful.
 */

export const SEAL_REVIEW_STATES = Object.freeze({
  NOT_ASSESSED: "NOT_ASSESSED",
  INDETERMINATE: "INDETERMINATE",
  OPEN_MOUTH_TEAR_FEATURE_INTACT: "OPEN_MOUTH_TEAR_FEATURE_INTACT",
  BYPASS_SUSPECTED: "BYPASS_SUSPECTED",
  WITNESS_RECORD_CLAIMED_REVIEW_REQUIRED: "WITNESS_RECORD_CLAIMED_REVIEW_REQUIRED",
  FIRST_OPENING_BARRIER_OBSERVED: "FIRST_OPENING_BARRIER_OBSERVED",
});

const TRI = new Set(["yes", "no", "unknown"]);
const PHASES = new Set(["unknown", "as_received_before_first_open", "after_opening"]);
const ROLES = new Set([
  "front", "back", "top", "interior_mouth", "seam", "retail_label", "first_opening_video", "other",
]);
const CUSTODY = new Set(["unverified", "observer_statement", "independent_witness"]);
const KEYS = [
  "mouth_open",
  "tear_feature_intact",
  "interior_access_reported_without_tearing",
  "continuous_first_opening_video",
  "independent_witness_present",
  "first_opening_barrier_visible",
  "reported_unopened_at_retail_handoff",
];

function validateRef(evidence) {
  if (!evidence || typeof evidence !== "object") {
    throw new Error("invalid_evidence_reference");
  }
  if (!/^[a-f0-9]{64}$/.test(evidence.sha256 || "")) {
    throw new Error("evidence_sha256_required");
  }
  if (!PHASES.has(evidence.phase) ||
      !ROLES.has(evidence.role) ||
      !CUSTODY.has(evidence.custody)) {
    throw new Error("invalid_evidence_provenance");
  }
  // Never ingest source images, credentials or open URLs into a public report.
  if (Object.keys(evidence).some(key => ![
    "sha256", "phase", "role", "custody",
  ].includes(key))) {
    throw new Error("unexpected_evidence_field");
  }
}

/**
 * @param {object} input
 * @param {string} input.case_id non-identifying local case identifier
 * @param {{sha256:string,phase:string,role:string,custody:string}[]} input.evidence
 * @param {Record<string,'yes'|'no'|'unknown'>} input.observations
 * @returns {{case_id:string,state:string,release_gate:'HOLD',limitations:string[],flags:string[],evidence_hashes:string[]}}
 */
export function assessPackageSeal(input) {
  if (!input || typeof input !== "object" ||
      typeof input.case_id !== "string" ||
      !/^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/.test(input.case_id)) {
    throw new Error("invalid_case_id");
  }
  if (!Array.isArray(input.evidence) ||
      input.evidence.length > 32) {
    throw new Error("invalid_evidence_count");
  }
  input.evidence.forEach(validateRef);
  if (new Set(input.evidence.map(e => e.sha256)).size !== input.evidence.length) {
    throw new Error("duplicate_image_hash");
  }
  const observations = input.observations;
  if (!observations || typeof observations !== "object" ||
      Object.keys(observations).some(key => !KEYS.includes(key))) {
    throw new Error("invalid_observations");
  }
  for (const key of KEYS) {
    if (!TRI.has(observations[key])) throw new Error(`invalid_observation_${key}`);
  }
  const yes = key => observations[key] === "yes";
  // A matching barcode or a general product picture cannot support an
  // observed open mouth. Demand a photo reference to the mouth/top; the
  // SHA remains an integrity pointer, not proof the picture is genuine.
  const openingViewReferenced = input.evidence.some(e =>
    e.role === "interior_mouth" || e.role === "top" ||
    e.role === "first_opening_video"
  );
  const openingVisual = openingViewReferenced &&
    yes("mouth_open") && yes("tear_feature_intact");
  const reportedBypass = openingVisual &&
    yes("interior_access_reported_without_tearing");

  const video = input.evidence.some(e =>
    e.role === "first_opening_video" &&
    e.phase === "as_received_before_first_open" &&
    e.custody === "independent_witness"
  );
  // These are submitter-provided fields and hashes. They do not authenticate
  // a witness, video content, chronology, source custody or a physical bypass.
  // Require external review; never name the state as a witnessed conclusion.
  const claimedWitnessRecord = reportedBypass && video &&
    yes("continuous_first_opening_video") &&
    yes("independent_witness_present");

  let state = SEAL_REVIEW_STATES.INDETERMINATE;
  if (!input.evidence.length) state = SEAL_REVIEW_STATES.NOT_ASSESSED;
  else if (claimedWitnessRecord) {
    state = SEAL_REVIEW_STATES.WITNESS_RECORD_CLAIMED_REVIEW_REQUIRED;
  } else if (reportedBypass) state = SEAL_REVIEW_STATES.BYPASS_SUSPECTED;
  else if (openingVisual) state = SEAL_REVIEW_STATES.OPEN_MOUTH_TEAR_FEATURE_INTACT;
  else if (yes("first_opening_barrier_visible")) {
    state = SEAL_REVIEW_STATES.FIRST_OPENING_BARRIER_OBSERVED;
  }

  const flags = [];
  if (openingVisual) flags.push("OPEN_MOUTH_WITH_TEAR_FEATURE_INTACT");
  if (reportedBypass) flags.push("FIRST_OPENING_BYPASS_REPORTED");
  if (claimedWitnessRecord) flags.push("INDEPENDENT_REVIEW_REQUIRED");
  if (yes("first_opening_barrier_visible")) {
    flags.push("BARRIER_VISUALLY_OBSERVED_NOT_QUALIFIED");
  }
  // A first-person handoff statement is relevant provenance, not proof of
  // manufacturer sealing or independent chain of custody. Never upgrades state.
  if (yes("reported_unopened_at_retail_handoff")) {
    flags.push("RETAIL_UNOPENED_AS_REPORTED_NOT_INDEPENDENTLY_VERIFIED");
  }

  return Object.freeze({
    case_id: input.case_id,
    state,
    release_gate: "HOLD",
    flags,
    evidence_hashes: input.evidence.map(e => e.sha256),
    limitations: [
      "No counterfeit conclusion",
      "No legal noncompliance determination",
      "No proof of original factory state or chain of custody",
      "No authority to publish, charge, grant access or release product",
      "Image hashes do not authenticate source, issuer or contents",
    ],
  });
}
