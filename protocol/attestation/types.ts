export type IdentityProfile =
  "pharma-dscsa" | "medical-device-udi" | "generic-provenance" | "government";

export interface Identity {
  profile: IdentityProfile;
  gtin14?: string;
  udiDi?: string;
  udiPi?: string;
  serial: string;
  lot?: string;
  expirationDate?: string;
}

export interface Evidence {
  type:
    "manufacturing" | "inspection" | "shipment" | "ownership" | "ai-analysis";
  issuer: string;
  timestamp: string;
  digest: string; // sha256 of the evidence content
  sourceUrl?: string;
  metadata?: Record<string, any>;
}

export interface Attestation {
  objectId: string;
  decision: "verified" | "anomaly" | "blocked" | "expired";
  issuer: string;
  subject: Identity;
  evidence: Evidence[];
  status: "active" | "revoked" | "expired";
  verifiedAt: string;
  signature: {
    alg: "EdDSA";
    kid: string;
    value: string;
  };
}

export interface VerificationResult {
  decision: "verified" | "invalid";
  reason: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  checks: {
    signatureValid: boolean;
    issuerTrusted: boolean;
    identityValid: boolean;
    evidenceIntact: boolean;
    statusActive: boolean;
  };
}
