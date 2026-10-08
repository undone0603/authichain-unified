import type { AgentIdentityAttestation, AgentCapability } from "./agent-types";

export interface SignedAgentMessage<T = unknown> {
  protocol: "authichain-agent/1";
  message_id: string;
  agent_id: string;
  organization_id: string;
  attestation_id: string;
  role: string;
  version: string;
  capabilities: AgentCapability[];
  policy_version: string;
  issued_at: string;
  expires_at: string;
  intent: string;
  evidence_ids: string[];
  payload: T;
  signature: string;
}

function assertJsonString(value: string, context: string): void {
  for (let i = 0; i < value.length; i++) {
    const code = value.charCodeAt(i);
    if (code >= 0xd800 && code <= 0xdbff) {
      const next = value.charCodeAt(i + 1);
      if (next < 0xdc00 || next > 0xdfff) {
        throw new TypeError(`Lone high surrogate in ${context}`);
      }
      i++;
    } else if (code >= 0xdc00 && code <= 0xdfff) {
      throw new TypeError(`Lone low surrogate in ${context}`);
    }
  }
}

function canonicalNumber(value: number): string {
  if (!Number.isFinite(value)) {
    throw new TypeError("Non-finite numbers cannot be canonicalized");
  }
  if (Object.is(value, -0)) return "0";
  return JSON.stringify(value);
}

export function canonicalizeJson(value: unknown): string {
  if (value === null) return "null";
  if (typeof value === "boolean") return value ? "true" : "false";
  if (typeof value === "number") return canonicalNumber(value);
  if (typeof value === "string") {
    assertJsonString(value, "string");
    return JSON.stringify(value);
  }
  if (typeof value === "bigint" || typeof value === "undefined" || typeof value === "function" || typeof value === "symbol") {
    throw new TypeError(`Unsupported type for canonicalization: ${typeof value}`);
  }
  if (Array.isArray(value)) {
    return `[${value.map((item) => canonicalizeJson(item)).join(",")}]`;
  }
  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj).sort();
    const pairs = keys.map((key) => {
      assertJsonString(key, "object key");
      if (!(key in obj) || obj[key] === undefined) {
        throw new TypeError(`Undefined property cannot be canonicalized: ${key}`);
      }
      return `${JSON.stringify(key)}:${canonicalizeJson(obj[key])}`;
    });
    return `{${pairs.join(",")}}`;
  }
  throw new TypeError(`Unsupported type for canonicalization: ${typeof value}`);
}

function canonicalSignableMessage<T>(message: Omit<SignedAgentMessage<T>, "signature"> | SignedAgentMessage<T>): Record<string, unknown> {
  const signable = message as SignedAgentMessage<T>;
  return {
    domain_separator: "authichain-agent/1",
    protocol: signable.protocol,
    message_id: signable.message_id,
    agent_id: signable.agent_id,
    organization_id: signable.organization_id,
    attestation_id: signable.attestation_id,
    role: signable.role,
    version: signable.version,
    capabilities: [...signable.capabilities].sort(),
    policy_version: signable.policy_version,
    issued_at: signable.issued_at,
    expires_at: signable.expires_at,
    intent: signable.intent,
    evidence_ids: [...signable.evidence_ids].sort(),
    payload: signable.payload,
  };
}

export function canonicalizeAgentMessage<T>(
  message: Omit<SignedAgentMessage<T>, "signature"> | SignedAgentMessage<T>,
): string {
  return canonicalizeJson(canonicalSignableMessage(message));
}

export function canonicalizeAgentIdentityAttestation(
  attestation: Omit<AgentIdentityAttestation, "signature"> | AgentIdentityAttestation,
): string {
  const value = attestation as AgentIdentityAttestation;
  return canonicalizeJson({
    domain_separator: "authichain-agent-identity/1",
    agent_id: value.agent_id,
    organization_id: value.organization_id,
    issuer_id: value.issuer_id,
    role: value.role,
    version: value.version,
    capabilities: [...value.capabilities].sort(),
    policy_version: value.policy_version,
    public_key: value.public_key,
    issued_at: value.issued_at,
    effective_at: value.effective_at,
    ...(value.expires_at === undefined ? {} : { expires_at: value.expires_at }),
    attestation_id: value.attestation_id,
  });
}

function uint8ToBase64Url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

export async function sha256Base64Url(value: string | Uint8Array): Promise<string> {
  const bytes = typeof value === "string" ? new TextEncoder().encode(value) : value;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return uint8ToBase64Url(new Uint8Array(digest));
}

export async function agentMessageDigest<T>(
  message: Omit<SignedAgentMessage<T>, "signature"> | SignedAgentMessage<T>,
): Promise<string> {
  return sha256Base64Url(canonicalizeAgentMessage(message));
}
