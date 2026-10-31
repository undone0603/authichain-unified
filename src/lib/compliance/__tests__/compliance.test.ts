import { afterAll, beforeAll, describe, it, expect } from 'vitest';
import { generateKeyPairSync, verify } from 'crypto';
import { getRuleset } from '../rules';
import { calculateBOMCost } from '../cost';
import { evaluateSubstantialTransformation } from '../transformation';
import { evaluateClaim } from '../decision';
import { createClaimPassport, verifyClaimPassport } from '../passport';
import { BOMPayload, BOMComponent, SupplierDocumentPayload } from '../types';

describe('Made-in-USA Compliance Engine', () => {
  const previousSigningKey = process.env.AUTHICHAIN_COMPLIANCE_SIGNING_PRIVATE_KEY;
  const keyPair = generateKeyPairSync('ed25519');

  beforeAll(() => {
    process.env.AUTHICHAIN_COMPLIANCE_SIGNING_PRIVATE_KEY = keyPair.privateKey
      .export({ type: 'pkcs8', format: 'pem' })
      .toString();
  });

  afterAll(() => {
    if (previousSigningKey === undefined) {
      delete process.env.AUTHICHAIN_COMPLIANCE_SIGNING_PRIVATE_KEY;
    } else {
      process.env.AUTHICHAIN_COMPLIANCE_SIGNING_PRIVATE_KEY = previousSigningKey;
    }
  });

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
    verificationStatus: 'VERIFIED',
  };

  const invalidSignatureDocument: SupplierDocumentPayload = {
    supplierId: 'sup_2',
    documentType: 'AFFIDAVIT',
    fileUrl: 'https://storage.authichain.com/doc2.pdf',
    documentHash: 'sha256:def456mockhash',
    extractedFields: { origin: 'TW' },
    ocrConfidence: 0.95,
    signatureStatus: 'SIGNATURE_INVALID',
    verificationStatus: 'REJECTED',
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

  it('does not treat an HTS code and a US final-transformation declaration as supported substantial transformation', () => {
    const determination = evaluateSubstantialTransformation(usComponent);
    expect(determination.transformationStatus).toBe('SUBSTANTIAL_TRANSFORMATION_UNKNOWN');
  });

  it('does not count a foreign-manufactured part as US cost because countryOfOrigin says USA', () => {
    const ruleset = getRuleset('FEDERAL_FTC');
    const relabeled: BOMComponent = {
      ...foreignComponent,
      countryOfOrigin: 'USA',
    };
    const cost = calculateBOMCost(
      { productId: 'prod_relabel', version: 'v1.0', components: [relabeled] },
      ruleset
    );
    expect(cost.usManufacturingCost).toBe(0);
    expect(cost.foreignManufacturingCost).toBe(10);
  });

  it('rejects an unknown jurisdiction instead of defaulting to FTC', () => {
    expect(() => getRuleset('MARS')).toThrow(/unknown compliance jurisdiction/i);
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
    expect(evaluation.claimText).toBe('No Made in USA claim');
    expect(evaluation.warnings.length).toBeGreaterThan(0);
  });

  it('does not grant an unqualified claim from a mixed BOM near a 90% cost cutoff', () => {
    const ruleset = getRuleset('FEDERAL_FTC');
    const bom: BOMPayload = {
      productId: 'prod_mixed_unqualified',
      version: 'v1.0',
      components: [usComponent, foreignComponent],
    };
    const cost = calculateBOMCost(bom, ruleset);
    const origins = [
      {
        ...evaluateSubstantialTransformation(usComponent),
        transformationStatus: 'SUBSTANTIAL_TRANSFORMATION_SUPPORTED' as const,
      },
      {
        ...evaluateSubstantialTransformation(foreignComponent),
        transformationStatus: 'SUBSTANTIAL_TRANSFORMATION_SUPPORTED' as const,
      },
    ];
    const foreignDoc: SupplierDocumentPayload = {
      ...validDocument,
      supplierId: 'sup_2',
      documentHash: 'sha256:foreign-doc',
    };
    const evaluation = evaluateClaim(
      bom,
      cost,
      origins,
      [validDocument, foreignDoc],
      ruleset
    );
    expect(evaluation.decision).not.toBe('UNQUALIFIED_ALLOWED');
    expect(evaluation.claimText).toBe('No Made in USA claim');
  });

  it('requires verified evidence for every component supplier', () => {
    const ruleset = getRuleset('FEDERAL_FTC');
    const bom: BOMPayload = { productId: 'prod_missing_evidence', version: 'v1.0', components: [usComponent] };
    const cost = calculateBOMCost(bom, ruleset);
    const origins = [evaluateSubstantialTransformation(usComponent)];

    expect(evaluateClaim(bom, cost, origins, [], ruleset).decision).toBe('REVIEW_REQUIRED');
    expect(
      evaluateClaim(
        bom,
        cost,
        origins,
        [{ ...validDocument, verificationStatus: 'PENDING' }],
        ruleset
      ).decision
    ).toBe('REVIEW_REQUIRED');
  });

  it('blocks claims when substantial transformation is not supported', () => {
    const ruleset = getRuleset('FEDERAL_FTC');
    const bom: BOMPayload = { productId: 'prod_unsupported_origin', version: 'v1.0', components: [usComponent] };
    const cost = calculateBOMCost(bom, ruleset);
    const origins = [
      {
        ...evaluateSubstantialTransformation(usComponent),
        transformationStatus: 'SUBSTANTIAL_TRANSFORMATION_NOT_SUPPORTED' as const,
      },
    ];

    expect(evaluateClaim(bom, cost, origins, [validDocument], ruleset).decision).toBe('BLOCKED');
  });

  it('requires an origin determination for each component', () => {
    const ruleset = getRuleset('FEDERAL_FTC');
    const bom: BOMPayload = { productId: 'prod_missing_origin', version: 'v1.0', components: [usComponent] };
    const cost = calculateBOMCost(bom, ruleset);

    expect(evaluateClaim(bom, cost, [], [validDocument], ruleset).decision).toBe('REVIEW_REQUIRED');
  });

  it('keeps a 100% US BOM in review when substantial transformation is only client-declared', () => {
    const ruleset = getRuleset('FEDERAL_FTC');
    const bom: BOMPayload = {
      productId: 'prod_test_4_review',
      version: 'v1.0',
      components: [usComponent],
    };
    const cost = calculateBOMCost(bom, ruleset);
    const origins = [evaluateSubstantialTransformation(usComponent)];
    const evaluation = evaluateClaim(bom, cost, origins, [validDocument], ruleset);
    expect(evaluation.decision).toBe('REVIEW_REQUIRED');
    expect(evaluation.claimText).toBe('No Made in USA claim');
  });

  it('generates unqualified Made in USA claim for 100% domestic product with verified documents and supported transformation', () => {
    const ruleset = getRuleset('FEDERAL_FTC');
    const bom: BOMPayload = {
      productId: 'prod_test_4',
      version: 'v1.0',
      components: [usComponent],
    };
    const cost = calculateBOMCost(bom, ruleset);
    const origins = [
      {
        ...evaluateSubstantialTransformation(usComponent),
        transformationStatus: 'SUBSTANTIAL_TRANSFORMATION_SUPPORTED' as const,
      },
    ];
    const evaluation = evaluateClaim(bom, cost, origins, [validDocument], ruleset);

    expect(evaluation.decision).toBe('UNQUALIFIED_ALLOWED');
    expect(evaluation.reviewRequired).toBe(false);
    expect(evaluation.claimText).toBe('Made in USA');

    const passport = createClaimPassport('prod_test_4', 'det_123', evaluation, { bom, cost });
    expect(passport.status).toBe('ACTIVE');
    expect(passport.passportId).toBeDefined();
    expect(passport.signature).toBeDefined();
    const publicKeyPem = keyPair.publicKey
      .export({ type: 'spki', format: 'pem' })
      .toString();
    expect(verifyClaimPassport(passport, publicKeyPem)).toBe(true);
    expect(
      verifyClaimPassport(
        { ...passport, metadata: { ...passport.metadata, decision: 'BLOCKED' } },
        publicKeyPem
      )
    ).toBe(false);
    const signature = passport.signature.replace('ed25519:', '');
    expect(
      verify(
        null,
        Buffer.from(passport.passportHash.replace('sha256:', ''), 'hex'),
        keyPair.publicKey,
        Buffer.from(signature, 'base64url')
      )
    ).toBe(true);
  });

  it('records BLOCKED on the passport instead of REVIEW_REQUIRED', () => {
    const ruleset = getRuleset('FEDERAL_FTC');
    const bom: BOMPayload = { productId: 'prod_blocked_passport', version: 'v1.0', components: [usComponent] };
    const cost = calculateBOMCost(bom, ruleset);
    const evaluation = evaluateClaim(
      bom,
      cost,
      [
        {
          ...evaluateSubstantialTransformation(usComponent),
          transformationStatus: 'SUBSTANTIAL_TRANSFORMATION_NOT_SUPPORTED',
        },
      ],
      [validDocument],
      ruleset
    );
    expect(evaluation.decision).toBe('BLOCKED');
    const passport = createClaimPassport('prod_blocked_passport', 'det_blocked', evaluation, { bom, cost });
    expect(passport.status).toBe('BLOCKED');
  });
});
