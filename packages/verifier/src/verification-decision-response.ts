import type { VerificationDecision } from "./verification-decision";

export type VerificationDecisionResponse = {
  decision: VerificationDecision;
  valid: boolean;
  reasons: string[];
  status: "active" | "revoked" | "expired" | "superseded" | "unknown";
  cryptographic_status: "valid" | "invalid" | "unknown";
  issuer_status: string;
  overall_valid: boolean;
};

/**
 * Stable machine-facing projection for every AuthiChain consumer surface.
 * DPP, QRON, vertical applications, and AgentZ should consume this shape
 * instead of inventing their own authenticity vocabulary.
 */
export function projectVerificationDecision(
  value: VerificationDecisionResponse,
): VerificationDecisionResponse {
  return {
    decision: value.decision,
    valid: value.valid,
    reasons: [...value.reasons],
    status: value.status,
    cryptographic_status: value.cryptographic_status,
    issuer_status: value.issuer_status,
    overall_valid: value.overall_valid,
  };
}

export function isVerificationDecisionResponse(value: unknown): value is VerificationDecisionResponse {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Record<string, unknown>;
  const decisions = new Set([
    "verified",
    "warning",
    "blocked",
    "revoked",
    "expired",
    "not_found",
    "risk",
    "indeterminate",
  ]);
  const statuses = new Set(["active", "revoked", "expired", "superseded", "unknown"]);
  return (
    typeof candidate.decision === "string" && decisions.has(candidate.decision) &&
    typeof candidate.valid === "boolean" &&
    Array.isArray(candidate.reasons) && candidate.reasons.every(reason => typeof reason === "string") &&
    typeof candidate.status === "string" && statuses.has(candidate.status) &&
    (candidate.cryptographic_status === "valid" || candidate.cryptographic_status === "invalid" || candidate.cryptographic_status === "unknown") &&
    typeof candidate.issuer_status === "string" &&
    typeof candidate.overall_valid === "boolean"
  );
}
