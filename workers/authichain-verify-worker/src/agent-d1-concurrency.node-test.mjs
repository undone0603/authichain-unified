import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { D1AgentReplayStore } from "./agent-store.ts";

function makeDb() {
  const db = new DatabaseSync(":memory:");
  db.exec(`
    CREATE TABLE agent_message_nonces (
      message_id TEXT PRIMARY KEY,
      agent_id TEXT NOT NULL,
      attestation_id TEXT NOT NULL,
      organization_id TEXT NOT NULL,
      first_seen_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      message_digest TEXT NOT NULL
    );
    CREATE INDEX idx_agent_message_nonces_expiry
      ON agent_message_nonces(expires_at);
  `);

  return {
    prepare(query) {
      return {
        bind(...params) {
          return {
            async first() {
              return db.prepare(query).get(...params) ?? null;
            },
            async run() {
              const result = db.prepare(query).run(...params);
              return { success: true, meta: { changes: Number(result.changes) } };
            },
          };
        },
      };
    },
    close() {
      db.close();
    },
  };
}

function params(overrides = {}) {
  return {
    message_id: "msg:race:1001",
    agent_id: "agent:race",
    attestation_id: "att:race",
    organization_id: "org:race",
    first_seen_at: "2026-10-08T19:00:00.000Z",
    expires_at: "2026-10-08T19:05:00.000Z",
    message_digest: "digest:race",
    ...overrides,
  };
}

test("D1 replay store accepts exactly one of 25 concurrent identical presentations", async () => {
  const db = makeDb();
  try {
    const store = new D1AgentReplayStore(db);
    const results = await Promise.all(
      Array.from({ length: 25 }, () => store.recordMessageNonce(params())),
    );
    assert.equal(results.filter((r) => r.success).length, 1);
    assert.equal(
      results.filter((r) => r.reason === "MESSAGE_REPLAYED").length,
      24,
    );
  } finally {
    db.close();
  }
});

test("D1 replay store rejects same message ID with a conflicting digest", async () => {
  const db = makeDb();
  try {
    const store = new D1AgentReplayStore(db);
    assert.deepEqual(await store.recordMessageNonce(params()), { success: true });
    assert.deepEqual(
      await store.recordMessageNonce(params({ message_digest: "digest:tampered" })),
      { success: false, reason: "MESSAGE_ID_CONFLICT" },
    );
  } finally {
    db.close();
  }
});

test("D1 replay store purges expired nonces", async () => {
  const db = makeDb();
  try {
    const store = new D1AgentReplayStore(db);
    await store.recordMessageNonce(
      params({ expires_at: "2026-10-08T18:59:00.000Z" }),
    );
    assert.equal(
      await store.purgeExpiredNonces(new Date("2026-10-08T19:00:00.000Z")),
      1,
    );
  } finally {
    db.close();
  }
});
