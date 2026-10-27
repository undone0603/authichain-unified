export type VerificationDecision =
  | "verified"
  | "warning"
  | "blocked"
  | "revoked"
  | "expired"
  | "not_found"
  | "risk"
  | "indeterminate";

export type VerificationDecisionInput = {
  /** Whether the signed payload was cryptographically verified. */
  cryptographicValid: boolean;
  /** Whether the issuer is currently trusted and within its validity window. */
  issuerTrusted: boolean;
  /** Durable lifecycle status. `null` means no registry record was found. */
  claimStatus: "active" | "revoked" | "expired" | "superseded" | null;
  /** Issuer's signed decision. */
  signedDecision: "verified" | "warning" | "blocked";
  /** Whether the signed attestation has expired by time. */
  expired: boolean;
  /** Optional risk signals discovered while resolving the physical object. */
  riskSignals?: readonly string[];
  /** Whether a resolver found an object/attestation for the requested identifier. */
  found: boolean;
};

export type VerificationDecisionResult = {
  decision: VerificationDecision;
  valid: boolean;
  reasons: string[];
};

/**
 * Collapse cryptographic, issuer, lifecycle, decision, and resolver state into
 * one conservative public decision.
 *
 * This function intentionally does not equate "registered" with "authentic".
 * A missing object is `not_found`; infrastructure/issuer uncertainty is
 * `indeterminate`; explicit risk signals are `risk`. Only a cryptographically
 * valid, currently trusted, active, unexpired `verified` claim becomes
 * `verified=true`.
 */
export function resolveVerificationDecision(
  input: VerificationDecisionInput,
): VerificationDecisionResult {
  const reasons: string[] = [];

  if (!input.found) {
    return {
      decision: "not_found",
      valid: false,
      reasons: ["identifier_or_attestation_not_found"],
    };
  }

  if (!input.cryptographicValid) {
    return {
      decision: "indeterminate",
      valid: false,
      reasons: ["cryptographic_verification_failed"],
    };
  }

  if (!input.issuerTrusted) {
    return {
      decision: "indeterminate",
      valid: false,
      reasons: ["issuer_not_trusted"],
    };
  }

  if (input.claimStatus === "revoked") {
    return {
      decision: "revoked",
      valid: false,
      reasons: ["durable_status_revoked"],
    };
  }

  if (input.claimStatus === "superseded") {
    return {
      decision: "risk",
      valid: false,
      reasons: ["durable_status_superseded"],
    };
  }

  // Prefer the durable lifecycle cause when the registry explicitly records
  // expiry; only use the generic reason for expiry inferred from time claims.
  if (input.claimStatus === "expired") {
    return {
      decision: "expired",
      valid: false,
      reasons: ["durable_status_expired"],
    };
  }

  if (input.expired) {
    return {
      decision: "expired",
      valid: false,
      reasons: ["expired"],
    };
  }

  if (input.riskSignals && input.riskSignals.length > 0) {
    reasons.push(...input.riskSignals.map(signal => `risk_${signal}`));
    return { decision: "risk", valid: false, reasons };
  }

  if (input.claimStatus !== "active") {
    return {
      decision: "indeterminate",
      valid: false,
      reasons: ["durable_status_unavailable"],
    };
  }

  if (input.signedDecision === "blocked") {
    return {
      decision: "blocked",
      valid: false,
      reasons: ["decision_blocked"],
    };
  }

  if (input.signedDecision === "warning") {
    return {
      decision: "warning",
      valid: false,
      reasons: ["decision_warning"],
    };
  }

  return { decision: "verified", valid: true, reasons };
}
