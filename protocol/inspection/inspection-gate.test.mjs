import test from "node:test";
import assert from "node:assert/strict";
import { validateInspectionIntake } from "./inspection-gate.mjs";

function valid() {
  return {
    schemaVersion: "authichain.inspection-intake.v0.1",
    observationId: "urn:authichain:pilot:physical:valcambi-pt25:20261102-d2aa08ac",
    authorizationToDisclose: true,
    examiner: { business: "Independent Example Assayer", examinedAt: "2026-11-03T00:00:00Z" },
    method: { name: "XRF", packagingState: "sealed" },
    report: { sha256: "a".repeat(64), scope: "sealed surface", limitations: "no core measurement" },
  };
}

test("intake does not issue an authenticity decision", () => {
  const res = validateInspectionIntake(valid());
  assert.equal(res.accepted, true);
  assert.equal(res.status, "EVIDENCE_ONLY_UNVERIFIED");
  assert.equal(res.nextGate, "INDEPENDENT_REVIEW_AND_SIGNED_ISSUER_ATTESTATION");
});
test("cannot self-attest manufacturer or issuer", () => {
  for (const changes of [{ authenticated: true }, { status: "VERIFIED" }, { manufacturerIssuerVerified: true }]) {
    const res = validateInspectionIntake({ ...valid(), ...changes });
    assert.equal(res.accepted, false);
    assert.equal(res.status, "EVIDENCE_ONLY_UNVERIFIED");
  }
});
test("missing examiner, method, report digest, limitations, or consent fails closed", () => {
  const fields = [
    { examiner: null }, { method: null }, { report: { sha256: "invalid" } },
    { authorizationToDisclose: false }, { report: { sha256: "a".repeat(64), scope: "foo", limitations: "" } },
  ];
  for (const patch of fields) assert.equal(validateInspectionIntake({ ...valid(), ...patch }).accepted, false);
});
test("untrusted JSON cannot create a registry proof", () => {
  assert.equal(validateInspectionIntake(null).accepted, false);
  assert.equal(validateInspectionIntake({}).accepted, false);
});
