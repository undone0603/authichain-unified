export const AGENT_CAPABILITIES = [
  "VERIFY_ATTESTATION",
  "READ_EVIDENCE",
  "CREATE_AUDIT_RECORD",
  "PROPOSE_LIFECYCLE_ACTION",
  "RESOLVE_IDENTIFIER",
  "PROPOSE_ECONOMIC_ACTION",
  "TRANSFER_VALUE",
  "DEDUCT_VALUE",
  "MINT_VALUE",
] as const;

export type AgentCapability = (typeof AGENT_CAPABILITIES)[number];

export function isAgentCapability(cap: string): cap is AgentCapability {
  return (AGENT_CAPABILITIES as readonly string[]).includes(cap);
}

export function normalizeCapabilities(capabilities: string[]): AgentCapability[] {
  const set = new Set<AgentCapability>();
  for (const cap of capabilities) {
    if (!isAgentCapability(cap)) {
      throw new Error(`Invalid agent capability: ${cap}`);
    }
    set.add(cap);
  }
  return Array.from(set).sort();
}

export interface AgentIdentityAttestation {
  agent_id: string;
  organization_id: string;
  role: string;
  version: string;
  capabilities: AgentCapability[];
  public_key: string;
  policy_version: string;
  issued_at: string;
  effective_at: string;
  expires_at?: string;
  issuer_id: string;
  attestation_id: string;
  signature: string;
}

export interface AgentPassport {
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
}

export type AgentVerificationFailureReason =
  | "AGENT_NOT_FOUND"
  | "ATTESTATION_INVALID"
  | "ATTESTATION_EXPIRED"
  | "ATTESTATION_NOT_YET_EFFECTIVE"
  | "ATTESTATION_REVOKED"
  | "ISSUER_NOT_FOUND"
  | "ISSUER_SIGNATURE_INVALID"
  | "ISSUER_REVOKED"
  | "ORGANIZATION_MISMATCH"
  | "AGENT_ID_MISMATCH"
  | "ROLE_MISMATCH"
  | "VERSION_MISMATCH"
  | "POLICY_VERSION_MISMATCH"
  | "SIGNATURE_INVALID"
  | "MESSAGE_EXPIRED"
  | "MESSAGE_FUTURE_DATED"
  | "MESSAGE_REPLAYED"
  | "MESSAGE_ID_CONFLICT"
  | "CAPABILITY_NOT_GRANTED"
  | "MALFORMED_MESSAGE"
  | "UNSUPPORTED_PROTOCOL"
  | "INVALID_TIMESTAMP_ORDER"
  | "REPLAY_STORE_UNAVAILABLE";

export interface AgentMessageVerificationResult {
  valid: boolean;
  agent_id?: string;
  organization_id?: string;
  attestation_id?: string;
  reasons: AgentVerificationFailureReason[];
  capabilities?: AgentCapability[];
  policy_version?: string;
  message_digest?: string;
  /** Hash of the exact signature string observed by the verifier; binds later policy evaluation against signature mutation. */
  signature_digest?: string;
  verified_at: string;
}

export interface AgentIdentityResolver {
  resolve(
    agentId: string,
    attestationId: string,
  ): Promise<AgentIdentityAttestation | null>;
  isRevoked(attestationId: string): Promise<boolean>;
  getIssuerPublicKey(issuerId: string): Promise<string | null>;
  isIssuerRevoked(issuerId: string): Promise<boolean>;
}

export interface AgentReplayRecordParams {
  message_id: string;
  agent_id: string;
  attestation_id: string;
  organization_id: string;
  first_seen_at: string;
  expires_at: string;
  message_digest: string;
}

export interface AgentReplayStore {
  recordMessageNonce(
    params: AgentReplayRecordParams,
  ): Promise<{
    success: boolean;
    reason?: "MESSAGE_REPLAYED" | "MESSAGE_ID_CONFLICT";
  }>;
  purgeExpiredNonces(now: Date): Promise<number>;
}

export type AgentAuditEventType =
  | "VERIFICATION_SUCCESS"
  | "ISSUER_NOT_FOUND"
  | "ISSUER_SIGNATURE_INVALID"
  | "ISSUER_REVOKED"
  | "ATTESTATION_REVOKED"
  | "ATTESTATION_EXPIRED"
  | "ATTESTATION_NOT_YET_EFFECTIVE"
  | "ATTESTATION_INVALID"
  | "REPLAY_DETECTED"
  | "MESSAGE_ID_CONFLICT"
  | "REPLAY_STORE_UNAVAILABLE"
  | "MALFORMED_MESSAGE"
  | "CAPABILITY_DENIED"
  | "SIGNATURE_INVALID"
  | "BINDING_MISMATCH";

export interface AgentAuditEvent {
  event_type: AgentAuditEventType;
  timestamp: string;
  agent_id?: string;
  organization_id?: string;
  attestation_id?: string;
  issuer_id?: string;
  message_id?: string;
  message_digest?: string;
  reasons: AgentVerificationFailureReason[];
}

export interface AgentAuditSink {
  emit(event: AgentAuditEvent): void | Promise<void>;
}
