const ISO_INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?Z$/;
const HEX64 = /^[a-f0-9]{64}$/i;
const GTIN = /^\d{8,14}$/;

export function validateAssetPassport(passport) {
  const reasons = [];
  if (!passport || typeof passport !== "object" || Array.isArray(passport)) {
    return { valid: false, reasons: ["passport_not_object"] };
  }

  if (passport.schema !== "authichain.high-value-asset-passport/v0.1") {
    reasons.push("schema_unsupported");
  }

  if (typeof passport.assetClass !== "string") reasons.push("missing:assetClass");
  if (typeof passport.issuer !== "string" || !passport.issuer.trim()) reasons.push("missing:issuer");
  if (!passport.identity || typeof passport.identity !== "object") {
    reasons.push("missing:identity");
  } else {
    const id = passport.identity;
    if (!["gs1", "issuer_serial", "certificate", "composite"].includes(id.scheme)) {
      reasons.push("identity_scheme_unsupported");
    }
    if (typeof id.objectId !== "string" || !id.objectId.trim()) reasons.push("missing:identity.objectId");

    if (id.scheme === "gs1") {
      if (!id.gtin || !GTIN.test(id.gtin)) reasons.push("invalid:identity.gtin");
      if (!id.serial) reasons.push("missing:identity.serial");
    }

    if (id.scheme === "issuer_serial") {
      if (!id.issuerNamespace) reasons.push("missing:identity.issuerNamespace");
      if (!id.serial) reasons.push("missing:identity.serial");
    }

    if (id.scheme === "certificate" && !id.certificateId) {
      reasons.push("missing:identity.certificateId");
    }
  }

  if (!Array.isArray(passport.claims)) reasons.push("missing:claims");
  if (!Array.isArray(passport.evidence)) reasons.push("missing:evidence");
  if (!["active", "revoked", "superseded", "unknown"].includes(passport.status)) {
    reasons.push("invalid:status");
  }

  const evidenceIds = new Set(
    Array.isArray(passport.evidence)
      ? passport.evidence.filter(Boolean).map((e) => e.id)
      : [],
  );

  if (Array.isArray(passport.evidence)) {
    for (const evidence of passport.evidence) {
      if (!evidence?.id) reasons.push("evidence_missing:id");
      if (!evidence?.type) reasons.push("evidence_missing:type");
      if (!evidence?.issuer) reasons.push("evidence_missing:issuer");
      if (!evidence?.capturedAt || !ISO_INSTANT.test(evidence.capturedAt)) {
        reasons.push(("evidence_invalid:capturedAt:" + (evidence?.id ?? "unknown")));
      }
      if (evidence?.sha256 !== undefined && !HEX64.test(evidence.sha256)) {
        reasons.push(("evidence_invalid:sha256:" + (evidence?.id ?? "unknown")));
      }
    }
  }

  if (Array.isArray(passport.claims)) {
    for (const claim of passport.claims) {
      if (!claim?.id) reasons.push("claim_missing:id");
      if (!claim?.field) reasons.push(("claim_missing:field:" + (claim?.id ?? "unknown")));
      if (!claim?.issuer) reasons.push(("claim_missing:issuer:" + (claim?.id ?? "unknown")));
      for (const evidenceId of claim?.evidenceIds ?? []) {
        if (!evidenceIds.has(evidenceId)) {
          reasons.push(("claim_missing_evidence:" + (claim?.id ?? "unknown") + ":" + evidenceId));
        }
      }
    }
  }

  if (Array.isArray(passport.inspections)) {
    for (const inspection of passport.inspections) {
      if (!inspection?.id) reasons.push("inspection_missing:id");
      if (!inspection?.inspector) reasons.push(("inspection_missing:inspector:" + (inspection?.id ?? "unknown")));
      if (!inspection?.inspectedAt || !ISO_INSTANT.test(inspection.inspectedAt)) {
        reasons.push(("inspection_invalid:inspectedAt:" + (inspection?.id ?? "unknown")));
      }
      if (!Array.isArray(inspection?.methods) || inspection.methods.length === 0) {
        reasons.push(("inspection_missing:methods:" + (inspection?.id ?? "unknown")));
      }
      for (const evidenceId of inspection?.evidenceIds ?? []) {
        if (!evidenceIds.has(evidenceId)) {
          reasons.push(("inspection_missing_evidence:" + (inspection?.id ?? "unknown") + ":" + evidenceId));
        }
      }
    }
  }

  const policy = passport.verificationPolicy ?? {};
  if (policy.requirePhysicalInspection === true &&
      (!Array.isArray(passport.inspections) || passport.inspections.length === 0)) {
    reasons.push("policy_requires_physical_inspection");
  }

  if (policy.requireEvidenceForClaims === true &&
      Array.isArray(passport.claims) &&
      passport.claims.some((claim) => !Array.isArray(claim.evidenceIds) || claim.evidenceIds.length === 0)) {
    reasons.push("policy_requires_claim_evidence");
  }

  return { valid: reasons.length === 0, reasons };
}

export function summarizeTrustDimensions(passport) {
  const result = {
    identifier: "unavailable",
    issuer: "unavailable",
    evidence: "unavailable",
    physicalInspection: "not_performed",
    lifecycle: passport?.status ?? "unknown",
    custody: "undisclosed",
  };

  if (passport?.identity?.objectId) result.identifier = "identified";
  if (passport?.issuer) result.issuer = "asserted";
  if (Array.isArray(passport?.evidence) && passport.evidence.length) result.evidence = "present";
  if (Array.isArray(passport?.inspections) && passport.inspections.length) {
    result.physicalInspection = "performed";
  }
  if (Array.isArray(passport?.lifecycle) && passport.lifecycle.length) {
    result.custody = passport.lifecycle.some((e) => e.type === "custody_transfer")
      ? "events_present"
      : "no_custody_transfer";
  }
  return result;
}
