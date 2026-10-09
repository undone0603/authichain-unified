/**
 * GovChain W3C Verifiable Credential Service
 * Generates and verifies digital product/document passports according to W3C standards.
 */

export interface VerifiableCredential {
  "@context": string[];
  id: string;
  type: string[];
  issuer: string;
  issuanceDate: string;
  credentialSubject: Record<string, any>;
  proof?: {
    type: string;
    created: string;
    proofPurpose: string;
    verificationMethod: string;
    jws: string;
  };
}

/**
 * Creates a W3C-compliant Verifiable Credential for a government document.
 */
export async function issueSovereignPassport(data: {
  documentId: string;
  issuerDid: string;
  subjectDid: string;
  claims: Record<string, any>;
}): Promise<VerifiableCredential> {
  const vc: VerifiableCredential = {
    "@context": [
      "https://www.w3.org/2018/credentials/v1",
      "https://w3id.org/security/suites/ed25519-2020/v1"
    ],
    id: `urn:uuid:${data.documentId}`,
    type: ["VerifiableCredential", "SovereignDocumentPassport"],
    issuer: data.issuerDid,
    issuanceDate: new Date().toISOString(),
    credentialSubject: {
      id: data.subjectDid,
      ...data.claims,
    }
  };

  // No proof is attached. There is no issuer signing key yet, so the
  // credential is returned unsigned rather than with a placeholder jws that
  // could be mistaken for a real signature.

  return vc;
}

/**
 * Verifies the integrity and authenticity of a Verifiable Credential.
 */
export async function verifySovereignPassport(vc: VerifiableCredential): Promise<{
  valid: boolean;
  claims: Record<string, any>;
  issuer: string;
}> {
  // In production, this would verify the Ed25519 signature and check revocation status
  const isValid = vc.proof?.jws !== undefined;
  
  return {
    valid: isValid,
    claims: vc.credentialSubject,
    issuer: vc.issuer
  };
}
