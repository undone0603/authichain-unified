import { AttestationStatus, RevocationReason } from "./types";

export interface AttestationStatusEvent {
  id: string;
  attestation_id: string;
  status: AttestationStatus;
  reason?: RevocationReason | string;
  superseded_by?: string;
  created_at: string;
  created_by: string;
  metadata?: Record<string, any>;
}

export const VALID_TRANSITIONS: Record<AttestationStatus, AttestationStatus[]> =
  {
    ISSUED: ["ACTIVE", "REVOKED", "EXPIRED"],
    ACTIVE: ["REVOKED", "EXPIRED", "SUPERSEDED"],
    REVOKED: [],
    EXPIRED: [],
    SUPERSEDED: [],
  };

export function isValidStatusTransition(
  currentStatus: AttestationStatus,
  nextStatus: AttestationStatus
): boolean {
  return VALID_TRANSITIONS[currentStatus]?.includes(nextStatus) ?? false;
}

export function createStatusEvent(
  attestationId: string,
  status: AttestationStatus,
  createdBy: string,
  options?: {
    reason?: RevocationReason | string;
    supersededBy?: string;
    metadata?: Record<string, any>;
  }
): AttestationStatusEvent {
  return {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
    attestation_id: attestationId,
    status,
    reason: options?.reason,
    superseded_by: options?.supersededBy,
    created_at: new Date().toISOString(),
    created_by: createdBy,
    metadata: options?.metadata,
  };
}
