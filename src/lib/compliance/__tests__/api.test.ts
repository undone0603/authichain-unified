import { describe, it, expect } from 'vitest';
import { getRuleset } from '../rules';
import { calculateBOMCost } from '../cost';
import { evaluateSubstantialTransformation } from '../transformation';
import { evaluateClaim } from '../decision';

describe('Compliance Evaluation API Pipeline', () => {
  it('processes a complete evaluation request payload end-to-end', () => {
    const ruleset = getRuleset('FEDERAL_FTC');
    const bom = {
      productId: 'prod_api_test',
      version: 'v1.0',
      components: [
        {
          componentId: 'comp_1',
          componentName: 'American Aluminum',
          quantity: 1,
          unitCost: 150,
          currency: 'USD',
          supplierId: 'sup_us',
          supplierCountry: 'USA',
          manufacturingCountry: 'USA',
          laborCost: 30,
          materialCost: 100,
          overheadCost: 20,
          freightCost: 0,
          htsCode: '7601.10',
          countryOfOrigin: 'USA',
          finalTransformationCountry: 'USA',
        },
      ],
    };

    const documents = [
      {
        supplierId: 'sup_us',
        documentType: 'AFFIDAVIT' as const,
        fileUrl: 'https://storage.authichain.com/doc.pdf',
        documentHash: 'sha256:apimockhash',
        extractedFields: { origin: 'USA' },
        ocrConfidence: 0.99,
        signatureStatus: 'SIGNATURE_VERIFIED' as const,
        verificationStatus: 'VERIFIED' as const,
      },
    ];

    const costCalculation = calculateBOMCost(bom, ruleset);
    const originDeterminations = bom.components.map((c) => evaluateSubstantialTransformation(c));
    const claimEvaluation = evaluateClaim(bom, costCalculation, originDeterminations, documents, ruleset);

    expect(claimEvaluation.decision).toBe('REVIEW_REQUIRED');
    expect(claimEvaluation.claimText).toBe('No Made in USA claim');
  });
});
