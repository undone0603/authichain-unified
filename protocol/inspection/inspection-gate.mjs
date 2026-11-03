/**
 * TruMark inspection intake gate.
 * Receipt of a third-party claim does not authenticate the physical asset.
 * This file never signs, registers or issues credentials.
 */
const SHA256 = /^[a-f0-9]{64}$/;
const SAFE_STATUS = "EVIDENCE_ONLY_UNVERIFIED";

export function validateInspectionIntake(record) {
  const errors = [];
  if (!record || typeof record !== "object" || Array.isArray(record)) {
    return { accepted: false, errors: ["record_required"], status: SAFE_STATUS };
  }
  if (record.schemaVersion !== "authichain.inspection-intake.v0.1") errors.push("invalid_schema_version");
  if (typeof record.observationId !== "string" || !record.observationId.startsWith("urn:authichain:pilot:")) errors.push("observation_id_required");
  if (record.authorizationToDisclose !== true) errors.push("disclosure_authorization_required");
  if (typeof record.examiner?.business !== "string" || !record.examiner.business.trim()) errors.push("examiner_business_required");
  if (typeof record.examiner?.examinedAt !== "string" || !/^\d{4}-\d{2}-\d{2}T/.test(record.examiner.examinedAt) || Number.isNaN(Date.parse(record.examiner.examinedAt))) errors.push("date_required");
  if (typeof record.method?.name !== "string" || !record.method.name.trim()) errors.push("method_required");
  if (typeof record.method?.packagingState !== "string" || !["sealed", "opened", "unknown"].includes(record.method.packagingState)) errors.push("packaging_state_required");
  if (typeof record.report?.sha256 !== "string" || !SHA256.test(record.report.sha256)) errors.push("report_sha256_required");
  if (typeof record.report?.scope !== "string" || !record.report.scope.trim()) errors.push("scope_required");
  if (typeof record.report?.limitations !== "string" || !record.report.limitations.trim()) errors.push("limitations_required");
  if (record.manufacturerIssuerVerified === true) errors.push("manufacturer_issuer_cannot_be_self_attested");
  if (record.authenticated === true || record.status === "ACTIVE" || record.status === "VERIFIED") errors.push("cannot_self_authenticate");
  return {
    accepted: errors.length === 0,
    errors,
    status: SAFE_STATUS,
    nextGate: errors.length ? "COMPLETE_PRIVATE_INTAKE" : "INDEPENDENT_REVIEW_AND_SIGNED_ISSUER_ATTESTATION",
    claim: "Report received for review; physical authenticity not established by intake",
  };
}
