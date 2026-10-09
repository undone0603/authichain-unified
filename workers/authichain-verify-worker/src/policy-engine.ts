/**
 * Pure, fail-closed policy evaluation for proposed economic actions.
 *
 * IMPORTANT: a RESERVATION_REQUIRED decision is not an execution grant.
 * The caller must atomically claim the idempotency key and reserve budget
 * against the expected budget revision in a durable store before any effect.
 * This module has no database, network, signing key, or execution side effects.
 */
import type { AgentCapability } from "./agent-types";
import type {
  AuthorizationDecision,
  AuthorizationReasonCode,
  EconomicAction,
  EconomicActionType,
} from "./economic-action";
import { parseEconomicAction } from "./economic-action";
import type { ControlPlaneMessageVerificationResult } from "./crypto-message";

export interface EconomicPolicy {
  policy_version: string;
  organization_id: string;
  enabled: boolean;
  allowed_action_types: EconomicActionType[];
  /** Explicit allowlist; empty or absent is deny-all. */
  allowed_asset_ids: string[];
  max_amount_minor_by_action: Partial<Record<EconomicActionType, number>>;
  max_action_lifetime_seconds: number;
  evidence_required_for: EconomicActionType[];
  allowed_agent_ids?: string[];
  allowed_roles?: string[];
  allowed_organization_ids?: string[];
}

export interface EconomicIdentitySnapshot {
  agent_id: string;
  organization_id: string;
  attestation_id: string;
  role: string;
  policy_version: string;
  capabilities: AgentCapability[];
  status: "ACTIVE" | "EXPIRED" | "NOT_YET_EFFECTIVE" | "REVOKED";
  issuer_revoked: boolean;
  attestation_revoked: boolean;
}

export interface EconomicBudgetSnapshot {
  budget_id: string;
  organization_id: string;
  asset_id: string;
  status: "ACTIVE" | "SUSPENDED";
  /** Must change on every reservation/commit/release mutation. */
  revision: string;
  limit_minor: number;
  committed_minor: number;
  reserved_minor: number;
}

export interface EconomicEvidenceReference {
  evidence_id: string;
  organization_id: string;
  verified: boolean;
  digest: string;
}

export type IdempotencyLookup =
  | "NEW"
  | "SAME_ACTION"
  | "CONFLICT"
  | "UNAVAILABLE";

export interface EconomicPolicyContext {
  decision_id: string;
  identity: EconomicIdentitySnapshot;
  policy: EconomicPolicy;
  budget: EconomicBudgetSnapshot;
  evidence: readonly EconomicEvidenceReference[];
  idempotency_lookup: IdempotencyLookup;
  now?: Date;
}

const CAPABILITY_BY_ACTION: Record<EconomicActionType, AgentCapability> = {
  TRANSFER: "PROPOSE_TRANSFER",
  DEDUCT: "PROPOSE_DEDUCT",
  MINT: "PROPOSE_MINT",
};

function validId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(value);
}

function isSafeNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value >= 0;
}

function unique<T>(items: T[]): T[] {
  return [...new Set(items)];
}

function decision(
  decisionId: string,
  actionId: string,
  policyVersion: string,
  now: Date,
  reasons: AuthorizationReasonCode[],
  reservation?: AuthorizationDecision["reservation"],
): AuthorizationDecision {
  const reasonCodes = unique(reasons);
  return {
    protocol: "authichain-authorization-decision/1",
    decision_id: validId(decisionId) ? decisionId : "decision:invalid-context",
    action_id: validId(actionId) ? actionId : "action:unknown",
    decision: reservation && reasonCodes.length === 0 ? "RESERVATION_REQUIRED" : "DENY",
    reason_codes: reasonCodes,
    policy_version: validId(policyVersion) ? policyVersion : "policy:unknown",
    evaluated_at: Number.isFinite(now.getTime()) ? now.toISOString() : new Date(0).toISOString(),
    execution_status: "NOT_EXECUTED",
    ...(reservation && reasonCodes.length === 0 ? { reservation } : {}),
  };
}

/**
 * Evaluate signature-verified input against the current identity snapshot,
 * explicit policy, verified evidence and a versioned budget snapshot.
 * This computes an authorization proposal only; it does not reserve budget.
 */
export function evaluateEconomicAction(
  message: ControlPlaneMessageVerificationResult,
  context: EconomicPolicyContext,
): AuthorizationDecision {
  const now = context?.now instanceof Date && Number.isFinite(context.now.getTime())
    ? context.now
    : new Date();
  const actionIdHint = message?.action?.action_id ?? "action:unknown";
  const policyVersionHint = context?.policy?.policy_version ?? "policy:unknown";
  const reasons: AuthorizationReasonCode[] = [];

  let action: EconomicAction;
  try {
    action = parseEconomicAction(message?.action);
  } catch {
    return decision(context?.decision_id ?? "decision:invalid-context", actionIdHint,
      policyVersionHint, now, ["MALFORMED_ACTION"]);
  }

  if (
    message?.valid !== true ||
    !Array.isArray(message.reasons) ||
    message.reasons.length !== 0
  ) reasons.push("MESSAGE_NOT_VERIFIED");

  const identity = context?.identity;
  if (
    !identity ||
    identity.status !== "ACTIVE"
  ) reasons.push("IDENTITY_NOT_TRUSTED");
  if (identity?.issuer_revoked) reasons.push("ISSUER_REVOKED");
  if (identity?.attestation_revoked || identity?.status === "REVOKED") {
    reasons.push("ATTESTATION_REVOKED");
  }

  if (
    !identity ||
    message?.agent_id !== action.agent_id ||
    message?.organization_id !== action.organization_id ||
    message?.attestation_id !== action.attestation_id ||
    message?.policy_version !== action.policy_version ||
    identity.agent_id !== action.agent_id ||
    identity.organization_id !== action.organization_id ||
    identity.attestation_id !== action.attestation_id ||
    identity.policy_version !== action.policy_version
  ) reasons.push("IDENTITY_BINDING_MISMATCH");

  const requiredCapability = CAPABILITY_BY_ACTION[action.action_type];
  if (
    !identity ||
    !Array.isArray(identity.capabilities) ||
    !identity.capabilities.includes(requiredCapability)
  ) {
    reasons.push("CAPABILITY_NOT_GRANTED");
  }

  const policy = context?.policy;
  if (!policy || policy.enabled !== true) reasons.push("POLICY_DISABLED");
  if (!policy || policy.policy_version !== action.policy_version) {
    reasons.push("POLICY_VERSION_MISMATCH");
  }
  if (
    !policy ||
    policy.organization_id !== action.organization_id ||
    (policy.allowed_organization_ids &&
      (!Array.isArray(policy.allowed_organization_ids) ||
        !policy.allowed_organization_ids.includes(action.organization_id)))
  ) reasons.push("ORGANIZATION_NOT_ALLOWED");

  const allowedActions = policy?.allowed_action_types;
  if (!Array.isArray(allowedActions) || !allowedActions.includes(action.action_type)) {
    reasons.push("ACTION_TYPE_NOT_ALLOWED");
  }
  const allowedAssets = policy?.allowed_asset_ids;
  if (!Array.isArray(allowedAssets) || !allowedAssets.includes(action.asset_id)) {
    reasons.push("ASSET_NOT_ALLOWED");
  }
  if (
    policy?.allowed_agent_ids &&
    (!Array.isArray(policy.allowed_agent_ids) || !policy.allowed_agent_ids.includes(action.agent_id))
  ) reasons.push("AGENT_NOT_ALLOWED");
  if (
    policy?.allowed_roles &&
    (!Array.isArray(policy.allowed_roles) || !policy.allowed_roles.includes(identity?.role ?? ""))
  ) reasons.push("ROLE_NOT_ALLOWED");

  const maxAmount = policy?.max_amount_minor_by_action?.[action.action_type];
  if (!isSafeNonNegativeInteger(maxAmount) || maxAmount === 0) {
    reasons.push("POLICY_CONFIGURATION_INVALID");
  } else if (action.amount_minor > maxAmount) {
    reasons.push("AMOUNT_LIMIT_EXCEEDED");
  }

  const maxLifetime = policy?.max_action_lifetime_seconds;
  if (
    !Array.isArray(policy?.evidence_required_for) ||
    !Array.isArray(policy?.allowed_action_types) ||
    !Array.isArray(policy?.allowed_asset_ids)
  ) reasons.push("POLICY_CONFIGURATION_INVALID");
  if (!isSafeNonNegativeInteger(maxLifetime) || maxLifetime === 0) {
    reasons.push("POLICY_CONFIGURATION_INVALID");
  } else {
    const lifetime = (Date.parse(action.expires_at) - Date.parse(action.created_at)) / 1000;
    if (!Number.isFinite(lifetime) || lifetime <= 0 || lifetime > maxLifetime) {
      reasons.push("ACTION_LIFETIME_EXCEEDED");
    }
  }

  const nowMs = now.getTime();
  if (Date.parse(action.created_at) > nowMs + 30_000) reasons.push("ACTION_NOT_YET_VALID");
  if (Date.parse(action.expires_at) <= nowMs) reasons.push("ACTION_EXPIRED");

  const budget = context?.budget;
  if (!budget || !validId(budget.budget_id)) {
    reasons.push("BUDGET_NOT_FOUND");
  } else {
    if (budget.status !== "ACTIVE") reasons.push("BUDGET_NOT_ACTIVE");
    if (
      budget.budget_id !== action.budget_id ||
      budget.organization_id !== action.organization_id ||
      budget.asset_id !== action.asset_id
    ) reasons.push("BUDGET_SCOPE_MISMATCH");

    const counters = [budget.limit_minor, budget.committed_minor, budget.reserved_minor];
    if (
      !validId(budget.revision) ||
      !counters.every(isSafeNonNegativeInteger) ||
      !Number.isSafeInteger(budget.committed_minor + budget.reserved_minor) ||
      budget.committed_minor + budget.reserved_minor > budget.limit_minor
    ) {
      reasons.push("BUDGET_SNAPSHOT_INVALID");
    } else if (
      action.amount_minor > budget.limit_minor - budget.committed_minor - budget.reserved_minor
    ) {
      reasons.push("INSUFFICIENT_BUDGET");
    }
  }

  const evidence = Array.isArray(context?.evidence) ? context.evidence : [];
  const evidenceById = new Map<string, (typeof evidence)[number]>();
  for (const item of evidence) {
    if (item && typeof item === "object" && validId(item.evidence_id)) {
      evidenceById.set(item.evidence_id, item);
    }
  }
  const evidenceRequired = Array.isArray(policy?.evidence_required_for) &&
    policy.evidence_required_for.includes(action.action_type);
  if (evidenceRequired && action.evidence_ids.length === 0) {
    reasons.push("EVIDENCE_REQUIRED");
  }
  for (const evidenceId of action.evidence_ids) {
    const record = evidenceById.get(evidenceId);
    if (
      !record ||
      record.verified !== true ||
      record.organization_id !== action.organization_id ||
      !validId(record.evidence_id) ||
      typeof record.digest !== "string" ||
      record.digest.length < 16 ||
      record.digest.length > 256
    ) reasons.push("EVIDENCE_NOT_VERIFIED");
  }

  switch (context?.idempotency_lookup) {
    case "NEW":
      break;
    case "SAME_ACTION":
      reasons.push("ACTION_ALREADY_RESERVED");
      break;
    case "CONFLICT":
      reasons.push("IDEMPOTENCY_CONFLICT");
      break;
    default:
      reasons.push("RESERVATION_STORE_UNAVAILABLE");
      break;
  }

  if (reasons.length > 0) {
    return decision(
      context?.decision_id ?? "decision:invalid-context",
      action.action_id,
      policyVersionHint,
      now,
      reasons,
    );
  }

  const budgetRevision = context.budget.revision;
  return decision(
    context.decision_id,
    action.action_id,
    policyVersionHint,
    now,
    [],
    {
      status: "PROPOSED_NOT_RESERVED",
      reservation_key: action.idempotency_key,
      action_id: action.action_id,
      idempotency_key: action.idempotency_key,
      budget_id: context.budget.budget_id,
      expected_budget_revision: budgetRevision,
      asset_id: action.asset_id,
      amount_minor: action.amount_minor,
      expires_at: action.expires_at,
    },
  );
}
