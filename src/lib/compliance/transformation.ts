import { BOMComponent, OriginDeterminationResult, SubstantialTransformationStatus } from './types';

export function evaluateSubstantialTransformation(
  component: BOMComponent
): OriginDeterminationResult {
  const steps = [
    `Received component ${component.componentName} (${component.componentId})`,
    `Origin declared as ${component.countryOfOrigin}, manufacturing in ${component.manufacturingCountry}`,
    `Final transformation country: ${component.finalTransformationCountry}`,
  ];

  const isUsTransformation = 
    component.finalTransformationCountry.toUpperCase() === 'USA' ||
    component.finalTransformationCountry.toUpperCase() === 'US';

  const hasHts = Boolean(component.htsCode && component.htsCode.trim().length > 0);
  const hasValidSupplier = Boolean(component.supplierId && component.supplierId.trim().length > 0);

  let status: SubstantialTransformationStatus = 'SUBSTANTIAL_TRANSFORMATION_UNKNOWN';
  let confidence = 0.5;
  let reasoning = 'Insufficient processing and transformation evidence.';

  if (isUsTransformation && hasHts && hasValidSupplier) {
    status = 'SUBSTANTIAL_TRANSFORMATION_SUPPORTED';
    confidence = 0.85;
    reasoning = 'Component underwent final transformation in the U.S. with HTS classification and verified supplier record.';
  } else if (!isUsTransformation) {
    status = 'SUBSTANTIAL_TRANSFORMATION_NOT_SUPPORTED';
    confidence = 0.9;
    reasoning = 'Component final manufacturing and transformation occurred outside the United States.';
  } else {
    status = 'SUBSTANTIAL_TRANSFORMATION_UNKNOWN';
    confidence = 0.3;
    reasoning = 'Missing HTS code or supplier verification for domestic transformation claim. Failing closed.';
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
