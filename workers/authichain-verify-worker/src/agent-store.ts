import {
  AgentCapability,
  AgentIdentityAttestation,
  AgentIdentityResolver,
  normalizeCapabilities,
} from "./agent-types";

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
  recordMessageNonce(params: AgentReplayRecordParams): Promise<{
    success: boolean;
    reason?: "MESSAGE_REPLAYED" | "MESSAGE_ID_CONFLICT";
  }>;
  purgeExpiredNonces(now: Date): Promise<number>;
}

export class MemoryAgentReplayStore implements AgentReplayStore {
  private nonces = new Map<string, AgentReplayRecordParams>();

  async recordMessageNonce(params: AgentReplayRecordParams): Promise<{
    success: boolean;
    reason?: "MESSAGE_REPLAYED" | "MESSAGE_ID_CONFLICT";
  }> {
    const existing = this.nonces.get(params.message_id);
    if (!existing) {
      this.nonces.set(params.message_id, { ...params });
      return { success: true };
    }
    if (existing.message_digest === params.message_digest) {
      return { success: false, reason: "MESSAGE_REPLAYED" };
    }
    return { success: false, reason: "MESSAGE_ID_CONFLICT" };
  }

  async purgeExpiredNonces(now: Date): Promise<number> {
    const nowMs = now.getTime();
    let count = 0;
    for (const [id, record] of Array.from(this.nonces.entries())) {
      if (Date.parse(record.expires_at) < nowMs) {
        this.nonces.delete(id);
        count++;
      }
    }
    return count;
  }
}

export interface D1DatabaseLike {
  prepare(query: string): {
    bind(...params: unknown[]): {
      first<T = Record<string, unknown>>(): Promise<T | null>;
      all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
      run(): Promise<{ success: boolean; meta?: Record<string, unknown> }>;
    };
  };
}

export class D1AgentReplayStore implements AgentReplayStore {
  constructor(private db: D1DatabaseLike) {}

  async recordMessageNonce(params: AgentReplayRecordParams): Promise<{
    success: boolean;
    reason?: "MESSAGE_REPLAYED" | "MESSAGE_ID_CONFLICT";
  }> {
    try {
      await this.db
        .prepare(
          `INSERT INTO agent_message_nonces (
            message_id, agent_id, attestation_id, organization_id, first_seen_at, expires_at, message_digest
          ) VALUES (?, ?, ?, ?, ?, ?, ?) ON CONFLICT DO NOTHING`
        )
        .bind(
          params.message_id,
          params.agent_id,
          params.attestation_id,
          params.organization_id,
          params.first_seen_at,
          params.expires_at,
          params.message_digest
        )
        .run();

      return { success: true };
    } catch {
      const existing = await this.db
        .prepare(
          "SELECT message_digest FROM agent_message_nonces WHERE message_id = ?"
        )
        .bind(params.message_id)
        .first<{ message_digest: string }>();

      if (existing && existing.message_digest === params.message_digest) {
        return { success: false, reason: "MESSAGE_REPLAYED" };
      }
      return { success: false, reason: "MESSAGE_ID_CONFLICT" };
    }
  }

  async purgeExpiredNonces(now: Date): Promise<number> {
    await this.db
      .prepare("DELETE FROM agent_message_nonces WHERE expires_at < ?")
      .bind(now.toISOString())
      .run();
    return 1;
  }
}

export class D1AgentIdentityResolver implements AgentIdentityResolver {
  constructor(private db: D1DatabaseLike) {}

  async resolve(
    agentId: string,
    attestationId: string
  ): Promise<AgentIdentityAttestation | null> {
    const row = await this.db
      .prepare(
        `SELECT attestation_id, agent_id, organization_id, issuer_id, role, version,
                capabilities, policy_version, public_key, issued_at, effective_at,
                expires_at, signature
         FROM agent_attestations
         WHERE agent_id = ? AND attestation_id = ?`
      )
      .bind(agentId, attestationId)
      .first<Record<string, unknown>>();

    if (!row) return null;

    let parsedCaps: string[] = [];
    try {
      parsedCaps = JSON.parse(String(row.capabilities));
    } catch {
      return null;
    }

    let validatedCaps: AgentCapability[] = [];
    try {
      validatedCaps = normalizeCapabilities(parsedCaps);
    } catch {
      return null;
    }

    return {
      attestation_id: String(row.attestation_id),
      agent_id: String(row.agent_id),
      organization_id: String(row.organization_id),
      issuer_id: String(row.issuer_id),
      role: String(row.role),
      version: String(row.version),
      capabilities: validatedCaps,
      policy_version: String(row.policy_version),
      public_key: String(row.public_key),
      issued_at: String(row.issued_at),
      effective_at: String(row.effective_at),
      expires_at: row.expires_at ? String(row.expires_at) : undefined,
      signature: String(row.signature),
    };
  }

  async isRevoked(attestationId: string): Promise<boolean> {
    const row = await this.db
      .prepare(
        "SELECT attestation_id FROM agent_attestation_revocations WHERE attestation_id = ?"
      )
      .bind(attestationId)
      .first();
    return row !== null;
  }

  async getIssuerPublicKey(issuerId: string): Promise<string | null> {
    const row = await this.db
      .prepare("SELECT public_key FROM agent_issuers WHERE issuer_id = ?")
      .bind(issuerId)
      .first<{ public_key: string }>();
    return row ? row.public_key : null;
  }

  async isIssuerRevoked(issuerId: string): Promise<boolean> {
    const row = await this.db
      .prepare("SELECT is_revoked FROM agent_issuers WHERE issuer_id = ?")
      .bind(issuerId)
      .first<{ is_revoked: number }>();
    return row ? Boolean(row.is_revoked) : false;
  }
}
