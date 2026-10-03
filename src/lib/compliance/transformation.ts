import { BOMComponent, OriginDeterminationResult, SubstantialTransformationStatus } from './types';

function isUsCountry(value: string | undefined): boolean {
  const v = (value ?? '').trim().toUpperCase();
  return v === 'US' || v === 'USA';
}

export function evaluateSubstantialTransformation(
  component: BOMComponent
): OriginDeterminationResult {
  const steps = [
    `Received component ${component.componentName} (${component.componentId})`,
    `Origin declared as ${component.countryOfOrigin}, manufacturing in ${component.manufacturingCountry}`,
    `Final transformation country: ${component.finalTransformationCountry}`,
  ];

  const isUsTransformation = isUsCountry(component.finalTransformationCountry);
  const hasHts = Boolean(component.htsCode && component.htsCode.trim().length > 0);
  const hasValidSupplier = Boolean(component.supplierId && component.supplierId.trim().length > 0);

  let status: SubstantialTransformationStatus = 'SUBSTANTIAL_TRANSFORMATION_UNKNOWN';
  let confidence = 0.3;
  let reasoning =
    'Client-declared HTS, supplier, or processing location is not independent CBP evidence. Failing closed to UNKNOWN.';

  if (!isUsTransformation) {
    status = 'SUBSTANTIAL_TRANSFORMATION_NOT_SUPPORTED';
    confidence = 0.9;
    reasoning = 'Component final manufacturing and transformation occurred outside the United States.';
  }

  return {
    componentId: component.componentId,
    htsCode: component.htsCode,
    manufacturingProcess: `${component.componentName} assembly / processing`,
    processingSteps: steps,
    finalTransformationCountry: component.finalTransformationCountry,
    transformationStatus: status,
    confidence,
    reasoning,
    evidenceManifest: {
      hasHts,
      hasValidSupplier,
      evaluatedAt: new Date().toISOString(),
    },
  };
}
