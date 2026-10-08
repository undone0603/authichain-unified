import { describe, expect, it } from "vitest";
import { DatabaseSync } from "node:sqlite";
import { D1AgentReplayStore } from "./agent-store";

const AGENT_TRUST_SCHEMA = `
CREATE TABLE IF NOT EXISTS agent_attestations (
  attestation_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  issuer_id TEXT NOT NULL,
  role TEXT NOT NULL,
  version TEXT NOT NULL,
  capabilities TEXT NOT NULL,
  policy_version TEXT NOT NULL,
  public_key TEXT NOT NULL,
  issued_at TEXT NOT NULL,
  effective_at TEXT NOT NULL,
  expires_at TEXT,
  signature TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_issuers (
  issuer_id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  public_key TEXT NOT NULL,
  is_revoked INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS agent_attestation_revocations (
  attestation_id TEXT PRIMARY KEY,
  revoked_at TEXT NOT NULL,
  reason TEXT NOT NULL,
  revoked_by TEXT NOT NULL,
  evidence_reference TEXT
);

CREATE TABLE IF NOT EXISTS agent_message_nonces (
  message_id TEXT PRIMARY KEY,
  agent_id TEXT NOT NULL,
  attestation_id TEXT NOT NULL,
  organization_id TEXT NOT NULL,
  first_seen_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  message_digest TEXT NOT NULL
);
`;

function createMockD1Database(db: DatabaseSync) {
  return {
    prepare(query: string) {
      return {
        bind(...params: unknown[]) {
          return {
            async first<T = Record<string, unknown>>(): Promise<T | null> {
              const stmt = db.prepare(query);
              const row = stmt.get(...params);
              return (row as T) || null;
            },
            async all<T = Record<string, unknown>>(): Promise<{
              results: T[];
            }> {
              const stmt = db.prepare(query);
              const rows = stmt.all(...params);
              return { results: rows as T[] };
            },
            async run(): Promise<{ success: boolean }> {
              const stmt = db.prepare(query);
              stmt.run(...params);
              return { success: true };
            },
          };
        },
      };
    },
  };
}

describe("D1 Replay Concurrency", () => {
  it("handles N simultaneous identical insertions with exactly 1 success and N-1 replayed", async () => {
    const db = new DatabaseSync(":memory:");
    db.exec(AGENT_TRUST_SCHEMA);

    const d1Mock = createMockD1Database(db);
    const store = new D1AgentReplayStore(d1Mock);

    const nonceParams = {
      message_id: "msg:race:1001",
      agent_id: "agent:01",
      attestation_id: "att:01",
      organization_id: "org:01",
      first_seen_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60000).toISOString(),
      message_digest: "digest:abc123xyz",
    };

    const N = 25;
    const promises = Array.from({ length: N }, () =>
      store.recordMessageNonce(nonceParams)
    );
    const results = await Promise.all(promises);

    const successes = results.filter(r => r.success);
    const replayed = results.filter(
      r => !r.success && r.reason === "MESSAGE_REPLAYED"
    );

    expect(successes.length).toBe(1);
    expect(replayed.length).toBe(N - 1);
  });

  it("rejects concurrent duplicate message_id with conflicting payload as MESSAGE_ID_CONFLICT", async () => {
    const db = new DatabaseSync(":memory:");
    db.exec(AGENT_TRUST_SCHEMA);

    const d1Mock = createMockD1Database(db);
    const store = new D1AgentReplayStore(d1Mock);

    const baseParams = {
      message_id: "msg:conflict:01",
      agent_id: "agent:01",
      attestation_id: "att:01",
      organization_id: "org:01",
      first_seen_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + 60000).toISOString(),
      message_digest: "digest:original",
    };

    const res1 = await store.recordMessageNonce(baseParams);
    expect(res1.success).toBe(true);

    const res2 = await store.recordMessageNonce({
      ...baseParams,
      message_digest: "digest:tampered-payload",
    });
    expect(res2.success).toBe(false);
    expect(res2.reason).toBe("MESSAGE_ID_CONFLICT");
  });

  it("purges expired nonces cleanly", async () => {
    const db = new DatabaseSync(":memory:");
    db.exec(AGENT_TRUST_SCHEMA);

    const d1Mock = createMockD1Database(db);
    const store = new D1AgentReplayStore(d1Mock);

    await store.recordMessageNonce({
      message_id: "msg:expired",
      agent_id: "agent:01",
      attestation_id: "att:01",
      organization_id: "org:01",
      first_seen_at: "2025-01-01T00:00:00.000Z",
      expires_at: "2025-01-01T00:01:00.000Z",
      message_digest: "digest:old",
    });

    const purged = await store.purgeExpiredNonces(
      new Date("2026-01-01T00:00:00.000Z")
    );
    expect(purged).toBe(1);
  });
});
