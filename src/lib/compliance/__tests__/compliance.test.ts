import { describe, it, expect } from 'vitest';
import { getRuleset } from '../rules';
import { calculateBOMCost } from '../cost';
import { evaluateSubstantialTransformation } from '../transformation';
import { evaluateClaim } from '../decision';
import { createClaimPassport } from '../passport';
import { BOMPayload, BOMComponent, SupplierDocumentPayload } from '../types';

describe('Made-in-USA Compliance Engine', () => {
  const usComponent: BOMComponent = {
    componentId: 'comp_steel',
    componentName: 'US Rolled Steel',
    quantity: 1,
    unitCost: 100,
    currency: 'USD',
    supplierId: 'sup_1',
    supplierName: 'American Steel Corp',
    supplierCountry: 'USA',
    manufacturingCountry: 'USA',
    laborCost: 20,
    materialCost: 70,
    overheadCost: 10,
    freightCost: 0,
    htsCode: '7208.36',
    countryOfOrigin: 'USA',
    finalTransformationCountry: 'USA',
    documentationId: 'doc_1',
  };

  const foreignComponent: BOMComponent = {
    componentId: 'comp_chip',
    componentName: 'Imported Microchip',
    quantity: 1,
    unitCost: 10,
    currency: 'USD',
    supplierId: 'sup_2',
    supplierName: 'Global Semi Ltd',
    supplierCountry: 'TW',
    manufacturingCountry: 'TW',
    laborCost: 2,
    materialCost: 7,
    overheadCost: 1,
    freightCost: 0,
    htsCode: '8542.31',
    countryOfOrigin: 'TW',
    finalTransformationCountry: 'TW',
    documentationId: 'doc_2',
  };

  const validDocument: SupplierDocumentPayload = {
    supplierId: 'sup_1',
    documentType: 'AFFIDAVIT',
    fileUrl: 'https://storage.authichain.com/doc1.pdf',
    documentHash: 'sha256:abc123mockhash',
    extractedFields: { origin: 'USA' },
    ocrConfidence: 0.98,
    signatureStatus: 'SIGNATURE_VERIFIED',
  };

  const invalidSignatureDocument: SupplierDocumentPayload = {
    supplierId: 'sup_2',
    documentType: 'AFFIDAVIT',
    fileUrl: 'https://storage.authichain.com/doc2.pdf',
    documentHash: 'sha256:def456mockhash',
    extractedFields: { origin: 'TW' },
    ocrConfidence: 0.95,
    signatureStatus: 'SIGNATURE_INVALID',
  };

  it('calculates 100% US BOM cost correctly', () => {
    const ruleset = getRuleset('FEDERAL_FTC');
    const bom: BOMPayload = {
      productId: 'prod_test_1',
      version: 'v1.0',
      components: [usComponent],
    };

    const cost = calculateBOMCost(bom, ruleset);
    expect(cost.totalManufacturingCost).toBe(100);
    expect(cost.usManufacturingCost).toBe(100);
    expect(cost.usContentPercentage).toBe(100);
  });

  it('calculates mixed BOM cost correctly', () => {
    const ruleset = getRuleset('FEDERAL_FTC');
    const bom: BOMPayload = {
      productId: 'prod_test_2',
      version: 'v1.0',
      components: [usComponent, foreignComponent], // 100 vs 10 -> ~90.9% US
    };

    const cost = calculateBOMCost(bom, ruleset);
    expect(cost.totalManufacturingCost).toBe(110);
    expect(cost.usManufacturingCost).toBe(100);
    expect(cost.foreignManufacturingCost).toBe(10);
    expect(cost.usContentPercentage).toBeCloseTo(90.9091, 2);
  });

  it('evaluates substantial transformation successfully', () => {
    const determination = evaluateSubstantialTransformation(usComponent);
    expect(determination.transformationStatus).toBe('SUBSTANTIAL_TRANSFORMATION_SUPPORTED');
    expect(determination.confidence).toBeGreaterThan(0.8);
  });

  it('fails closed to BLOCKED when signature is invalid', () => {
    const ruleset = getRuleset('FEDERAL_FTC');
    const bom: BOMPayload = {
      productId: 'prod_test_3',
      version: 'v1.0',
      components: [usComponent],
    };
    const cost = calculateBOMCost(bom, ruleset);
    const origins = [evaluateSubstantialTransformation(usComponent)];
    const evaluation = evaluateClaim(bom, cost, origins, [invalidSignatureDocument], ruleset);

    expect(evaluation.decision).toBe('BLOCKED');
    expect(evaluation.warnings.length).toBeGreaterThan(0);
  });

  it('generates unqualified Made in USA claim for 100% domestic product with valid documents', () => {
    const ruleset = getRuleset('FEDERAL_FTC');
    const bom: BOMPayload = {
      productId: 'prod_test_4',
      version: 'v1.0',
      components: [usComponent],
    };
    const cost = calculateBOMCost(bom, ruleset);
    const origins = [evaluateSubstantialTransformation(usComponent)];
    const evaluation = evaluateClaim(bom, cost, origins, [validDocument], ruleset);

    expect(evaluation.decision).toBe('UNQUALIFIED_ALLOWED');
    expect(evaluation.reviewRequired).toBe(false);

    const passport = createClaimPassport('prod_test_4', 'det_123', evaluation, { bom, cost });
    expect(passport.status).toBe('ACTIVE');
    expect(passport.passportId).toBeDefined();
    expect(passport.signature).toBeDefined();
  });
});
