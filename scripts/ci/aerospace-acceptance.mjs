/**
 * AuthiChain aerospace EEE component PRE-ACCEPTANCE evidence gate.
 * Experimental, non-flight, side-effect-free. Input verification flags MUST come
 * from independent cryptographic/quality validators; this function does not
 * verify signatures, certificate chains, inspection reports or physical parts.
 * Do not use as an autonomous flight hardware release authority.
 */
const validText = value => typeof value === 'string' && value.trim().length > 0;
const digest = value => typeof value === 'string' && /^sha256:[a-f0-9]{64}$/.test(value);
const add = (out, condition, reason) => { if (!condition) out.push(reason); };

export function assessAerospaceComponent(input) {
  const reasons = [];
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    return { decision: 'HOLD', eligibleForHumanReview: false, counterfeitEstablished: false, reasons: ['invalid_evidence_package'] };
  }
  const { part, issuer, attestation, procurement, custody, screening, identityObservations, review } = input;
  add(reasons, !!part && validText(part.manufacturer) && validText(part.partNumber) && (validText(part.serial) || validText(part.lot)), 'part_identity_missing');
  add(reasons, !!issuer && issuer.trusted === true && issuer.authorizedForPart === true, 'manufacturer_authority_unverified');
  add(reasons, !!attestation && attestation.signatureVerified === true && attestation.subjectMatched === true && attestation.currentStatus === 'active' && attestation.issuerStatus === 'trusted' && attestation.verifiedDecision === 'verified' && attestation.freshStatusRead === true, 'signed_attestation_not_actionable');
  add(reasons, !!procurement && procurement.sourceType === 'authorized' && procurement.authorityVerified === true && digest(procurement.purchaseRecordDigest), 'authorized_provenance_not_established');
  // Each custody step must be independently authenticated, ordered and agree
  // on its part identity and previous event hash. The first record is the
  // manufacturer anchor; events after it must point to the prior digest.
  if (!Array.isArray(custody) || custody.length < 2) {
    reasons.push('custody_history_incomplete');
  } else {
    const seen = new Set();
    for (let i = 0; i < custody.length; i++) {
      const event = custody[i];
      if (!event || typeof event !== 'object' || !validText(event.eventId) || seen.has(event.eventId) || !digest(event.digest) || event.signatureVerified !== true || event.authorityVerified !== true || event.partMatched !== true || !Number.isSafeInteger(event.eventTimeMs)) {
        reasons.push('custody_event_invalid'); break;
      }
      seen.add(event.eventId);
      if (i > 0 && (event.previousDigest !== custody[i - 1].digest || event.eventTimeMs <= custody[i - 1].eventTimeMs)) {
        reasons.push('custody_continuity_invalid'); break;
      }
    }
    if (custody[0]?.origin !== 'manufacturer') reasons.push('manufacturer_custody_anchor_missing');
  }
  // Do not accept user-submitted "no duplicate" without an independent index
  // check; an absent registry result is unknown, not proof of uniqueness.
  add(reasons, !!identityObservations && identityObservations.registryChecked === true && identityObservations.duplicateCount === 0 && identityObservations.conflictCount === 0, 'duplicate_identity_or_unchecked_registry');
  add(reasons, !!screening && screening.labAuthorityVerified === true && screening.reportSignatureVerified === true && screening.partMatched === true && screening.result === 'pass' && digest(screening.reportDigest) && screening.projectRequirementsMatched === true, 'screening_evidence_incomplete');
  add(reasons, !!review && review.missionSpecificReviewComplete === true && review.approvedSupplierListChecked === true && review.openDiscrepancies === 0 && review.qualityOwnerApproved === true, 'mission_quality_acceptance_pending');
  // The input is treated as a collection of *observations* from trusted
  // subsystems. A fabricated input can pass: integrators MUST perform those
  // checks upstream, authenticate evidence sources, and enforce this decision.
  return {
    decision: reasons.length ? 'HOLD' : 'ELIGIBLE_FOR_HUMAN_REVIEW',
    eligibleForHumanReview: reasons.length === 0,
    counterfeitEstablished: false,
    reasons: [...new Set(reasons)],
    assessmentType: 'PRE_ACCEPTANCE_EVIDENCE_SCREEN',
    flightReleaseAuthorized: false,
  };
}
