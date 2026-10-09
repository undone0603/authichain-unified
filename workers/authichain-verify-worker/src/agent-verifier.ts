import type {
  AgentAuditEvent,
  AgentAuditSink,
  AgentIdentityAttestation,
  AgentIdentityResolver,
  AgentMessageVerificationResult,
  AgentReplayStore,
  AgentVerificationFailureReason,
  AgentCapability,
} from "./agent-types";
import { normalizeCapabilities } from "./agent-types";
import {
  canonicalizeAgentIdentityAttestation,
  canonicalizeAgentMessage,
  agentMessageDigest,
  sha256Base64Url,
  type SignedAgentMessage,
} from "./agent-message";

export interface VerifyAgentMessageOptions {
  resolver: AgentIdentityResolver;
  replayStore: AgentReplayStore;
  auditSink?: AgentAuditSink;
  now?: Date;
  clockSkewSeconds?: number;
}

function base64ToUint8Array(base64: string): Uint8Array {
  const clean = base64.replace(/-/g, "+").replace(/_/g, "/");
  const pad = clean.length % 4;
  const normalized = pad === 0 ? clean : clean + "=".repeat(4 - pad);
  const bin = atob(normalized);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

async function importPublicKey(keyData: string): Promise<CryptoKey> {
  const trimmed = keyData.trim();
  if (!trimmed) throw new TypeError("Empty public key");
  if (trimmed.startsWith("{")) {
    const jwk = JSON.parse(trimmed);
    return crypto.subtle.importKey(
      "jwk",
      jwk,
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["verify"],
    );
  }
  return crypto.subtle.importKey(
    "spki",
    base64ToUint8Array(trimmed),
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["verify"],
  );
}

function parseTimestamp(value: string): number | null {
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function lifecycleReason(
  attestation: AgentIdentityAttestation,
  nowMs: number,
  skewMs: number,
): AgentVerificationFailureReason | null {
  const issued = parseTimestamp(attestation.issued_at);
  const effective = parseTimestamp(attestation.effective_at);
  const expires = attestation.expires_at ? parseTimestamp(attestation.expires_at) : null;

  if (issued === null || effective === null || (attestation.expires_at && expires === null)) {
    return "ATTESTATION_INVALID";
  }
  if (effective < issued || (expires !== null && expires <= effective)) {
    return "INVALID_TIMESTAMP_ORDER";
  }
  if (nowMs < effective - skewMs) return "ATTESTATION_NOT_YET_EFFECTIVE";
  if (expires !== null && nowMs > expires + skewMs) return "ATTESTATION_EXPIRED";
  return null;
}

export function createAgentPassport(
  attestation: AgentIdentityAttestation,
  isRevoked: boolean,
  now = new Date(),
): {
  agent_id: string;
  organization_id: string;
  issuer_id: string;
  role: string;
  version: string;
  capabilities: AgentCapability[];
  policy_version: string;
  public_key: string;
  effective_at: string;
  expires_at?: string;
  attestation_id: string;
  status: "ACTIVE" | "EXPIRED" | "NOT_YET_EFFECTIVE" | "REVOKED";
} {
  const nowMs = now.getTime();
  const effective = parseTimestamp(attestation.effective_at);
  const expires = attestation.expires_at ? parseTimestamp(attestation.expires_at) : null;
  let status: "ACTIVE" | "EXPIRED" | "NOT_YET_EFFECTIVE" | "REVOKED" = "ACTIVE";
  if (isRevoked) status = "REVOKED";
  else if (expires !== null && nowMs > expires) status = "EXPIRED";
  else if (effective === null || nowMs < effective) status = "NOT_YET_EFFECTIVE";

  return {
    agent_id: attestation.agent_id,
    organization_id: attestation.organization_id,
    issuer_id: attestation.issuer_id,
    role: attestation.role,
    version: attestation.version,
    capabilities: [...attestation.capabilities],
    policy_version: attestation.policy_version,
    public_key: attestation.public_key,
    effective_at: attestation.effective_at,
    expires_at: attestation.expires_at,
    attestation_id: attestation.attestation_id,
    status,
  };
}

async function emitAudit(
  sink: AgentAuditSink | undefined,
  event: AgentAuditEvent,
): Promise<void> {
  if (!sink) return;
  try {
    await sink.emit(event);
  } catch {
    // Audit failure must never turn an otherwise valid trust decision into
    // authorization bypass; the decision remains governed by trust checks.
  }
}

export async function verifyAgentMessage(
  message: SignedAgentMessage<unknown>,
  options: VerifyAgentMessageOptions,
): Promise<AgentMessageVerificationResult> {
  const now = options.now ?? new Date();
  const skewMs = (options.clockSkewSeconds ?? 60) * 1000;
  const verifiedAt = now.toISOString();
  const reasons: AgentVerificationFailureReason[] = [];

  if (!message || typeof message !== "object") {
    return { valid: false, reasons: ["MALFORMED_MESSAGE"], verified_at: verifiedAt };
  }

  if (message.protocol !== "authichain-agent/1") {
    return { valid: false, reasons: ["UNSUPPORTED_PROTOCOL"], verified_at: verifiedAt };
  }

  if (
    !message.message_id ||
    !message.agent_id ||
    !message.organization_id ||
    !message.attestation_id ||
    !message.signature ||
    !message.role ||
    !message.version ||
    !message.policy_version ||
    !message.issued_at ||
    !message.expires_at ||
    !message.intent ||
    !Array.isArray(message.capabilities) ||
    !Array.isArray(message.evidence_ids)
  ) {
    return { valid: false, reasons: ["MALFORMED_MESSAGE"], verified_at: verifiedAt };
  }

  const attestation = await options.resolver.resolve(
    message.agent_id,
    message.attestation_id,
  );

  if (!attestation) {
    return {
      valid: false,
      agent_id: message.agent_id,
      organization_id: message.organization_id,
      attestation_id: message.attestation_id,
      reasons: ["AGENT_NOT_FOUND"],
      verified_at: verifiedAt,
    };
  }

  if (message.agent_id !== attestation.agent_id) reasons.push("AGENT_ID_MISMATCH");
  if (message.organization_id !== attestation.organization_id) reasons.push("ORGANIZATION_MISMATCH");
  if (message.role !== attestation.role) reasons.push("ROLE_MISMATCH");
  if (message.version !== attestation.version) reasons.push("VERSION_MISMATCH");
  if (message.policy_version !== attestation.policy_version) reasons.push("POLICY_VERSION_MISMATCH");

  let attestationRevoked = false;
  let issuerRevoked = false;
  try {
    attestationRevoked = await options.resolver.isRevoked(attestation.attestation_id);
    issuerRevoked = await options.resolver.isIssuerRevoked(attestation.issuer_id);
  } catch {
    reasons.push("ATTESTATION_INVALID");
  }
  if (attestationRevoked) reasons.push("ATTESTATION_REVOKED");
  if (issuerRevoked) reasons.push("ISSUER_REVOKED");

  const lifecycle = lifecycleReason(attestation, now.getTime(), skewMs);
  if (lifecycle) reasons.push(lifecycle);

  // Issuer trust is mandatory.
  try {
    const issuerPublicKey = await options.resolver.getIssuerPublicKey(attestation.issuer_id);
    if (!issuerPublicKey) {
      reasons.push("ISSUER_NOT_FOUND");
    } else {
      const issuerKey = await importPublicKey(issuerPublicKey);
      const attestationBytes = new TextEncoder().encode(
        canonicalizeAgentIdentityAttestation(attestation),
      );
      const issuerSignatureValid = await crypto.subtle.verify(
        { name: "ECDSA", hash: { name: "SHA-256" } },
        issuerKey,
        base64ToUint8Array(attestation.signature),
        attestationBytes,
      );
      if (!issuerSignatureValid) reasons.push("ISSUER_SIGNATURE_INVALID");
    }
  } catch {
    reasons.push("ISSUER_SIGNATURE_INVALID");
  }

  const issuedMs = parseTimestamp(message.issued_at);
  const expiresMs = parseTimestamp(message.expires_at);
  if (issuedMs === null || expiresMs === null || expiresMs <= issuedMs) {
    reasons.push("MALFORMED_MESSAGE");
  } else {
    if (now.getTime() > expiresMs + skewMs) reasons.push("MESSAGE_EXPIRED");
    if (now.getTime() < issuedMs - skewMs) reasons.push("MESSAGE_FUTURE_DATED");
  }

  let normalizedMessageCaps: AgentCapability[] = [];
  try {
    if (!message.capabilities.every((cap): cap is string => typeof cap === "string")) {
      throw new TypeError("Invalid capability type");
    }
    normalizedMessageCaps = normalizeCapabilities(message.capabilities);
    const attestedCaps = new Set(attestation.capabilities);
    for (const cap of normalizedMessageCaps) {
      if (!attestedCaps.has(cap)) {
        reasons.push("CAPABILITY_NOT_GRANTED");
        break;
      }
    }
  } catch {
    reasons.push("CAPABILITY_NOT_GRANTED");
  }

  let digest: string | undefined;
  let signatureDigest: string | undefined;
  try {
    digest = await agentMessageDigest(message);
    signatureDigest = await sha256Base64Url(message.signature);
  } catch {
    reasons.push("MALFORMED_MESSAGE");
  }

  try {
    const agentKey = await importPublicKey(attestation.public_key);
    const validSignature = await crypto.subtle.verify(
      { name: "ECDSA", hash: { name: "SHA-256" } },
      agentKey,
      base64ToUint8Array(message.signature),
      new TextEncoder().encode(canonicalizeAgentMessage(message)),
    );
    if (!validSignature) reasons.push("SIGNATURE_INVALID");
  } catch {
    reasons.push("SIGNATURE_INVALID");
  }

  if (reasons.length !== 0 || !digest || !signatureDigest) {
    await emitAudit(options.auditSink, {
      event_type: reasons.includes("CAPABILITY_NOT_GRANTED")
        ? "CAPABILITY_DENIED"
        : reasons.includes("ISSUER_SIGNATURE_INVALID")
          ? "ISSUER_SIGNATURE_INVALID"
          : reasons.includes("ISSUER_REVOKED")
            ? "ISSUER_REVOKED"
            : reasons.includes("ATTESTATION_REVOKED")
              ? "ATTESTATION_REVOKED"
              : reasons.includes("SIGNATURE_INVALID")
                ? "SIGNATURE_INVALID"
                : "BINDING_MISMATCH",
      timestamp: verifiedAt,
      agent_id: message.agent_id,
      organization_id: message.organization_id,
      attestation_id: message.attestation_id,
      issuer_id: attestation.issuer_id,
      message_id: message.message_id,
      message_digest: digest,
      reasons,
    });
    return {
      valid: false,
      agent_id: attestation.agent_id,
      organization_id: attestation.organization_id,
      attestation_id: attestation.attestation_id,
      reasons: [...new Set(reasons)],
      message_digest: digest,
      verified_at: verifiedAt,
    };
  }

  let replay;
  try {
    replay = await options.replayStore.recordMessageNonce({
      message_id: message.message_id,
      agent_id: attestation.agent_id,
      attestation_id: attestation.attestation_id,
      organization_id: attestation.organization_id,
      first_seen_at: message.issued_at,
      expires_at: message.expires_at,
      message_digest: digest,
    });
  } catch {
    await emitAudit(options.auditSink, {
      event_type: "REPLAY_STORE_UNAVAILABLE",
      timestamp: verifiedAt,
      agent_id: attestation.agent_id,
      organization_id: attestation.organization_id,
      attestation_id: attestation.attestation_id,
      issuer_id: attestation.issuer_id,
      message_id: message.message_id,
      message_digest: digest,
      reasons: ["REPLAY_STORE_UNAVAILABLE"],
    });
    return {
      valid: false,
      agent_id: attestation.agent_id,
      organization_id: attestation.organization_id,
      attestation_id: attestation.attestation_id,
      reasons: ["REPLAY_STORE_UNAVAILABLE"],
      message_digest: digest,
      verified_at: verifiedAt,
    };
  }

  if (!replay.success) {
    const reason = replay.reason === "MESSAGE_ID_CONFLICT"
      ? "MESSAGE_ID_CONFLICT"
      : "MESSAGE_REPLAYED";
    const event_type = reason === "MESSAGE_ID_CONFLICT" ? "MESSAGE_ID_CONFLICT" : "REPLAY_DETECTED";
    await emitAudit(options.auditSink, {
      event_type,
      timestamp: verifiedAt,
      agent_id: attestation.agent_id,
      organization_id: attestation.organization_id,
      attestation_id: attestation.attestation_id,
      issuer_id: attestation.issuer_id,
      message_id: message.message_id,
      message_digest: digest,
      reasons: [reason],
    });
    return {
      valid: false,
      agent_id: attestation.agent_id,
      organization_id: attestation.organization_id,
      attestation_id: attestation.attestation_id,
      reasons: [reason],
      message_digest: digest,
      verified_at: verifiedAt,
    };
  }

  await emitAudit(options.auditSink, {
    event_type: "VERIFICATION_SUCCESS",
    timestamp: verifiedAt,
    agent_id: attestation.agent_id,
    organization_id: attestation.organization_id,
    attestation_id: attestation.attestation_id,
    issuer_id: attestation.issuer_id,
    message_id: message.message_id,
    message_digest: digest,
    reasons: [],
  });

  return {
    valid: true,
    agent_id: attestation.agent_id,
    organization_id: attestation.organization_id,
    attestation_id: attestation.attestation_id,
    reasons: [],
    capabilities: normalizedMessageCaps,
    policy_version: message.policy_version,
    message_digest: digest,
    signature_digest: signatureDigest,
    verified_at: verifiedAt,
  };
}
