import {
  BOMPayload,
  ClaimDecision,
  ClaimEvaluationResult,
  CostCalculationResult,
  OriginDeterminationResult,
  RulesetVersion,
  SupplierDocumentPayload,
} from './types';

export const NO_MADE_IN_USA_CLAIM = 'No Made in USA claim';

function isUsCountry(value: string | undefined): boolean {
  const v = (value ?? '').trim().toUpperCase();
  return v === 'US' || v === 'USA';
}

function result(
  decision: ClaimDecision,
  warnings: string[],
  extras: Partial<ClaimEvaluationResult> = {}
): ClaimEvaluationResult {
  const reviewRequired = decision !== 'UNQUALIFIED_ALLOWED';
  return {
    decision,
    claimText:
      decision === 'UNQUALIFIED_ALLOWED' ? 'Made in USA' : NO_MADE_IN_USA_CLAIM,
    confidence: extras.confidence ?? 0.1,
    evidenceVector: extras.evidenceVector ?? {
      documentConfidence: 0,
      ocrConfidence: 0,
      signatureConfidence: 0,
      supplierConfidence: 0,
      originConfidence: 0,
      costConfidence: 0,
      htsConfidence: 0,
      transformationConfidence: 0,
      ruleConfidence: 1,
    },
    warnings,
    reviewRequired,
  };
}

export function evaluateClaim(
  bom: BOMPayload,
  cost: CostCalculationResult,
  origins: OriginDeterminationResult[],
  documents: SupplierDocumentPayload[],
  ruleset: RulesetVersion
): ClaimEvaluationResult {
  const warnings: string[] = [];

  const hasInvalidDocs = documents.some(
    d =>
      d.signatureStatus === 'SIGNATURE_INVALID' ||
      d.verificationStatus === 'REJECTED'
  );
  if (hasInvalidDocs) {
    warnings.push(
      'One or more supplier documents failed verification. Failing closed.'
    );
    return result('BLOCKED', warnings);
  }

  const supplierIds = new Set(
    bom.components.flatMap(component => component.supplierId?.trim() || [])
  );
  const verifiedSupplierIds = new Set(
    documents
      .filter(
        document =>
          document.signatureStatus === 'SIGNATURE_VERIFIED' &&
          document.verificationStatus === 'VERIFIED'
      )
      .map(document => document.supplierId.trim())
  );
  const verifiedDocuments = documents.filter(
    document =>
      document.signatureStatus === 'SIGNATURE_VERIFIED' &&
      document.verificationStatus === 'VERIFIED'
  );
  const suppliersWithoutVerifiedDocuments = [...supplierIds].filter(
    supplierId => !verifiedSupplierIds.has(supplierId)
  );
  const hasComponentsWithoutSupplier = bom.components.some(
    component => !component.supplierId?.trim()
  );

  if (
    supplierIds.size === 0 ||
    suppliersWithoutVerifiedDocuments.length > 0 ||
    hasComponentsWithoutSupplier
  ) {
    warnings.push(
      'Verified, signed supplier documentation is required for every BOM component. Failing closed to REVIEW_REQUIRED.'
    );
    return result('REVIEW_REQUIRED', warnings, { confidence: 0.2 });
  }

  const avgOcrConfidence =
    verifiedDocuments.length > 0
      ? verifiedDocuments.reduce((acc, d) => acc + d.ocrConfidence, 0) /
        verifiedDocuments.length
      : 0;

  const avgOriginConfidence =
    origins.length > 0
      ? origins.reduce((acc, o) => acc + o.confidence, 0) / origins.length
      : 0;

  const evidenceVector = {
    documentConfidence: verifiedDocuments.length > 0 ? 0.9 : 0,
    ocrConfidence: avgOcrConfidence,
    signatureConfidence: avgOcrConfidence,
    supplierConfidence: verifiedDocuments.length > 0 ? 0.85 : 0,
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

  const hasUnsupportedTransformation =
    ruleset.parameters.requireSubstantialTransformation &&
    origins.some(
      o => o.transformationStatus === 'SUBSTANTIAL_TRANSFORMATION_NOT_SUPPORTED'
    );
  if (hasUnsupportedTransformation) {
    warnings.push(
      'Substantial transformation is not supported for one or more components. Failing closed.'
    );
    return result('BLOCKED', warnings, { confidence: overallConfidence, evidenceVector });
  }

  const componentsWithoutOriginDeterminations = bom.components.filter(
    component =>
      !origins.some(origin => origin.componentId === component.componentId)
  );
  if (
    ruleset.parameters.requireSubstantialTransformation &&
    componentsWithoutOriginDeterminations.length > 0
  ) {
    warnings.push(
      'Origin determination is missing for one or more BOM components. Failing closed to REVIEW_REQUIRED.'
    );
    return result('REVIEW_REQUIRED', warnings, {
      confidence: overallConfidence,
      evidenceVector,
    });
  }

  const hasUnknownTransformation =
    ruleset.parameters.requireSubstantialTransformation &&
    origins.some(
      o => o.transformationStatus === 'SUBSTANTIAL_TRANSFORMATION_UNKNOWN'
    );

  if (hasUnknownTransformation) {
    warnings.push(
      'Substantial transformation status is unknown for one or more components. Failing closed to REVIEW_REQUIRED.'
    );
    return result('REVIEW_REQUIRED', warnings, {
      confidence: overallConfidence,
      evidenceVector,
    });
  }

  if (ruleset.parameters.requireFinalAssemblyInUs) {
    const missingUsAssembly = bom.components.some(
      component => !isUsCountry(component.finalTransformationCountry)
    );
    if (missingUsAssembly) {
      warnings.push(
        'Final assembly in the United States is required and is missing for one or more components. Failing closed.'
      );
      return result('BLOCKED', warnings, {
        confidence: overallConfidence,
        evidenceVector,
      });
    }
  }

  const hasForeignContent =
    cost.foreignManufacturingCost > 0 ||
    bom.components.some(
      component =>
        !isUsCountry(component.manufacturingCountry) ||
        !isUsCountry(component.countryOfOrigin)
    );

  if (hasForeignContent) {
    warnings.push(
      `Foreign content is present (US manufacturing cost share ${cost.usContentPercentage}%). Unqualified Made in USA is not a cost-percentage test under ${ruleset.citation}. Historical ${ruleset.parameters.historicalReferenceThresholdPercent ?? 75}% is reference-only and does not permit a claim.`
    );
    return result('REVIEW_REQUIRED', warnings, {
      confidence: overallConfidence,
      evidenceVector,
    });
  }

  return result('UNQUALIFIED_ALLOWED', warnings, {
    confidence: overallConfidence,
    evidenceVector,
  });
}
