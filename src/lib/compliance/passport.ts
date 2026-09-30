import { createHash } from 'crypto';
import { ClaimEvaluationResult, ClaimPassport, PassportStatus } from './types';

export function generatePassportHash(
  productId: string,
  determinationId: string,
  evidenceManifest: any
): { documentHash: string; evidenceManifestHash: string; passportHash: string; signature: string } {
  const manifestString = JSON.stringify(evidenceManifest);
  const evidenceManifestHash = createHash('sha256').update(manifestString).digest('hex');

  const docPayload = `${productId}:${determinationId}:${evidenceManifestHash}:${Date.now()}`;
  const documentHash = createHash('sha256').update(docPayload).digest('hex');

  const passportPayload = `${documentHash}:${evidenceManifestHash}:AuthiChain Compliance Issuer`;
  const passportHash = createHash('sha256').update(passportPayload).digest('hex');

  // Sign using HMAC-like deterministic seal hash
  const signature = createHash('sha256').update(`sig:${passportHash}:authichain-compliance-secret`).digest('hex');

  return {
    documentHash: `sha256:${documentHash}`,
    evidenceManifestHash: `sha256:${evidenceManifestHash}`,
    passportHash: `sha256:${passportHash}`,
    signature: `0x${signature}`,
  };
}

export function createClaimPassport(
  productId: string,
  determinationId: string,
  evaluation: ClaimEvaluationResult,
  evidenceManifest: any,
  client?: string
): ClaimPassport {
  const passportId = `miusa_${Math.random().toString(36).substring(2, 10)}_${Date.now()}`;
  const hashes = generatePassportHash(productId, determinationId, evidenceManifest);

  const status: PassportStatus = evaluation.reviewRequired ? 'REVIEW_REQUIRED' : 'ACTIVE';

  return {
    passportId,
    productId,
    determinationId,
    issuer: 'AuthiChain Compliance Engine',
    client,
    status,
    documentHash: hashes.documentHash,
    evidenceManifestHash: hashes.evidenceManifestHash,
    passportHash: hashes.passportHash,
    signature: hashes.signature,
    metadata: {
      claim: evaluation.claimText,
      decision: evaluation.decision,
      confidence: evaluation.confidence,
      warnings: evaluation.warnings,
      disclaimer: 'AuthiChain substantiation record. Not legal advice or government certification.',
    },
    createdAt: new Date().toISOString(),
  };
}
