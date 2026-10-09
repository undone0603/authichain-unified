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

export const SIGNATURE_CHECK_UNAVAILABLE = "Signature checking is not available yet";

/**
 * Verifies a Verifiable Credential.
 *
 * Fails closed. No issuer key can be resolved for did:authichain issuers and
 * issueSovereignPassport() does not produce a real signature, so no credential
 * can be verified against a real key today. Every credential, including one
 * carrying a made-up jws, returns valid:false. Claims and issuer are not echoed
 * back, so an unverified credential's contents never appear in a "verify" result.
 */
export async function verifySovereignPassport(_vc: unknown): Promise<{
  valid: false;
  claims: null;
  issuer: null;
  message: string;
}> {
  return {
    valid: false,
    claims: null,
    issuer: null,
    message: SIGNATURE_CHECK_UNAVAILABLE,
  };
}
