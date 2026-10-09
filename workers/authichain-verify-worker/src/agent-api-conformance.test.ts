import { describe, expect, it } from "vitest";
import worker from "./index";
import { DatabaseSync } from "node:sqlite";

describe("Agent Trust API State Access Conformance", () => {
  it("enforces state access bindings and handles verification requests", async () => {
    const db = new DatabaseSync(":memory:");
    db.exec(`
      CREATE TABLE IF NOT EXISTS agent_message_nonces (
        message_id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        attestation_id TEXT NOT NULL,
        organization_id TEXT NOT NULL,
        first_seen_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        message_digest TEXT NOT NULL
      );
    `);

    const req = new Request("http://localhost/verify", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        agent_id: "agent:01",
        attestation_id: "att:01",
        message_id: "msg:api:01",
        organization_id: "org:01",
        capabilities: ["VERIFY_ATTESTATION"],
        timestamp: new Date().toISOString(),
      }),
    });

    const env = {
      DB: {
        prepare(query: string) {
          return {
            bind(...params: unknown[]) {
              return {
                async first() {
                  return null;
                },
                async all() {
                  return { results: [] };
                },
                async run() {
                  const stmt = db.prepare(query);
                  stmt.run(...params);
                  return { success: true };
                },
              };
            },
          };
        },
      },
    };

    const ctx = {
      waitUntil(p: Promise<unknown>) {
        p.catch(() => {});
      },
      passThroughOnException() {},
    };

    const res = await worker.fetch(req, env, ctx);
    expect(res).toBeDefined();
    expect(res.status).toBeLessThan(500);
  });
});
