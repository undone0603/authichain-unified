export type EvidenceStatus =
  | "pending"
  | "valid"
  | "expired"
  | "rejected"
  | "superseded"
  | "review_required";

export type EvidenceCollectionState =
  | "COMPLETE"
  | "INCOMPLETE"
  | "EXPIRED"
  | "REVIEW_REQUIRED";

export interface SupplierEvidenceInput {
  evidenceType: string;
  title: string;
  documentHash: string;
  hashAlgorithm?: string;
  storagePath?: string;
  mimeType?: string;
  issuedAt?: string;
  expiresAt?: string;
  issuerName?: string;
  issuerRef?: string;
  originCountryCode?: string;
  extractedClaims?: Record<string, unknown>;
  validation?: Record<string, unknown>;
}

export function isSha256Digest(value: string): boolean {
  return /^sha256:[0-9a-f]{64}$/i.test(value);
}

export function validateSupplierEvidence(input: SupplierEvidenceInput): string[] {
  const errors: string[] = [];
  if (!input.evidenceType?.trim()) errors.push("evidenceType is required");
  if (!input.title?.trim()) errors.push("title is required");
  if (!isSha256Digest(input.documentHash)) {
    errors.push("documentHash must be sha256:<64 lowercase hexadecimal characters>");
  }
  if (input.issuedAt && Number.isNaN(Date.parse(input.issuedAt))) {
    errors.push("issuedAt must be an ISO-8601 timestamp");
  }
  if (input.expiresAt && Number.isNaN(Date.parse(input.expiresAt))) {
    errors.push("expiresAt must be an ISO-8601 timestamp");
  }
  if (input.issuedAt && input.expiresAt && Date.parse(input.expiresAt) < Date.parse(input.issuedAt)) {
    errors.push("expiresAt must not precede issuedAt");
  }
  return errors;
}

export function getEvidenceCollectionState(
  evidence: Array<{ status: EvidenceStatus; expires_at?: string | null }>,
  now = new Date(),
): EvidenceCollectionState {
  if (evidence.some(item => item.status === "review_required" || item.status === "rejected")) {
    return "REVIEW_REQUIRED";
  }

  const valid = evidence.filter(item => item.status === "valid");
  if (valid.some(item => item.expires_at && Date.parse(item.expires_at) <= now.getTime())) {
    return "EXPIRED";
  }

  return valid.length > 0 && valid.every(item => !item.expires_at || Date.parse(item.expires_at) > now.getTime())
    ? "COMPLETE"
    : "INCOMPLETE";
}
