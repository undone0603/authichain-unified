import type {
  AgentCapability,
  AgentIdentityAttestation,
  AgentIdentityResolver,
  AgentReplayRecordParams,
  AgentReplayStore,
} from "./agent-types";
import { normalizeCapabilities } from "./agent-types";

export interface D1DatabaseLike {
  prepare(query: string): {
    bind(...params: unknown[]): {
      first<T = Record<string, unknown>>(): Promise<T | null>;
      all<T = Record<string, unknown>>(): Promise<{ results: T[] }>;
      run(): Promise<{ success: boolean; meta?: { changes?: number } }>;
    };
  };
}

export class MemoryAgentReplayStore implements AgentReplayStore {
  private readonly nonces = new Map<string, AgentReplayRecordParams>();

  async recordMessageNonce(params: AgentReplayRecordParams) {
    const existing = this.nonces.get(params.message_id);
    if (!existing) {
      this.nonces.set(params.message_id, { ...params });
      return { success: true } as const;
    }
    return existing.message_digest === params.message_digest
      ? { success: false, reason: "MESSAGE_REPLAYED" as const }
      : { success: false, reason: "MESSAGE_ID_CONFLICT" as const };
  }

  async purgeExpiredNonces(now: Date): Promise<number> {
    const nowMs = now.getTime();
    let deleted = 0;
    for (const [id, record] of this.nonces) {
      const expiry = Date.parse(record.expires_at);
      if (Number.isFinite(expiry) && expiry < nowMs) {
        this.nonces.delete(id);
        deleted++;
      }
    }
    return deleted;
  }
}

export class D1AgentReplayStore implements AgentReplayStore {
  constructor(private readonly db: D1DatabaseLike) {}

  async recordMessageNonce(params: AgentReplayRecordParams) {
    const result = await this.db
      .prepare(
        `INSERT INTO agent_message_nonces (
          message_id, agent_id, attestation_id, organization_id,
          first_seen_at, expires_at, message_digest
        ) VALUES (?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(message_id) DO NOTHING`,
      )
      .bind(
        params.message_id,
        params.agent_id,
        params.attestation_id,
        params.organization_id,
        params.first_seen_at,
        params.expires_at,
        params.message_digest,
      )
      .run();

    if (result.meta?.changes === 1) return { success: true } as const;

    const existing = await this.db
      .prepare(
        "SELECT message_digest FROM agent_message_nonces WHERE message_id = ?",
      )
      .bind(params.message_id)
      .first<{ message_digest: string }>();

    if (!existing) {
      throw new Error("Replay store write succeeded neither by insertion nor observation");
    }

    return existing.message_digest === params.message_digest
      ? { success: false, reason: "MESSAGE_REPLAYED" as const }
      : { success: false, reason: "MESSAGE_ID_CONFLICT" as const };
  }

  async purgeExpiredNonces(now: Date): Promise<number> {
    const result = await this.db
      .prepare("DELETE FROM agent_message_nonces WHERE expires_at < ?")
      .bind(now.toISOString())
      .run();
    return Number(result.meta?.changes ?? 0);
  }
}

export class D1AgentIdentityResolver implements AgentIdentityResolver {
  constructor(private readonly db: D1DatabaseLike) {}

  async resolve(agentId: string, attestationId: string): Promise<AgentIdentityAttestation | null> {
    const row = await this.db
      .prepare(
        `SELECT attestation_id, agent_id, organization_id, issuer_id,
                role, version, capabilities, policy_version, public_key,
                issued_at, effective_at, expires_at, signature
         FROM agent_attestations
         WHERE agent_id = ? AND attestation_id = ?`,
      )
      .bind(agentId, attestationId)
      .first<Record<string, unknown>>();

    if (!row) return null;

    let capabilitiesRaw: unknown;
    try {
      capabilitiesRaw = JSON.parse(String(row.capabilities));
    } catch {
      return null;
    }

    if (!Array.isArray(capabilitiesRaw) || !capabilitiesRaw.every((x): x is string => typeof x === "string")) {
      return null;
    }

    let capabilities: AgentCapability[];
    try {
      capabilities = normalizeCapabilities(capabilitiesRaw);
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
      capabilities,
      policy_version: String(row.policy_version),
      public_key: String(row.public_key),
      issued_at: String(row.issued_at),
      effective_at: String(row.effective_at),
      expires_at: row.expires_at == null ? undefined : String(row.expires_at),
      signature: String(row.signature),
    };
  }

  async isRevoked(attestationId: string): Promise<boolean> {
    const row = await this.db
      .prepare(
        "SELECT 1 AS revoked FROM agent_attestation_revocations WHERE attestation_id = ? LIMIT 1",
      )
      .bind(attestationId)
      .first<{ revoked: number }>();
    return row !== null;
  }

  async getIssuerPublicKey(issuerId: string): Promise<string | null> {
    const row = await this.db
      .prepare("SELECT public_key FROM agent_issuers WHERE issuer_id = ? LIMIT 1")
      .bind(issuerId)
      .first<{ public_key: string }>();
    return row?.public_key ?? null;
  }

  async isIssuerRevoked(issuerId: string): Promise<boolean> {
    const row = await this.db
      .prepare(
        "SELECT is_revoked FROM agent_issuers WHERE issuer_id = ? LIMIT 1",
      )
      .bind(issuerId)
      .first<{ is_revoked: number }>();
    return row ? Boolean(row.is_revoked) : false;
  }
}
