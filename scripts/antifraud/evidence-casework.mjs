/**
 * AuthiChain / StrainChain counterfeit intelligence — v0.1, OFFLINE ONLY.
 *
 * Evidence reports can justify investigation, never public accusations.
 * No call here validates image contents, issuer signatures, lab COAs,
 * original retail condition, or independent witnesses. In particular,
 * a copied QR, a failed lookup, or an intact-looking tear strip is not
 * proof of a counterfeit. No network, external action, write, or payment.
 *
 * Public-safe A2A/MCP export does not contain underlying photo hashes,
 * product IDs, business names, barcodes, contacts, URLs, or findings of fraud.
 */

export const EVIDENCE_KINDS = Object.freeze([
  "intact_tear_feature_open_mouth_reported",
  "first_opening_bypass_reported",
  "retail_unopened_handoff_reported",
  "independent_opening_review_reported",
  "duplicate_instance_identifier_reported",
  "invalid_issuer_signature_reported",
  "revoked_issuer_credential_reported",
  "coa_digest_mismatch_reported",
  "identifier_not_found_reported",
  "issuer_credential_valid_reported",
  "purchase_receipt_reported",
]);
export const SOURCE_CLASSES = Object.freeze([
  "consumer_report",
  "photo_reference",
  "issuer_claim",
  "verifier_output_claim",
  "independent_report_claim",
]);
const KEYS = Object.freeze([
  "case_alias", "evidence", "intended_use",
]);
const EVIDENCE_KEYS = Object.freeze([
  "ref", "kind", "artifact_sha256", "source_class",
]);
const ALLOWED_USE = "private_internal_triage";
const SAFE_SIGNALS = new Set([
  "PACKAGE_FIRST_OPENING_REVIEW",
  "ISSUER_AUTHENTICITY_REVIEW",
  "POTENTIAL_IDENTIFIER_REUSE_REVIEW",
  "LAB_DOCUMENT_CONSISTENCY_REVIEW",
  "NOT_FOUND_IS_NOT_COUNTERFEIT",
  "INDEPENDENT_REVIEW_REPORT_AUTHENTICATION_NEEDED",
  "ISSUER_CREDENTIAL_CLAIM_REQUIRES_CANONICAL_VERIFICATION",
]);
const SAFE_ACTIONS = new Set([
  "PRESERVE_PRIVATE_ORIGINALS_AND_RECEIPTS",
  "REQUEST_INDEPENDENT_FIRST_OPENING_REPRODUCTION",
  "VERIFY_AUTHORIZED_ISSUER_SIGNATURE_AND_REVOCATION",
  "RECONCILE_PER_UNIT_SERIALS_AND_DISTINCT_PHYSICAL_ITEMS",
  "VERIFY_LAB_COA_DIGEST_AND_ISSUER_PROVENANCE",
  "RECHECK_IDENTIFIER_SOURCE_AND_SERVICE_HEALTH",
  "SEEK_AUTHORIZED_QUALITY_OR_LEGAL_REVIEW_BEFORE_EXTERNAL_ACTION",
]);
const ID = /^[A-Za-z0-9][A-Za-z0-9._-]{2,79}$/;
const HASH = /^[a-f0-9]{64}$/;

function isPlainObject(value) {
  return value !== null && typeof value === "object" &&
    !Array.isArray(value) &&
    (Object.getPrototypeOf(value) === Object.prototype ||
     Object.getPrototypeOf(value) === null);
}

function checkKeys(value, names, label) {
  if (!isPlainObject(value) ||
      Object.keys(value).length !== names.length ||
      Object.keys(value).some(name => !names.includes(name))) {
    throw new Error("invalid_" + label + "_fields");
  }
}

function unique(list) {
  return [...new Set(list)];
}

function validation(input) {
  checkKeys(input, KEYS, "case");
  if (typeof input.case_alias !== "string" ||
      !ID.test(input.case_alias)) {
    throw new Error("invalid_case_alias");
  }
  if (input.intended_use !== ALLOWED_USE) {
    throw new Error("unauthorized_use");
  }
  if (!Array.isArray(input.evidence) || input.evidence.length > 48) {
    throw new Error("invalid_evidence_count");
  }

  const refs = new Set();
  const hashes = new Set();
  for (const item of input.evidence) {
    checkKeys(item, EVIDENCE_KEYS, "evidence");
    if (typeof item.ref !== "string" || !ID.test(item.ref)) {
      throw new Error("invalid_evidence_ref");
    }
    if (!EVIDENCE_KINDS.includes(item.kind)) {
      throw new Error("invalid_evidence_kind");
    }
    if (typeof item.artifact_sha256 !== "string" ||
        !HASH.test(item.artifact_sha256)) {
      throw new Error("invalid_evidence_hash");
    }
    if (!SOURCE_CLASSES.includes(item.source_class)) {
      throw new Error("invalid_evidence_source");
    }
    if (refs.has(item.ref)) throw new Error("duplicate_evidence_ref");
    if (hashes.has(item.artifact_sha256)) {
      throw new Error("duplicate_evidence_artifact");
    }
    refs.add(item.ref);
    hashes.add(item.artifact_sha256);
  }
}

const PRIORITIES = Object.freeze({
  INFORMATION_ONLY: "INFORMATION_ONLY",
  TECHNICAL_REVIEW: "TECHNICAL_REVIEW",
  EXPEDITED_HUMAN_REVIEW: "EXPEDITED_HUMAN_REVIEW",
});

const ACTIONS = Object.freeze({
  preserve: "PRESERVE_PRIVATE_ORIGINALS_AND_RECEIPTS",
  opening: "REQUEST_INDEPENDENT_FIRST_OPENING_REPRODUCTION",
  issuer: "VERIFY_AUTHORIZED_ISSUER_SIGNATURE_AND_REVOCATION",
  instance: "RECONCILE_PER_UNIT_SERIALS_AND_DISTINCT_PHYSICAL_ITEMS",
  coa: "VERIFY_LAB_COA_DIGEST_AND_ISSUER_PROVENANCE",
  noRecord: "RECHECK_IDENTIFIER_SOURCE_AND_SERVICE_HEALTH",
  legal: "SEEK_AUTHORIZED_QUALITY_OR_LEGAL_REVIEW_BEFORE_EXTERNAL_ACTION",
});

export function triageCounterfeitEvidence(input) {
  validation(input);
  const kinds = new Set(input.evidence.map(item => item.kind));
  const contains = (...names) => names.some(name => kinds.has(name));
  const physical = contains(
    "intact_tear_feature_open_mouth_reported",
    "first_opening_bypass_reported",
    "independent_opening_review_reported",
  );
  const crypto = contains(
    "invalid_issuer_signature_reported",
    "revoked_issuer_credential_reported",
  );
  const instance = kinds.has("duplicate_instance_identifier_reported");
  const coa = kinds.has("coa_digest_mismatch_reported");
  const noRecord = kinds.has("identifier_not_found_reported");

  const signals = [];
  if (physical) signals.push("PACKAGE_FIRST_OPENING_REVIEW");
  if (crypto) signals.push("ISSUER_AUTHENTICITY_REVIEW");
  if (instance) signals.push("POTENTIAL_IDENTIFIER_REUSE_REVIEW");
  if (coa) signals.push("LAB_DOCUMENT_CONSISTENCY_REVIEW");
  if (noRecord) signals.push("NOT_FOUND_IS_NOT_COUNTERFEIT");
  // A reporter's assertion of a previously witnessed independent review
  // is still unverified input, not an authenticated third-party finding.
  if (kinds.has("independent_opening_review_reported")) {
    signals.push("INDEPENDENT_REVIEW_REPORT_AUTHENTICATION_NEEDED");
  }
  if (kinds.has("issuer_credential_valid_reported")) {
    signals.push("ISSUER_CREDENTIAL_CLAIM_REQUIRES_CANONICAL_VERIFICATION");
  }

  const families = [physical, crypto, instance, coa].filter(Boolean).length;
  const priority = families >= 2
    ? PRIORITIES.EXPEDITED_HUMAN_REVIEW
    : families === 1
      ? PRIORITIES.TECHNICAL_REVIEW
      : PRIORITIES.INFORMATION_ONLY;
  const steps = [ACTIONS.preserve];
  if (physical) steps.push(ACTIONS.opening);
  if (crypto) steps.push(ACTIONS.issuer);
  if (instance) steps.push(ACTIONS.instance);
  if (coa) steps.push(ACTIONS.coa);
  if (noRecord) steps.push(ACTIONS.noRecord);
  if (families) steps.push(ACTIONS.legal);

  return Object.freeze({
    case_alias: input.case_alias,
    schema: "authichain.antifraud.casework.v0.1",
    priority,
    evidence_count: input.evidence.length,
    signal_families: families,
    signals: Object.freeze(unique(signals)),
    validation_steps: Object.freeze(unique(steps)),
    finding: "NO_COUNTERFEIT_DETERMINATION",
    source_authentication: "NOT_PERFORMED",
    independent_reproduction: "NOT_PERFORMED",
    issuer_signature_verification: "NOT_PERFORMED",
    regulatory_assessment: "NOT_PERFORMED",
    human_review_required: true,
    release_gate: "HOLD",
    allowed_automation: "READ_ONLY_LOCAL_ANALYSIS",
    external_communications: "NOT_AUTHORIZED",
    operational_effects: Object.freeze([]),
  });
}

/**
 * Redacted draft for future MCP/A2A partner-to-partner interoperability.
 * Not a signed Agent Passport or JWS; recipient must not trust or publish it.
 */
export function toSafeAgentExchange(result) {
  if (!isPlainObject(result) ||
      result.schema !== "authichain.antifraud.casework.v0.1" ||
      result.release_gate !== "HOLD" ||
      result.finding !== "NO_COUNTERFEIT_DETERMINATION" ||
      result.human_review_required !== true ||
      !Array.isArray(result.signals) ||
      !Array.isArray(result.validation_steps) ||
      !Object.values(PRIORITIES).includes(result.priority) ||
      result.external_communications !== "NOT_AUTHORIZED" ||
      result.allowed_automation !== "READ_ONLY_LOCAL_ANALYSIS" ||
      !Array.isArray(result.operational_effects) ||
      result.operational_effects.length !== 0 ||
      result.signals.length > SAFE_SIGNALS.size ||
      result.validation_steps.length > SAFE_ACTIONS.size ||
      result.signals.some(x => !SAFE_SIGNALS.has(x)) ||
      result.validation_steps.some(x => !SAFE_ACTIONS.has(x))) {
    throw new Error("invalid_case_result");
  }
  return Object.freeze({
    type: "authichain.antifraud.review_proposal.v0.1",
    trust: "UNSIGNED_UNTRUSTED_PROPOSAL",
    shared_data_scope: "NO_PRIVATE_EVIDENCE_INCLUDED",
    priority: result.priority,
    signal_types: Object.freeze([...result.signals]),
    validation_requests: Object.freeze([...result.validation_steps]),
    release_gate: "HOLD",
    action_policy: "PROPOSAL_ONLY_NO_NETWORK_OR_OUTBOUND",
    allegation: "NONE",
    verification_requirement:
      "REPRODUCE_INDEPENDENTLY_AND_VERIFY_ISSUER_AUTHORITY",
  });
}
