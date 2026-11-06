import assert from "node:assert/strict";
import test from "node:test";
import {
  triageCounterfeitEvidence,
  toSafeAgentExchange,
} from "./evidence-casework.mjs";

const hash = n => n.toString(16).padStart(64, "0");
const item = (n, kind, source_class = "consumer_report") => ({
  ref: "evidence-" + n,
  kind,
  artifact_sha256: hash(n),
  source_class,
});
const make = (...evidence) => ({
  case_alias: "case-sandbox-001",
  intended_use: "private_internal_triage",
  evidence,
});

test("observed open mouth is packaging safety review, not a counterfeit verdict", () => {
  const result = triageCounterfeitEvidence(make(
    item(1, "intact_tear_feature_open_mouth_reported", "photo_reference"),
    item(2, "retail_unopened_handoff_reported"),
    item(3, "first_opening_bypass_reported"),
  ));
  assert.equal(result.priority, "TECHNICAL_REVIEW");
  assert.deepEqual(result.signals, ["PACKAGE_FIRST_OPENING_REVIEW"]);
  assert.equal(result.finding, "NO_COUNTERFEIT_DETERMINATION");
  assert.equal(result.release_gate, "HOLD");
  assert.equal(result.independent_reproduction, "NOT_PERFORMED");
  assert.equal(result.human_review_required, true);
});

test("two distinct risk families prioritize investigation but not enforcement", () => {
  const result = triageCounterfeitEvidence(make(
    item(1, "first_opening_bypass_reported"),
    item(2, "duplicate_instance_identifier_reported"),
    item(3, "coa_digest_mismatch_reported"),
  ));
  assert.equal(result.priority, "EXPEDITED_HUMAN_REVIEW");
  assert.equal(result.signal_families, 3);
  assert.equal(result.finding, "NO_COUNTERFEIT_DETERMINATION");
  assert.equal(result.external_communications, "NOT_AUTHORIZED");
  assert.deepEqual(result.operational_effects, []);
});

test("not found alone is information only, never a counterfeit signal", () => {
  const result = triageCounterfeitEvidence(make(
    item(1, "identifier_not_found_reported", "verifier_output_claim"),
  ));
  assert.equal(result.priority, "INFORMATION_ONLY");
  assert.equal(result.signal_families, 0);
  assert.deepEqual(result.signals, ["NOT_FOUND_IS_NOT_COUNTERFEIT"]);
  assert.ok(result.validation_steps.includes(
    "RECHECK_IDENTIFIER_SOURCE_AND_SERVICE_HEALTH",
  ));
});

test("self-reported valid credential cannot certify a physical item", () => {
  const result = triageCounterfeitEvidence(make(
    item(1, "issuer_credential_valid_reported", "issuer_claim"),
  ));
  assert.equal(result.priority, "INFORMATION_ONLY");
  assert.equal(result.issuer_signature_verification, "NOT_PERFORMED");
  assert.equal(result.finding, "NO_COUNTERFEIT_DETERMINATION");
});

test("claimed independent reviewer cannot be laundered into accepted proof", () => {
  const result = triageCounterfeitEvidence(make(
    item(1, "independent_opening_review_reported", "independent_report_claim"),
  ));
  assert.equal(result.independent_reproduction, "NOT_PERFORMED");
  assert.equal(result.priority, "TECHNICAL_REVIEW");
  assert.ok(result.signals.includes(
    "INDEPENDENT_REVIEW_REPORT_AUTHENTICATION_NEEDED",
  ));
});

test("issuer and laboratory discrepancies remain verification requests", () => {
  const result = triageCounterfeitEvidence(make(
    item(1, "invalid_issuer_signature_reported", "verifier_output_claim"),
    item(2, "revoked_issuer_credential_reported", "issuer_claim"),
    item(3, "coa_digest_mismatch_reported", "consumer_report"),
  ));
  assert.equal(result.priority, "EXPEDITED_HUMAN_REVIEW");
  assert.ok(result.validation_steps.includes(
    "VERIFY_AUTHORIZED_ISSUER_SIGNATURE_AND_REVOCATION",
  ));
  assert.ok(result.validation_steps.includes(
    "VERIFY_LAB_COA_DIGEST_AND_ISSUER_PROVENANCE",
  ));
  assert.equal(result.source_authentication, "NOT_PERFORMED");
});

test("duplicates cannot manufacture corroboration from a copied photograph", () => {
  const duplicate = item(1, "first_opening_bypass_reported");
  assert.throws(() => triageCounterfeitEvidence(make(
    duplicate, { ...item(2, "duplicate_instance_identifier_reported"),
      artifact_sha256: duplicate.artifact_sha256 },
  )), /duplicate_evidence_artifact/);
  assert.throws(() => triageCounterfeitEvidence(make(
    duplicate, { ...item(2, "first_opening_bypass_reported"), ref: duplicate.ref },
  )), /duplicate_evidence_ref/);
});

test("raw barcode, company, URLs and photos cannot enter case input", () => {
  assert.throws(() => triageCounterfeitEvidence({
    ...make(item(1, "first_opening_bypass_reported")),
    manufacturer_name: "private-party",
  }), /invalid_case_fields/);
  assert.throws(() => triageCounterfeitEvidence(make({
    ...item(1, "first_opening_bypass_reported"),
    image_bytes: "secret",
  })), /invalid_evidence_fields/);
  assert.throws(() => triageCounterfeitEvidence(make({
    ...item(1, "first_opening_bypass_reported"),
    package_identifier: "raw-label",
  })), /invalid_evidence_fields/);
  assert.throws(() => triageCounterfeitEvidence(make({
    ...item(1, "first_opening_bypass_reported"),
    url: "https://case.example",
  })), /invalid_evidence_fields/);
});

test("casework cannot be switched to public accusation or live enforcement", () => {
  for (const intended_use of ["public_accusation", "law_enforcement_filing",
                                "automatic_bounty_payout", "contact_seller"]) {
    assert.throws(() => triageCounterfeitEvidence({
      ...make(), intended_use,
    }), /unauthorized_use/);
  }
});

test("rejects unsupported kind, provenance and malformed hash", () => {
  assert.throws(() => triageCounterfeitEvidence(make({
    ...item(1, "brand_is_fraudulent"),
  })), /invalid_evidence_kind/);
  assert.throws(() => triageCounterfeitEvidence(make({
    ...item(1, "first_opening_bypass_reported"),
    source_class: "court_verified",
  })), /invalid_evidence_source/);
  assert.throws(() => triageCounterfeitEvidence(make({
    ...item(1, "first_opening_bypass_reported"),
    artifact_sha256: "not-hex",
  })), /invalid_evidence_hash/);
});

test("zero evidence is explicitly inconclusive and remains held", () => {
  const result = triageCounterfeitEvidence(make());
  assert.equal(result.evidence_count, 0);
  assert.equal(result.priority, "INFORMATION_ONLY");
  assert.deepEqual(result.signals, []);
  assert.equal(result.release_gate, "HOLD");
});

test("A2A/MCP exchange redacts case IDs, evidence hashes and raw context", () => {
  const h = hash(41);
  const input = make({
    ...item(41, "intact_tear_feature_open_mouth_reported"),
    artifact_sha256: h,
  });
  const result = triageCounterfeitEvidence(input);
  const exchanged = toSafeAgentExchange(result);
  const raw = JSON.stringify(exchanged);
  assert.equal(exchanged.trust, "UNSIGNED_UNTRUSTED_PROPOSAL");
  assert.equal(exchanged.release_gate, "HOLD");
  assert.equal(exchanged.allegation, "NONE");
  assert.ok(!raw.includes(h));
  assert.ok(!raw.includes(input.case_alias));
  assert.ok(!raw.includes("evidence-41"));
  assert.equal(exchanged.action_policy, "PROPOSAL_ONLY_NO_NETWORK_OR_OUTBOUND");
});

test("A2A interface rejects fake approvals and fabricated evidence results", () => {
  const result = triageCounterfeitEvidence(make(
    item(1, "first_opening_bypass_reported"),
  ));
  assert.throws(() => toSafeAgentExchange({
    ...result, release_gate: "APPROVED",
  }), /invalid_case_result/);
  assert.throws(() => toSafeAgentExchange({
    ...result, finding: "COUNTERFEIT_CONFIRMED",
  }), /invalid_case_result/);
  assert.throws(() => toSafeAgentExchange({
    ...result, human_review_required: false,
  }), /invalid_case_result/);
});

test("A2A exchange rejects injected private data and unsafe actions", () => {
  const result = triageCounterfeitEvidence(make(
    item(1, "first_opening_bypass_reported"),
  ));
  assert.throws(() => toSafeAgentExchange({
    ...result, signals: ["PACKAGE_FIRST_OPENING_REVIEW", "private-seller-name"],
  }), /invalid_case_result/);
  assert.throws(() => toSafeAgentExchange({
    ...result, validation_steps: [
      "PRESERVE_PRIVATE_ORIGINALS_AND_RECEIPTS",
      "AUTO_SEND_LEGAL_DEMAND_TO_COMPANY",
    ],
  }), /invalid_case_result/);
  assert.throws(() => toSafeAgentExchange({
    ...result, priority: "CRIMINAL_FRAUD_CONFIRMED",
  }), /invalid_case_result/);
  assert.throws(() => toSafeAgentExchange({
    ...result, external_communications: "AUTHORIZED",
  }), /invalid_case_result/);
  assert.throws(() => toSafeAgentExchange({
    ...result, operational_effects: ["notify"],
  }), /invalid_case_result/);
});

test("results are deterministic and never grant external action", () => {
  const x = make(
    item(1, "first_opening_bypass_reported"),
    item(2, "identifier_not_found_reported"),
  );
  const a = triageCounterfeitEvidence(x);
  const b = triageCounterfeitEvidence(x);
  assert.deepEqual(a, b);
  assert.deepEqual(toSafeAgentExchange(a), toSafeAgentExchange(b));
  assert.equal(a.allowed_automation, "READ_ONLY_LOCAL_ANALYSIS");
  assert.deepEqual(a.operational_effects, []);
});
