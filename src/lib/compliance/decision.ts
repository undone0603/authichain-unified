import {
  BOMPayload,
  ClaimDecision,
  ClaimEvaluationResult,
  CostCalculationResult,
  OriginDeterminationResult,
  RulesetVersion,
  SupplierDocumentPayload,
} from './types';

export function evaluateClaim(
  bom: BOMPayload,
  cost: CostCalculationResult,
  origins: OriginDeterminationResult[],
  documents: SupplierDocumentPayload[],
  ruleset: RulesetVersion
): ClaimEvaluationResult {
  const warnings: string[] = [];
  let reviewRequired = true;
  let decision: ClaimDecision = 'REVIEW_REQUIRED';

  // 1. Check for missing documents or unverified signatures
  const hasUnverifiedDocs = documents.some(
    (d) => d.signatureStatus === 'SIGNATURE_INVALID' || d.signatureStatus === 'SIGNATURE_NOT_DETECTED'
  );
  if (hasUnverifiedDocs) {
    warnings.push('One or more supplier documents have invalid or missing signatures. Failing closed.');
    return {
      decision: 'BLOCKED',
      claimText: 'Made in USA',
      confidence: 0.1,
      evidenceVector: {
        documentConfidence: 0.2,
        ocrConfidence: 0.5,
        signatureConfidence: 0.1,
        supplierConfidence: 0.4,
        originConfidence: 0.3,
        costConfidence: 0.5,
        htsConfidence: 0.4,
        transformationConfidence: 0.3,
        ruleConfidence: 0.9,
      },
      warnings,
      reviewRequired: true,
    };
  }

  // 2. Check cost threshold against ruleset parameters
  const threshold = ruleset.parameters.unqualifiedThresholdPercent;
  const usContent = cost.usContentPercentage;

  // Confidence calculations
  const avgOcrConfidence = documents.length > 0
    ? documents.reduce((acc, d) => acc + d.ocrConfidence, 0) / documents.length
    : 0.8;

  const avgOriginConfidence = origins.length > 0
    ? origins.reduce((acc, o) => acc + o.confidence, 0) / origins.length
    : 0.5;

  const evidenceVector = {
    documentConfidence: documents.length > 0 ? 0.9 : 0.4,
    ocrConfidence: avgOcrConfidence,
    signatureConfidence: 0.95,
    supplierConfidence: 0.85,
    originConfidence: avgOriginConfidence,
    costConfidence: 0.99,
    htsConfidence: 0.8,
    transformationConfidence: avgOriginConfidence,
    ruleConfidence: 1.0,
  };

  const overallConfidence = Number(
    (
      (evidenceVector.documentConfidence +
        evidenceVector.ocrConfidence +
        evidenceVector.signatureConfidence +
        evidenceVector.supplierConfidence +
        evidenceVector.originConfidence +
        evidenceVector.costConfidence +
        evidenceVector.htsConfidence +
        evidenceVector.transformationConfidence +
        evidenceVector.ruleConfidence) /
      9
    ).toFixed(4)
  );

  // Fail-closed checks on unknown substantial transformation
  const hasUnknownTransformation = origins.some(
    (o) => o.transformationStatus === 'SUBSTANTIAL_TRANSFORMATION_UNKNOWN'
  );

  if (hasUnknownTransformation) {
    warnings.push('Substantial transformation status is unknown or unsupported for one or more components. Failing closed to REVIEW_REQUIRED.');
    return {
      decision: 'REVIEW_REQUIRED',
      claimText: 'Made in USA',
      confidence: overallConfidence,
      evidenceVector,
      warnings,
      reviewRequired: true,
    };
  }

  if (usContent >= threshold) {
    decision = 'UNQUALIFIED_ALLOWED';
    reviewRequired = false;
  } else if (usContent >= (ruleset.parameters.historicalReferenceThresholdPercent || 75.0)) {
    decision = 'QUALIFIED_ALLOWED';
    warnings.push(`US content (${usContent}%) meets historical reference threshold but is below unqualified threshold (${threshold}%). Qualified claim permitted with disclosure.`);
    reviewRequired = true;
  } else {
    decision = 'BLOCKED';
    warnings.push(`US content (${usContent}%) is insufficient for unqualified or standard qualified claims under ${ruleset.citation}.`);
    reviewRequired = true;
  }

  return {
    decision,
    claimText: decision === 'UNQUALIFIED_ALLOWED' ? 'Made in USA' : `Made in USA with ${usContent}% U.S. content`,
    confidence: overallConfidence,
    evidenceVector,
    warnings,
    reviewRequired,
  };
}
