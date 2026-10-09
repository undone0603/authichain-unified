import type { AgentCapability } from "./agent-types";

export const ECONOMIC_ACTION_PROTOCOL = "authichain-economic-action/1" as const;

export const ECONOMIC_OPERATIONS = ["TRANSFER", "DEDUCT", "MINT"] as const;
export type EconomicOperation = (typeof ECONOMIC_OPERATIONS)[number];

export const ECONOMIC_OPERATION_CAPABILITY: Record<EconomicOperation, AgentCapability> = {
  TRANSFER: "TRANSFER_VALUE",
  DEDUCT: "DEDUCT_VALUE",
  MINT: "MINT_VALUE",
};

export const ECONOMIC_AUTHORIZATION_REASONS = [
  "MALFORMED_ACTION",
  "MALFORMED_POLICY",
  "MESSAGE_NOT_VERIFIED",
  "MESSAGE_ACTION_BINDING_MISMATCH",
  "IDENTITY_BINDING_MISMATCH",
  "POLICY_DISABLED",
  "POLICY_VERSION_MISMATCH",
  "ORGANIZATION_NOT_ALLOWED",
  "OPERATION_NOT_ALLOWED",
  "ASSET_NOT_ALLOWED",
  "CAPABILITY_NOT_GRANTED",
  "AMOUNT_INVALID",
  "AMOUNT_EXCEEDS_MAXIMUM",
  "ACCOUNT_BINDING_INVALID",
  "EVIDENCE_REQUIRED",
  "EVIDENCE_LIMIT_EXCEEDED",
  "ACTION_TIMESTAMP_INVALID",
  "ACTION_FUTURE_DATED",
  "ACTION_EXPIRED",
  "ACTION_TTL_EXCEEDED",
] as const;

export type EconomicAuthorizationReasonCode =
  (typeof ECONOMIC_AUTHORIZATION_REASONS)[number];

export type EconomicAuthorizationOutcome = "ELIGIBLE_FOR_RESERVATION" | "DENY";

/**
 * A proposal envelope only. This contract does not move money, mint assets,
 * deduct balances, reserve budget, or commit an economic side effect.
 *
 * All amounts are positive base-10 integers in the asset's smallest unit.
 * Floating-point amounts are deliberately not representable.
 */
export interface EconomicAction {
  protocol: typeof ECONOMIC_ACTION_PROTOCOL;
  action_id: string;
  idempotency_key: string;
  operation: EconomicOperation;
  agent_id: string;
  organization_id: string;
  attestation_id: string;
  policy_version: string;
  asset_id: string;
  amount_minor_units: string;
  source_account_id?: string;
  destination_account_id?: string;
  evidence_ids: string[];
  created_at: string;
  expires_at: string;
}

export interface AuthorizationDecision {
  protocol: "authichain-economic-authorization/1";
  decision_id: string;
  decision: EconomicAuthorizationOutcome;
  action_id?: string;
  action_digest?: string;
  message_digest?: string;
  agent_id?: string;
  organization_id?: string;
  policy_version?: string;
  reason_codes: EconomicAuthorizationReasonCode[];
  decided_at: string;
  requires_reservation: boolean;
  /** Intentionally literal false until a separately gated execution phase exists. */
  execution_permitted: false;
}

export interface EconomicAuditPayload {
  protocol: "authichain-economic-audit-payload/1";
  audit_id: string;
  decision_id: string;
  action_id: string;
  action_digest: string;
  agent_id: string;
  organization_id: string;
  policy_version: string;
  decision: EconomicAuthorizationOutcome;
  reason_codes: EconomicAuthorizationReasonCode[];
  decided_at: string;
  reservation_state: "NOT_RESERVED";
  execution_state: "NOT_EXECUTED";
}

const REQUIRED_KEYS = [
  "protocol",
  "action_id",
  "idempotency_key",
  "operation",
  "agent_id",
  "organization_id",
  "attestation_id",
  "policy_version",
  "asset_id",
  "amount_minor_units",
  "evidence_ids",
  "created_at",
  "expires_at",
] as const;

const OPTIONAL_KEYS = ["source_account_id", "destination_account_id"] as const;
const ACTION_KEYS = new Set<string>([...REQUIRED_KEYS, ...OPTIONAL_KEYS]);
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/;
const POSITIVE_MINOR_UNITS = /^[1-9][0-9]{0,39}$/;
const TIMESTAMP_WITH_ZONE =
  /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?(?:Z|[+-]\d{2}:\d{2})$/;

export function isSafeEconomicId(value: unknown): value is string {
  return typeof value === "string" && SAFE_ID.test(value);
}

export function parsePositiveMinorUnits(value: unknown): bigint | null {
  if (typeof value !== "string" || !POSITIVE_MINOR_UNITS.test(value)) return null;
  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

export function parseEconomicTimestamp(value: unknown): number | null {
  if (typeof value !== "string" || !TIMESTAMP_WITH_ZONE.test(value)) return null;
  const milliseconds = Date.parse(value);
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

/**
 * Runtime validation is intentionally strict because TypeScript types disappear
 * at the request boundary. Unknown top-level keys are denied instead of being
 * silently ignored by signature canonicalization or policy evaluation.
 */
export function isEconomicAction(value: unknown): value is EconomicAction {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;

  const item = value as Record<string, unknown>;
  const keys = Object.keys(item);
  if (keys.some((key) => !ACTION_KEYS.has(key))) return false;
  if (REQUIRED_KEYS.some((key) => !Object.prototype.hasOwnProperty.call(item, key))) {
    return false;
  }

  if (item.protocol !== ECONOMIC_ACTION_PROTOCOL) return false;
  if (!isSafeEconomicId(item.action_id)) return false;
  if (!isSafeEconomicId(item.idempotency_key) || item.idempotency_key.length < 8) return false;
  if (!(ECONOMIC_OPERATIONS as readonly unknown[]).includes(item.operation)) return false;

  for (const key of [
    "agent_id",
    "organization_id",
    "attestation_id",
    "policy_version",
    "asset_id",
  ] as const) {
    if (!isSafeEconomicId(item[key])) return false;
  }

  if (typeof item.amount_minor_units !== "string" || !POSITIVE_MINOR_UNITS.test(item.amount_minor_units)) return false;
  if (!Array.isArray(item.evidence_ids) || item.evidence_ids.length > 32) return false;
  if (!item.evidence_ids.every(isSafeEconomicId)) return false;
  if (new Set(item.evidence_ids).size !== item.evidence_ids.length) return false;

  if (parseEconomicTimestamp(item.created_at) === null) return false;
  if (parseEconomicTimestamp(item.expires_at) === null) return false;

  for (const key of OPTIONAL_KEYS) {
    if (Object.prototype.hasOwnProperty.call(item, key) && !isSafeEconomicId(item[key])) {
      return false;
    }
  }

  if (item.operation === "TRANSFER") {
    return (
      typeof item.source_account_id === "string" &&
      typeof item.destination_account_id === "string" &&
      item.source_account_id !== item.destination_account_id
    );
  }
  if (item.operation === "DEDUCT") {
    return (
      typeof item.source_account_id === "string" &&
      !Object.prototype.hasOwnProperty.call(item, "destination_account_id")
    );
  }
  return (
    typeof item.destination_account_id === "string" &&
    !Object.prototype.hasOwnProperty.call(item, "source_account_id")
  );
}
