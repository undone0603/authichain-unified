import type { VerificationDecision } from "./verification-decision";

/**
 * Decision for a lookup that only consulted AuthiChain's own registry (a
 * certificate or product row), with no signed attestation in hand.
 *
 * A row in our database is never a positive verification: anyone who can
 * copy an identifier can produce a match. So this is always valid=false, and
 * it uses the same vocabulary as /api/v1/attestation/verify:
 *
 * - no row          → not_found (never "counterfeit")
 * - revoked row     → revoked
 * - expired row     → expired
 * - anything else   → indeterminate, with the canonical endpoint as next step
 *
 * `anchored` reports whether a transaction hash is recorded. It is not a
 * claim that the chain was read.
 */

export const REGISTRY_DECISION_CONTRACT = "AuthiChain Verification Decision v1";
export const CANONICAL_VERIFY_PATH = "/api/v1/attestation/verify";

export type RegistryRecord = {
  status?: string | null;
  expiresAt?: Date | string | null;
  blockchainTxHash?: string | null;
};

export type RegistryDecision = {
  valid: false;
  decision: Extract<VerificationDecision, "not_found" | "revoked" | "expired" | "indeterminate">;
  decision_contract: typeof REGISTRY_DECISION_CONTRACT;
  reasons: string[];
  registry: {
    found: boolean;
    status: string | null;
    expires_at: string | null;
    anchored: boolean;
  };
  next_step: string;
  message: string;
};

function iso(value: Date | string | null | undefined): string | null {
  if (!value) return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isFinite(d.getTime()) ? d.toISOString() : null;
}

export function registryLookupDecision(
  record: RegistryRecord | null | undefined,
  now: number = Date.now(),
): RegistryDecision {
  const next_step = `To verify, POST the signed attestation (jws) to ${CANONICAL_VERIFY_PATH}.`;
  if (!record) {
    return {
      valid: false,
      decision: "not_found",
      decision_contract: REGISTRY_DECISION_CONTRACT,
      reasons: ["identifier_or_attestation_not_found"],
      registry: { found: false, status: null, expires_at: null, anchored: false },
      next_step,
      message:
        "No record in the AuthiChain registry. That is not evidence the item is counterfeit.",
    };
  }
  const status = typeof record.status === "string" && record.status ? record.status.toLowerCase() : null;
  const expiresAt = iso(record.expiresAt);
  const registry = {
    found: true,
    status,
    expires_at: expiresAt,
    anchored: typeof record.blockchainTxHash === "string" && record.blockchainTxHash.trim().length > 0,
  };
  const base = {
    valid: false as const,
    decision_contract: REGISTRY_DECISION_CONTRACT as typeof REGISTRY_DECISION_CONTRACT,
    registry,
    next_step,
  };
  if (status === "revoked") {
    return {
      ...base,
      decision: "revoked",
      reasons: ["registry_status_revoked"],
      message: "The issuer revoked this record.",
    };
  }
  if (status === "expired" || (expiresAt !== null && Date.parse(expiresAt) <= now)) {
    return {
      ...base,
      decision: "expired",
      reasons: [status === "expired" ? "registry_status_expired" : "expired"],
      message: "This record has expired.",
    };
  }
  return {
    ...base,
    decision: "indeterminate",
    reasons: ["registry_record_only", "no_signed_attestation_presented"],
    message:
      "A matching record exists in the AuthiChain registry. A record alone does not verify the item in hand.",
  };
}
