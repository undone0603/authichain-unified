import {
  auditFarmPassports,
  type FarmPassportAudit,
  type PassportAuditOptions,
} from "./passport-audit";
import { fingerprintCultivar } from "./fingerprint";
import { getCultivar, getDossier, toSlug } from "./genetics";

export type LifecycleStageStatus = "pass" | "review_required" | "blocked";

export interface StrainchainLifecycleReport {
  farm: string;
  publication: FarmPassportAudit["publication"];
  evidenceReview: LifecycleStageStatus;
  publicListing: LifecycleStageStatus;
  fingerprintPreparation: LifecycleStageStatus;
  issuerAction: "owner_approval_required" | "blocked";
  fingerprints: {
    cultivar: string;
    digest: string;
    canonical: string;
  }[];
  blockers: string[];
  audit: FarmPassportAudit;
}

/**
 * Prepare the evidence-to-passport lifecycle without issuing, anchoring,
 * publishing, sending, or changing any source data.
 */
export function prepareStrainchainLifecycle(
  farm: string,
  options: PassportAuditOptions = {}
): StrainchainLifecycleReport {
  const audit = auditFarmPassports(farm, options);
  const evidenceReview: LifecycleStageStatus =
    audit.status === "blocked"
      ? "blocked"
      : audit.status === "review_required"
        ? "review_required"
        : "pass";
  const publicListing: LifecycleStageStatus =
    audit.publication === "public" ? "pass" : "blocked";
  const blockers: string[] = [];

  if (evidenceReview !== "pass") {
    blockers.push(
      evidenceReview === "blocked"
        ? "Source evidence has blocking audit errors."
        : "Source evidence requires human review."
    );
  }
  if (publicListing !== "pass") {
    blockers.push(`Farm publication status is ${audit.publication}.`);
  }

  const canPrepareFingerprints =
    evidenceReview === "pass" && publicListing === "pass";
  const dossier = canPrepareFingerprints ? getDossier(farm) : null;
  const fingerprints = dossier
    ? dossier.cultivars.map(({ id }) => {
        const view = getCultivar(farm, toSlug(id));
        if (!view) throw new Error(`Missing cultivar view: ${id}`);
        const fingerprint = fingerprintCultivar(view, farm);
        return {
          cultivar: id,
          digest: fingerprint.digest,
          canonical: fingerprint.canonical,
        };
      })
    : [];

  const fingerprintPreparation: LifecycleStageStatus = canPrepareFingerprints
    ? "pass"
    : "blocked";
  if (!canPrepareFingerprints) {
    blockers.push("Fingerprint preparation is held until both gates pass.");
  }
  blockers.push(
    "Issuer approval and item-level identifiers are required before seal issuance."
  );

  return {
    farm,
    publication: audit.publication,
    evidenceReview,
    publicListing,
    fingerprintPreparation,
    issuerAction: canPrepareFingerprints ? "owner_approval_required" : "blocked",
    fingerprints,
    blockers,
    audit,
  };
}
