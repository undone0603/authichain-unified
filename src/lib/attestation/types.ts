export type AttestationStatus =
  "ISSUED" | "ACTIVE" | "REVOKED" | "EXPIRED" | "SUPERSEDED";

export type RevocationReason =
  | "KEY_COMPROMISE"
  | "SUPERSEDED"
  | "CESSATION_OF_OPERATION"
  | "PRIVILEGE_WITHDRAWN"
  | "UNSPECIFIED";

export interface AttestationHeader {
  alg: "Ed25519" | "ES256" | "HS256";
  typ: "AuthiChain-Attestation/v1";
  kid?: string;
}

export interface AttestationPayload {
  id: string;
  issuer: string;
  subject: string;
  schemaVersion: string;
  claims: Record<string, any>;
  issuedAt: string;
  expiresAt?: string;
  nonce?: string;
}

export interface SignedAttestation {
  header: AttestationHeader;
  payload: AttestationPayload;
  signature: string;
  publicKey: string;
}

export interface VerificationResult {
  valid: boolean;
  status: AttestationStatus;
  reason?: string;
  attestation?: SignedAttestation;
  verifiedAt: string;
}
