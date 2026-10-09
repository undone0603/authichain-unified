import {
  ECONOMIC_OPERATIONS,
  ECONOMIC_OPERATION_CAPABILITY,
  isEconomicAction,
  isSafeEconomicId,
  parseEconomicTimestamp,
  parsePositiveMinorUnits,
  type AuthorizationDecision,
  type EconomicAction,
  type EconomicAuthorizationReasonCode,
  type EconomicOperation,
} from "./economic-action";
import { agentMessageDigest, canonicalizeJson, sha256Base64Url, type SignedAgentMessage } from "./agent-message";
import type { AgentCapability, AgentMessageVerificationResult } from "./agent-types";
import { economicActionDigest } from "./crypto-message";

export interface EconomicPolicy {
  policy_version: string;
  organization_id: string;
  enabled: boolean;
  allowed_operations: EconomicOperation[];
  allowed_asset_ids: string[];
  max_single_action_minor_units: string;
  max_action_lifetime_seconds: number;
  require_evidence: boolean;
  max_evidence_ids: number;
}

const ENVELOPE_KEYS = new Set([
  "protocol",
  "message_id",
  "agent_id",
  "organization_id",
  "attestation_id",
  "role",
  "version",
  "capabilities",
  "policy_version",
  "issued_at",
  "expires_at",
  "intent",
  "evidence_ids",
  "payload",
  "signature",
]);

function isStrictAgentEnvelope(value: unknown): value is SignedAgentMessage<EconomicAction> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;
  const envelope = value as Record<string, unknown>;
  const keys = Object.keys(envelope);
  if (keys.some((key) => !ENVELOPE_KEYS.has(key))) return false;
  if (keys.length !== ENVELOPE_KEYS.size) return false;
  for (const key of ENVELOPE_KEYS) {
    if (!Object.prototype.hasOwnProperty.call(envelope, key)) return false;
  }

  return (
    envelope.protocol === "authichain-agent/1" &&
    isSafeEconomicId(envelope.message_id) &&
    isSafeEconomicId(envelope.agent_id) &&
    isSafeEconomicId(envelope.organization_id) &&
    isSafeEconomicId(envelope.attestation_id) &&
    isSafeEconomicId(envelope.role) &&
    isSafeEconomicId(envelope.version) &&
    isSafeEconomicId(envelope.policy_version) &&
    typeof envelope.signature === "string" &&
    envelope.signature.length > 0 &&
    typeof envelope.intent === "string" &&
    Array.isArray(envelope.capabilities) &&
    envelope.capabilities.every((cap) => typeof cap === "string") &&
    Array.isArray(envelope.evidence_ids) &&
    envelope.evidence_ids.every(isSafeEconomicId) &&
    isEconomicAction(envelope.payload)
  );
}

function validatePolicy(value: unknown): value is EconomicPolicy {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const p = value as Record<string, unknown>;
  if (
    !isSafeEconomicId(p.policy_version) ||
    !isSafeEconomicId(p.organization_id) ||
    p.enabled !== true && p.enabled !== false ||
    !Array.isArray(p.allowed_operations) ||
    !p.allowed_operations.every((op) =>
      (ECONOMIC_OPERATIONS as readonly unknown[]).includes(op),
    ) ||
    new Set(p.allowed_operations).size !== p.allowed_operations.length ||
    !Array.isArray(p.allowed_asset_ids) ||
    !p.allowed_asset_ids.every(isSafeEconomicId) ||
    new Set(p.allowed_asset_ids).size !== p.allowed_asset_ids.length ||
    parsePositiveMinorUnits(p.max_single_action_minor_units) === null ||
    !Number.isSafeInteger(p.max_action_lifetime_seconds) ||
    (p.max_action_lifetime_seconds as number) < 1 ||
    (p.max_action_lifetime_seconds as number) > 604800 ||
    typeof p.require_evidence !== "boolean" ||
    !Number.isSafeInteger(p.max_evidence_ids) ||
    (p.max_evidence_ids as number) < 0 ||
    (p.max_evidence_ids as number) > 32
  ) {
    return false;
  }
  return true;
}

function uniqueReasons(
  reasons: EconomicAuthorizationReasonCode[],
): EconomicAuthorizationReasonCode[] {
  return [...new Set(reasons)];
}

async function buildDecision(
  params: {
    action?: EconomicAction;
    messageDigest?: string;
    actionDigest?: string;
    policyVersion?: string;
    now: Date;
    reasons: EconomicAuthorizationReasonCode[];
  },
): Promise<AuthorizationDecision> {
  const reason_codes = uniqueReasons(params.reasons);
  const decision = reason_codes.length === 0 ? "ELIGIBLE_FOR_RESERVATION" : "DENY";
  const decided_at = params.now.toISOString();
  const decisionBasis = {
    protocol: "authichain-economic-authorization/1",
    decision,
    action_id: params.action?.action_id ?? null,
    action_digest: params.actionDigest ?? null,
    message_digest: params.messageDigest ?? null,
    policy_version: params.policyVersion ?? null,
    reason_codes,
    decided_at,
  };
  const decision_id = "dec:" + await sha256Base64Url(canonicalizeJson(decisionBasis));

  return {
    protocol: "authichain-economic-authorization/1",
    decision_id,
    decision,
    ...(params.action ? {
      action_id: params.action.action_id,
      agent_id: params.action.agent_id,
      organization_id: params.action.organization_id,
      policy_version: params.action.policy_version,
    } : {}),
    ...(params.actionDigest ? { action_digest: params.actionDigest } : {}),
    ...(params.messageDigest ? { message_digest: params.messageDigest } : {}),
    reason_codes,
    decided_at,
    requires_reservation: decision === "ELIGIBLE_FOR_RESERVATION",
    // Policy eligibility is not a reservation, commit, or permission to execute.
    execution_permitted: false,
  };
}

/**
 * Evaluate the signed proposal against identity verification and a versioned,
 * organization-scoped policy. This function is intentionally pre-reservation:
 * it never mutates balances, reserves budget, mints assets, or executes actions.
 */
export async function authorizeEconomicAction(
  message: unknown,
  verification: AgentMessageVerificationResult,
  policy: unknown,
  now = new Date(),
): Promise<AuthorizationDecision> {
  const safeNow = Number.isFinite(now.getTime()) ? now : new Date(0);
  const reasons: EconomicAuthorizationReasonCode[] = [];

  if (!isStrictAgentEnvelope(message)) {
    return buildDecision({ now: safeNow, reasons: ["MESSAGE_ACTION_BINDING_MISMATCH"] });
  }

  const envelope = message;
  const action = envelope.payload;
  let actionDigest: string | undefined;
  try {
    actionDigest = await economicActionDigest(action);
  } catch {
    return buildDecision({ now: safeNow, action, reasons: ["MALFORMED_ACTION"] });
  }

  if (!verification || verification.valid !== true || !Array.isArray(verification.reasons) || verification.reasons.length !== 0) {
    reasons.push("MESSAGE_NOT_VERIFIED");
  } else {
    // Bind the policy evaluation to the exact envelope the verifier evaluated.
    // A previously valid result must not be reusable after payload mutation.
    try {
      const currentMessageDigest = await agentMessageDigest(envelope);
      if (currentMessageDigest !== verification.message_digest) {
        reasons.push("MESSAGE_NOT_VERIFIED");
      }
    } catch {
      reasons.push("MESSAGE_NOT_VERIFIED");
    }
    if (
      !Array.isArray(verification.capabilities) ||
      !sameStringArray(envelope.capabilities, verification.capabilities)
    ) {
      reasons.push("IDENTITY_BINDING_MISMATCH");
    }
  }

  if (
    !verification ||
    verification.agent_id !== action.agent_id ||
    verification.organization_id !== action.organization_id ||
    verification.attestation_id !== action.attestation_id ||
    verification.policy_version !== action.policy_version ||
    typeof verification.message_digest !== "string" ||
    verification.message_digest.length === 0
  ) {
    reasons.push("IDENTITY_BINDING_MISMATCH");
  }

  if (
    envelope.message_id !== action.idempotency_key ||
    envelope.agent_id !== action.agent_id ||
    envelope.organization_id !== action.organization_id ||
    envelope.attestation_id !== action.attestation_id ||
    envelope.policy_version !== action.policy_version ||
    envelope.issued_at !== action.created_at ||
    envelope.expires_at !== action.expires_at ||
    envelope.intent !== "economic_action_request" ||
    !sameStringArray(envelope.evidence_ids, action.evidence_ids)
  ) {
    reasons.push("MESSAGE_ACTION_BINDING_MISMATCH");
  }

  if (!validatePolicy(policy)) {
    reasons.push("MALFORMED_POLICY");
    return buildDecision({
      action,
      actionDigest,
      messageDigest: typeof verification?.message_digest === "string" ? verification.message_digest : undefined,
      policyVersion: typeof (policy as Record<string, unknown> | null)?.policy_version === "string"
        ? (policy as Record<string, unknown>).policy_version as string
        : undefined,
      now: safeNow,
      reasons,
    });
  }

  if (!policy.enabled) reasons.push("POLICY_DISABLED");
  if (action.policy_version !== policy.policy_version) reasons.push("POLICY_VERSION_MISMATCH");
  if (action.organization_id !== policy.organization_id) reasons.push("ORGANIZATION_NOT_ALLOWED");
  if (!policy.allowed_operations.includes(action.operation)) reasons.push("OPERATION_NOT_ALLOWED");
  if (!policy.allowed_asset_ids.includes(action.asset_id)) reasons.push("ASSET_NOT_ALLOWED");

  const requiredCapabilities: AgentCapability[] = [
    "PROPOSE_ECONOMIC_ACTION",
    ECONOMIC_OPERATION_CAPABILITY[action.operation],
  ];
  const verifiedCapabilities = Array.isArray(verification?.capabilities) ? verification.capabilities : [];
  if (!requiredCapabilities.every((capability) => verifiedCapabilities.includes(capability))) {
    reasons.push("CAPABILITY_NOT_GRANTED");
  }

  const amount = parsePositiveMinorUnits(action.amount_minor_units);
  const maximum = parsePositiveMinorUnits(policy.max_single_action_minor_units);
  if (amount === null || maximum === null) {
    reasons.push("AMOUNT_INVALID");
  } else if (amount > maximum) {
    reasons.push("AMOUNT_EXCEEDS_MAXIMUM");
  }

  if (action.operation === "TRANSFER" &&
    (!action.source_account_id || !action.destination_account_id || action.source_account_id === action.destination_account_id)) {
    reasons.push("ACCOUNT_BINDING_INVALID");
  } else if (action.operation === "DEDUCT" &&
    (!action.source_account_id || Object.prototype.hasOwnProperty.call(action, "destination_account_id"))) {
    reasons.push("ACCOUNT_BINDING_INVALID");
  } else if (action.operation === "MINT" &&
    (!action.destination_account_id || Object.prototype.hasOwnProperty.call(action, "source_account_id"))) {
    reasons.push("ACCOUNT_BINDING_INVALID");
  }

  if (policy.require_evidence && action.evidence_ids.length === 0) reasons.push("EVIDENCE_REQUIRED");
  if (action.evidence_ids.length > policy.max_evidence_ids) reasons.push("EVIDENCE_LIMIT_EXCEEDED");

  const createdMs = parseEconomicTimestamp(action.created_at);
  const expiresMs = parseEconomicTimestamp(action.expires_at);
  if (createdMs === null || expiresMs === null || expiresMs <= createdMs) {
    reasons.push("ACTION_TIMESTAMP_INVALID");
  } else {
    if (createdMs > safeNow.getTime() + 60_000) reasons.push("ACTION_FUTURE_DATED");
    if (expiresMs <= safeNow.getTime()) reasons.push("ACTION_EXPIRED");
    if ((expiresMs - createdMs) / 1000 > policy.max_action_lifetime_seconds) {
      reasons.push("ACTION_TTL_EXCEEDED");
    }
  }

  return buildDecision({
    action,
    actionDigest,
    messageDigest: typeof verification?.message_digest === "string" ? verification.message_digest : undefined,
    policyVersion: policy.policy_version,
    now: safeNow,
    reasons,
  });
}

function sameStringArray(left: string[], right: string[]): boolean {
  if (left.length !== right.length) return false;
  const a = [...left].sort();
  const b = [...right].sort();
  return a.every((value, index) => value === b[index]);
}
