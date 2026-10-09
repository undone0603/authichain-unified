import { canonicalizeJson, sha256Base64Url } from "./agent-message";
import {
  ECONOMIC_AUTHORIZATION_REASONS,
  isEconomicAction,
  isSafeEconomicId,
  parseEconomicTimestamp,
  type EconomicAction,
  type EconomicAuditPayload,
} from "./economic-action";

export const ECONOMIC_AUDIT_PROTOCOL = "authichain-economic-audit/1" as const;
const SHA256_BASE64URL = /^[A-Za-z0-9_-]{43}$/;
const BASE64URL_SIGNATURE = /^[A-Za-z0-9_-]+$/;

export interface SignedEconomicAuditRecord {
  protocol: typeof ECONOMIC_AUDIT_PROTOCOL;
  signer_key_id: string;
  issued_at: string;
  payload_digest: string;
  payload: EconomicAuditPayload;
  signature: string;
}

export function canonicalizeEconomicAction(action: EconomicAction): string {
  if (!isEconomicAction(action)) {
    throw new TypeError("Invalid EconomicAction cannot be canonicalized");
  }
  return canonicalizeJson(action);
}

export async function economicActionDigest(action: EconomicAction): Promise<string> {
  return sha256Base64Url(canonicalizeEconomicAction(action));
}

function signableAuditValue(
  record: Omit<SignedEconomicAuditRecord, "signature"> | SignedEconomicAuditRecord,
): Record<string, unknown> {
  return {
    domain_separator: ECONOMIC_AUDIT_PROTOCOL,
    protocol: record.protocol,
    signer_key_id: record.signer_key_id,
    issued_at: record.issued_at,
    payload_digest: record.payload_digest,
    payload: record.payload,
  };
}

function encodeBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function decodeBase64Url(value: string): Uint8Array {
  if (!BASE64URL_SIGNATURE.test(value)) {
    throw new TypeError("Invalid base64url encoding");
  }
  const base64 = value.replace(/-/g, "+").replace(/_/g, "/");
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(base64 + padding);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function isAuditPayload(value: unknown): value is EconomicAuditPayload {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return false;

  const payload = value as Record<string, unknown>;
  const expectedKeys = [
    "protocol",
    "audit_id",
    "decision_id",
    "action_id",
    "action_digest",
    "agent_id",
    "organization_id",
    "policy_version",
    "decision",
    "reason_codes",
    "decided_at",
    "reservation_state",
    "execution_state",
  ];
  if (Object.keys(payload).some((key) => !expectedKeys.includes(key))) return false;
  if (expectedKeys.some((key) => !Object.prototype.hasOwnProperty.call(payload, key))) {
    return false;
  }
  if (payload.protocol !== "authichain-economic-audit-payload/1") return false;
  for (const key of [
    "audit_id",
    "decision_id",
    "action_id",
    "agent_id",
    "organization_id",
    "policy_version",
  ] as const) {
    if (!isSafeEconomicId(payload[key])) return false;
  }
  if (typeof payload.action_digest !== "string" || !SHA256_BASE64URL.test(payload.action_digest)) {
    return false;
  }
  if (payload.decision !== "ELIGIBLE_FOR_RESERVATION" && payload.decision !== "DENY") {
    return false;
  }
  if (
    !Array.isArray(payload.reason_codes) ||
    !payload.reason_codes.every((reason) =>
      (ECONOMIC_AUTHORIZATION_REASONS as readonly unknown[]).includes(reason),
    )
  ) {
    return false;
  }
  if (
    (payload.decision === "DENY" && payload.reason_codes.length === 0) ||
    (payload.decision === "ELIGIBLE_FOR_RESERVATION" && payload.reason_codes.length !== 0)
  ) {
    return false;
  }
  if (parseEconomicTimestamp(payload.decided_at) === null) return false;
  return payload.reservation_state === "NOT_RESERVED" &&
    payload.execution_state === "NOT_EXECUTED";
}

export async function signEconomicAuditRecord(
  payload: EconomicAuditPayload,
  signerKeyId: string,
  privateKey: CryptoKey,
  issuedAt = new Date().toISOString(),
): Promise<SignedEconomicAuditRecord> {
  if (!isAuditPayload(payload)) throw new TypeError("Invalid economic audit payload");
  if (!isSafeEconomicId(signerKeyId)) throw new TypeError("Invalid audit signer key id");
  if (parseEconomicTimestamp(issuedAt) === null || issuedAt !== payload.decided_at) {
    throw new TypeError("Audit issued_at must match the valid payload decided_at timestamp");
  }

  const payloadDigest = await sha256Base64Url(canonicalizeJson(payload));
  const unsigned: Omit<SignedEconomicAuditRecord, "signature"> = {
    protocol: ECONOMIC_AUDIT_PROTOCOL,
    signer_key_id: signerKeyId,
    issued_at: issuedAt,
    payload_digest: payloadDigest,
    payload,
  };
  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: { name: "SHA-256" } },
    privateKey,
    new TextEncoder().encode(canonicalizeJson(signableAuditValue(unsigned))),
  );

  return { ...unsigned, signature: encodeBase64Url(new Uint8Array(signature)) };
}

/**
 * Verifies content integrity and signature using an already trusted public key.
 * Key lookup, revocation, persistence, and audit-chain ordering are deliberately
 * external responsibilities; this helper does not pretend to provide them.
 */
export async function verifyEconomicAuditRecord(
  record: unknown,
  trustedPublicKey: CryptoKey,
): Promise<boolean> {
  try {
    if (!record || typeof record !== "object" || Array.isArray(record)) return false;
    const value = record as Record<string, unknown>;
    const expectedKeys = [
      "protocol",
      "signer_key_id",
      "issued_at",
      "payload_digest",
      "payload",
      "signature",
    ];
    if (Object.keys(value).some((key) => !expectedKeys.includes(key))) return false;
    if (expectedKeys.some((key) => !Object.prototype.hasOwnProperty.call(value, key))) return false;

    const signed = value as unknown as SignedEconomicAuditRecord;
    if (signed.protocol !== ECONOMIC_AUDIT_PROTOCOL) return false;
    if (!isSafeEconomicId(signed.signer_key_id)) return false;
    if (parseEconomicTimestamp(signed.issued_at) === null) return false;
    if (!SHA256_BASE64URL.test(signed.payload_digest)) return false;
    if (typeof signed.signature !== "string" || !BASE64URL_SIGNATURE.test(signed.signature)) {
      return false;
    }
    if (!isAuditPayload(signed.payload) || signed.issued_at !== signed.payload.decided_at) {
      return false;
    }

    const digest = await sha256Base64Url(canonicalizeJson(signed.payload));
    if (digest !== signed.payload_digest) return false;

    return await crypto.subtle.verify(
      { name: "ECDSA", hash: { name: "SHA-256" } },
      trustedPublicKey,
      decodeBase64Url(signed.signature),
      new TextEncoder().encode(canonicalizeJson(signableAuditValue(signed))),
    );
  } catch {
    return false;
  }
}

export function isEconomicAuditPayload(value: unknown): value is EconomicAuditPayload {
  return isAuditPayload(value);
}

export function isEconomicActionPayload(value: unknown): value is EconomicAction {
  return isEconomicAction(value);
}
