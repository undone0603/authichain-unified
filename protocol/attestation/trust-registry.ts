export const ISSUER_TYPES = [
  "government",
  "manufacturer",
  "brand",
  "laboratory",
  "service",
] as const;

export const ISSUER_STATUSES = ["trusted", "suspended", "retired"] as const;

export type IssuerType = (typeof ISSUER_TYPES)[number];
export type IssuerStatus = (typeof ISSUER_STATUSES)[number];

export interface AttestationIssuer {
  issuerId: string;
  organization: string;
  jurisdiction?: string;
  issuerType: IssuerType;
  jwksUri: string;
  status: IssuerStatus;
  validFrom: string;
  validUntil?: string;
  authorityUri?: string;
}

export interface AttestationStatusRecord {
  attestationId: string;
  claimStatus: "active" | "revoked" | "expired" | "superseded";
  effectiveAt: string;
  reasonCode?: string;
  issuerId: string;
  eventId: string;
}

export interface AttestationStatusEvent {
  eventId: string;
  eventType: "attestation.issued" | "attestation.revoked" | "attestation.expired" | "attestation.superseded";
  attestationId: string;
  issuerId: string;
  occurredAt: string;
  reasonCode?: string;
  subjectHash?: string;
  evidenceDigest?: string;
}

export function isIssuerTrustedAt(
  issuer: AttestationIssuer,
  at: Date = new Date(),
): boolean {
  if (issuer.status !== "trusted") return false;
  const when = at.getTime();
  const from = Date.parse(issuer.validFrom);
  const until = issuer.validUntil ? Date.parse(issuer.validUntil) : Infinity;
  return Number.isFinite(from) && when >= from && when < until;
}

export function currentClaimStatus(
  record: AttestationStatusRecord | undefined,
  now: Date = new Date(),
): AttestationStatusRecord["claimStatus"] {
  if (!record) return "active";
  if (record.claimStatus === "active" && Date.parse(record.effectiveAt) > now.getTime()) {
    return "active";
  }
  return record.claimStatus;
}
