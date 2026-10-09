/**
 * Signed envelope for the economic control plane.
 *
 * The key passed to verifyControlPlaneMessage MUST come from a trusted,
 * currently valid Agent Trust attestation. This function validates the
 * envelope signature and bindings; it does not itself establish issuer trust
 * or execute/reserve an action.
 */
import { canonicalizeJson } from "./agent-message";
import { parseEconomicAction, type EconomicAction } from "./economic-action";

export const CONTROL_PLANE_MESSAGE_PROTOCOL = "authichain-control-plane/1" as const;

const MESSAGE_KEYS = new Set([
  "protocol",
  "message_id",
  "agent_id",
  "organization_id",
  "attestation_id",
  "policy_version",
  "issued_at",
  "expires_at",
  "action",
  "signature",
]);

export interface SignedControlPlaneMessage {
  protocol: typeof CONTROL_PLANE_MESSAGE_PROTOCOL;
  message_id: string;
  agent_id: string;
  organization_id: string;
  attestation_id: string;
  policy_version: string;
  issued_at: string;
  expires_at: string;
  action: EconomicAction;
  signature: string;
}

export type ControlPlaneVerificationReason =
  | "MALFORMED_MESSAGE"
  | "UNSUPPORTED_PROTOCOL"
  | "SIGNATURE_INVALID"
  | "MESSAGE_EXPIRED"
  | "MESSAGE_FUTURE_DATED"
  | "MESSAGE_LIFETIME_EXCEEDED"
  | "ACTION_BINDING_MISMATCH";

export interface ControlPlaneMessageVerificationResult {
  valid: boolean;
  reasons: ControlPlaneVerificationReason[];
  message_id?: string;
  agent_id?: string;
  organization_id?: string;
  attestation_id?: string;
  policy_version?: string;
  action?: EconomicAction;
  verified_at: string;
}

export interface VerifyControlPlaneMessageOptions {
  now?: Date;
  clockSkewSeconds?: number;
  maxLifetimeSeconds?: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function isId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9][A-Za-z0-9._:/-]{0,127}$/.test(value);
}

function isCanonicalUtcTimestamp(value: unknown): value is string {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(value)
  ) return false;
  const ms = Date.parse(value);
  return Number.isFinite(ms) && new Date(ms).toISOString() === value;
}

function decodeBase64(value: string): Uint8Array {
  if (
    value.length === 0 ||
    !/^[A-Za-z0-9+/_-]+={0,2}$/.test(value) ||
    value.length % 4 === 1
  ) throw new TypeError("Invalid base64 signature or key");
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4)) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

async function importVerificationKey(publicKey: string): Promise<CryptoKey> {
  const trimmed = publicKey.trim();
  if (!trimmed) throw new TypeError("Missing public key");
  if (trimmed.startsWith("{")) {
    const jwk: unknown = JSON.parse(trimmed);
    if (!isRecord(jwk) || jwk.kty !== "EC" || jwk.crv !== "P-256") {
      throw new TypeError("Expected an EC P-256 public JWK");
    }
    if (typeof jwk.d === "string") throw new TypeError("Private JWK material is not accepted");
    return crypto.subtle.importKey(
      "jwk",
      jwk as unknown as JsonWebKey,
      { name: "ECDSA", namedCurve: "P-256" },
      false,
      ["verify"],
    );
  }
  return crypto.subtle.importKey(
    "spki",
    decodeBase64(trimmed),
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"],
  );
}

function parseSignedMessage(input: unknown, requireSignature = true): SignedControlPlaneMessage {
  if (!isRecord(input)) throw new TypeError("Message must be a plain object");
  for (const key of Object.keys(input)) {
    if (!MESSAGE_KEYS.has(key)) throw new TypeError(`Unknown message field: ${key}`);
  }
  if (input.protocol !== CONTROL_PLANE_MESSAGE_PROTOCOL) {
    throw new TypeError("Unsupported protocol");
  }
  if (
    !isId(input.message_id) ||
    !isId(input.agent_id) ||
    !isId(input.organization_id) ||
    !isId(input.attestation_id) ||
    !isId(input.policy_version) ||
    !isCanonicalUtcTimestamp(input.issued_at) ||
    !isCanonicalUtcTimestamp(input.expires_at) ||
    (input.signature !== undefined && typeof input.signature !== "string") ||
    (requireSignature && (typeof input.signature !== "string" || input.signature.length === 0))
  ) throw new TypeError("Malformed control-plane message");

  const action = parseEconomicAction(input.action);
  if (
    action.agent_id !== input.agent_id ||
    action.organization_id !== input.organization_id ||
    action.attestation_id !== input.attestation_id ||
    action.policy_version !== input.policy_version
  ) throw new TypeError("Economic action does not match signed identity/policy envelope");

  const issued = Date.parse(input.issued_at);
  const expires = Date.parse(input.expires_at);
  if (expires <= issued) throw new TypeError("Invalid message timestamp order");
  if (
    Date.parse(action.created_at) < issued ||
    Date.parse(action.created_at) > expires ||
    Date.parse(action.expires_at) > expires
  ) throw new TypeError("Action is outside the signed message time window");

  return {
    protocol: CONTROL_PLANE_MESSAGE_PROTOCOL,
    message_id: input.message_id,
    agent_id: input.agent_id,
    organization_id: input.organization_id,
    attestation_id: input.attestation_id,
    policy_version: input.policy_version,
    issued_at: input.issued_at,
    expires_at: input.expires_at,
    action,
    signature: typeof input.signature === "string" ? input.signature : "",
  };
}

/** Build canonical signing bytes from a strict, fully bound action message. */
export function canonicalizeControlPlaneMessage(input: unknown): string {
  const message = parseSignedMessage(input, false);
  return canonicalizeJson({
    domain_separator: "authichain-control-plane-message/1",
    protocol: message.protocol,
    message_id: message.message_id,
    agent_id: message.agent_id,
    organization_id: message.organization_id,
    attestation_id: message.attestation_id,
    policy_version: message.policy_version,
    issued_at: message.issued_at,
    expires_at: message.expires_at,
    action: message.action,
  });
}

/**
 * Verify a signed proposal. Caller must resolve publicKey through the trusted
 * identity/issuer path before calling this function. All failures are closed.
 */
export async function verifyControlPlaneMessage(
  input: unknown,
  publicKey: string,
  options: VerifyControlPlaneMessageOptions = {},
): Promise<ControlPlaneMessageVerificationResult> {
  const now = options.now ?? new Date();
  const verifiedAt = now.toISOString();
  const fail = (
    reason: ControlPlaneVerificationReason,
    parsed?: SignedControlPlaneMessage,
  ): ControlPlaneMessageVerificationResult => ({
    valid: false,
    reasons: [reason],
    verified_at: verifiedAt,
    ...(parsed ? {
      message_id: parsed.message_id,
      agent_id: parsed.agent_id,
      organization_id: parsed.organization_id,
      attestation_id: parsed.attestation_id,
      policy_version: parsed.policy_version,
      action: parsed.action,
    } : {}),
  });

  let message: SignedControlPlaneMessage;
  try {
    message = parseSignedMessage(input);
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "";
    return fail(messageText.includes("Unsupported protocol")
      ? "UNSUPPORTED_PROTOCOL"
      : "MALFORMED_MESSAGE");
  }

  const issuedMs = Date.parse(message.issued_at);
  const expiresMs = Date.parse(message.expires_at);
  const skewMs = Math.max(0, options.clockSkewSeconds ?? 30) * 1000;
  const maxLifetimeMs = Math.max(1, options.maxLifetimeSeconds ?? 300) * 1000;
  if (expiresMs - issuedMs > maxLifetimeMs) {
    return fail("MESSAGE_LIFETIME_EXCEEDED", message);
  }
  if (now.getTime() < issuedMs - skewMs) return fail("MESSAGE_FUTURE_DATED", message);
  if (now.getTime() > expiresMs + skewMs) return fail("MESSAGE_EXPIRED", message);

  try {
    const key = await importVerificationKey(publicKey);
    const valid = await crypto.subtle.verify(
      { name: "ECDSA", hash: { name: "SHA-256" } },
      key,
      decodeBase64(message.signature),
      new TextEncoder().encode(canonicalizeJson({
        domain_separator: "authichain-control-plane-message/1",
        protocol: message.protocol,
        message_id: message.message_id,
        agent_id: message.agent_id,
        organization_id: message.organization_id,
        attestation_id: message.attestation_id,
        policy_version: message.policy_version,
        issued_at: message.issued_at,
        expires_at: message.expires_at,
        action: message.action,
      })),
    );
    if (!valid) return fail("SIGNATURE_INVALID", message);
  } catch {
    return fail("SIGNATURE_INVALID", message);
  }

  return {
    valid: true,
    reasons: [],
    message_id: message.message_id,
    agent_id: message.agent_id,
    organization_id: message.organization_id,
    attestation_id: message.attestation_id,
    policy_version: message.policy_version,
    action: message.action,
    verified_at: verifiedAt,
  };
}
