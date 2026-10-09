/**
 * Domain contracts for proposed economic actions.
 *
 * This module defines and validates requests only. It does not move value,
 * reserve budget, mint assets, or commit ledger state.
 */

export const ECONOMIC_ACTION_PROTOCOL = "authichain-economic-action/1" as const;
export const ECONOMIC_ACTION_TYPES = ["TRANSFER", "DEDUCT", "MINT"] as const;
export type EconomicActionType = (typeof ECONOMIC_ACTION_TYPES)[number];

const ID_PATTERN = /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/;
const ACTION_KEYS = new Set([
  "protocol",
  "action_id",
  "idempotency_key",
  "action_type",
  "agent_id",
  "organization_id",
  "attestation_id",
  "policy_version",
  "budget_id",
  "asset_id",
  "amount_minor",
  "source_account_id",
  "destination_account_id",
  "evidence_ids",
  "created_at",
  "expires_at",
]);

export interface EconomicAction {
  protocol: typeof ECONOMIC_ACTION_PROTOCOL;
  action_id: string;
  idempotency_key: string;
  action_type: EconomicActionType;
  agent_id: string;
  organization_id: string;
  attestation_id: string;
  policy_version: string;
  budget_id: string;
  asset_id: string;
  /** Integer in the asset's smallest indivisible unit; never a float. */
  amount_minor: number;
  source_account_id?: string;
  destination_account_id?: string;
  evidence_ids: string[];
  created_at: string;
  expires_at: string;
}

export type AuthorizationReasonCode =
  | "MALFORMED_ACTION"
  | "MESSAGE_NOT_VERIFIED"
  | "IDENTITY_NOT_TRUSTED"
  | "ISSUER_REVOKED"
  | "ATTESTATION_REVOKED"
  | "IDENTITY_BINDING_MISMATCH"
  | "CAPABILITY_NOT_GRANTED"
  | "POLICY_DISABLED"
  | "POLICY_VERSION_MISMATCH"
  | "ACTION_TYPE_NOT_ALLOWED"
  | "ASSET_NOT_ALLOWED"
  | "AMOUNT_LIMIT_EXCEEDED"
  | "ACTION_EXPIRED"
  | "ACTION_NOT_YET_VALID"
  | "AGENT_NOT_ALLOWED"
  | "ROLE_NOT_ALLOWED"
  | "ACTION_LIFETIME_EXCEEDED"
  | "ORGANIZATION_NOT_ALLOWED"
  | "EVIDENCE_REQUIRED"
  | "EVIDENCE_NOT_VERIFIED"
  | "BUDGET_NOT_FOUND"
  | "BUDGET_NOT_ACTIVE"
  | "BUDGET_SCOPE_MISMATCH"
  | "BUDGET_SNAPSHOT_INVALID"
  | "INSUFFICIENT_BUDGET"
  | "IDEMPOTENCY_CONFLICT"
  | "ACTION_ALREADY_RESERVED"
  | "RESERVATION_STORE_UNAVAILABLE"
  | "RESERVATION_REQUIRED";

export interface ProposedReservation {
  status: "PROPOSED_NOT_RESERVED";
  reservation_key: string;
  action_id: string;
  idempotency_key: string;
  budget_id: string;
  expected_budget_revision: string;
  asset_id: string;
  amount_minor: number;
  expires_at: string;
}

export interface AuthorizationDecision {
  protocol: "authichain-authorization-decision/1";
  decision_id: string;
  action_id: string;
  decision: "DENY" | "RESERVATION_REQUIRED";
  reason_codes: AuthorizationReasonCode[];
  policy_version: string;
  evaluated_at: string;
  execution_status: "NOT_EXECUTED";
  reservation?: ProposedReservation;
}

export class EconomicActionValidationError extends TypeError {
  constructor(message: string) {
    super(message);
    this.name = "EconomicActionValidationError";
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function assertAllowedKeys(record: Record<string, unknown>): void {
  for (const key of Object.keys(record)) {
    if (!ACTION_KEYS.has(key)) {
      throw new EconomicActionValidationError(`Unknown economic action field: ${key}`);
    }
  }
}

function requireId(value: unknown, field: string): string {
  if (typeof value !== "string" || !ID_PATTERN.test(value)) {
    throw new EconomicActionValidationError(`Invalid ${field}`);
  }
  return value;
}

function requireUtcTimestamp(value: unknown, field: string): string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  ) {
    throw new EconomicActionValidationError(`Invalid ${field}: expected canonical UTC timestamp`);
  }
  const millis = Date.parse(value);
  if (!Number.isFinite(millis) || new Date(millis).toISOString() !== value) {
    throw new EconomicActionValidationError(`Invalid ${field}`);
  }
  return value;
}

/**
 * Validate untrusted JSON without silently discarding fields. Evidence IDs are
 * treated as a set and returned in lexical order for stable signatures.
 */
export function parseEconomicAction(input: unknown): EconomicAction {
  if (!isRecord(input)) {
    throw new EconomicActionValidationError("Economic action must be a plain object");
  }
  assertAllowedKeys(input);

  if (input.protocol !== ECONOMIC_ACTION_PROTOCOL) {
    throw new EconomicActionValidationError("Unsupported economic action protocol");
  }
  const actionType = input.action_type;
  if (
    typeof actionType !== "string" ||
    !(ECONOMIC_ACTION_TYPES as readonly string[]).includes(actionType)
  ) {
    throw new EconomicActionValidationError("Unsupported economic action type");
  }

  const amount = input.amount_minor;
  if (typeof amount !== "number" || !Number.isSafeInteger(amount) || amount <= 0) {
    throw new EconomicActionValidationError("amount_minor must be a positive safe integer");
  }

  const evidenceValue = input.evidence_ids;
  if (
    !Array.isArray(evidenceValue) ||
    evidenceValue.length > 32 ||
    !evidenceValue.every((value) => typeof value === "string" && ID_PATTERN.test(value))
  ) {
    throw new EconomicActionValidationError("evidence_ids must contain at most 32 valid identifiers");
  }
  const evidenceIds = evidenceValue as string[];
  if (new Set(evidenceIds).size !== evidenceIds.length) {
    throw new EconomicActionValidationError("evidence_ids must not contain duplicates");
  }

  const action: EconomicAction = {
    protocol: ECONOMIC_ACTION_PROTOCOL,
    action_id: requireId(input.action_id, "action_id"),
    idempotency_key: requireId(input.idempotency_key, "idempotency_key"),
    action_type: actionType as EconomicActionType,
    agent_id: requireId(input.agent_id, "agent_id"),
    organization_id: requireId(input.organization_id, "organization_id"),
    attestation_id: requireId(input.attestation_id, "attestation_id"),
    policy_version: requireId(input.policy_version, "policy_version"),
    budget_id: requireId(input.budget_id, "budget_id"),
    asset_id: requireId(input.asset_id, "asset_id"),
    amount_minor: amount,
    evidence_ids: [...evidenceIds].sort(),
    created_at: requireUtcTimestamp(input.created_at, "created_at"),
    expires_at: requireUtcTimestamp(input.expires_at, "expires_at"),
  };

  if (Date.parse(action.expires_at) <= Date.parse(action.created_at)) {
    throw new EconomicActionValidationError("expires_at must be later than created_at");
  }

  if (input.source_account_id !== undefined) {
    action.source_account_id = requireId(input.source_account_id, "source_account_id");
  }
  if (input.destination_account_id !== undefined) {
    action.destination_account_id = requireId(
      input.destination_account_id,
      "destination_account_id",
    );
  }

  if (action.action_type === "TRANSFER") {
    if (!action.source_account_id || !action.destination_account_id) {
      throw new EconomicActionValidationError("TRANSFER requires source and destination accounts");
    }
    if (action.source_account_id === action.destination_account_id) {
      throw new EconomicActionValidationError("TRANSFER source and destination must differ");
    }
  } else if (action.action_type === "DEDUCT") {
    if (!action.source_account_id || action.destination_account_id) {
      throw new EconomicActionValidationError("DEDUCT requires only a source account");
    }
  } else if (action.action_type === "MINT") {
    if (!action.destination_account_id || action.source_account_id) {
      throw new EconomicActionValidationError("MINT requires only a destination account");
    }
  }

  return action;
}
