import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * recordStatusEvent against an in-memory attestation_status_events table that
 * enforces the real unique index (issuer_id, idempotency_key) and the
 * upsert(ignoreDuplicates) semantics PostgREST gives us.
 *
 * The bug this guards: a retry key is issuer-scoped, and every AuthiChain
 * attestation shares one issuer, so a key reused for a DIFFERENT lifecycle
 * fact (another attestation, or the `attestation.issued` row QRON writes with
 * key = attestation_id) was swallowed by ignoreDuplicates and the existing
 * event id came back as if the new fact had been written. The revoke route
 * then answered 200 claim_status=revoked for a revocation that never happened.
 */

type Row = Record<string, unknown>;
const table: Row[] = [];
let nextId = 1;

function builder() {
  const filters: Array<[string, unknown]> = [];
  let pendingInsert: Row | null = null;
  const matches = () =>
    table.filter(r => filters.every(([k, v]) => r[k] === v));
  const api = {
    upsert(row: Row, opts: { onConflict: string; ignoreDuplicates: boolean }) {
      const keys = opts.onConflict.split(",");
      const clash = table.find(r => keys.every(k => r[k] === row[k]));
      if (!clash) table.push({ ...row, event_id: `evt-${nextId++}` });
      return Promise.resolve({ error: null });
    },
    insert(row: Row) {
      pendingInsert = { ...row, event_id: `evt-${nextId++}` };
      table.push(pendingInsert);
      return api;
    },
    select(_cols: string) {
      return api;
    },
    eq(key: string, value: unknown) {
      filters.push([key, value]);
      return api;
    },
    single() {
      if (pendingInsert) return Promise.resolve({ data: pendingInsert, error: null });
      const found = matches();
      return Promise.resolve(
        found.length === 1
          ? { data: found[0], error: null }
          : { data: null, error: { message: "not exactly one row" } },
      );
    },
  };
  return api;
}

vi.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ from: () => builder() }),
}));

const { recordStatusEvent } = await import("./attestation-registry");

const env = { SUPABASE_URL: "https://example.supabase.co", SUPABASE_SERVICE_ROLE_KEY: "service" };
const ISSUER = "https://authichain.com";

beforeEach(() => {
  table.length = 0;
  nextId = 1;
});

describe("recordStatusEvent idempotency", () => {
  it("a retry of the same lifecycle fact returns the original event", async () => {
    const input = {
      eventType: "attestation.revoked" as const,
      attestationId: "urn:a",
      issuerId: ISSUER,
      idempotencyKey: "k1",
    };
    const first = await recordStatusEvent(env, input);
    const retry = await recordStatusEvent(env, input);
    expect(first).toEqual({ ok: true, eventId: "evt-1" });
    expect(retry).toEqual({ ok: true, eventId: "evt-1" });
    expect(table).toHaveLength(1);
  });

  it("refuses a key already used to revoke a different attestation", async () => {
    await recordStatusEvent(env, {
      eventType: "attestation.revoked",
      attestationId: "urn:a",
      issuerId: ISSUER,
      idempotencyKey: "k1",
    });
    const reuse = await recordStatusEvent(env, {
      eventType: "attestation.revoked",
      attestationId: "urn:b",
      issuerId: ISSUER,
      idempotencyKey: "k1",
    });
    expect(reuse).toMatchObject({ ok: false, status: 409 });
    expect(table.filter(r => r.attestation_id === "urn:b")).toHaveLength(0);
  });

  it("refuses a revoke whose key collides with the issued event (QRON uses key = attestation_id)", async () => {
    await recordStatusEvent(env, {
      eventType: "attestation.issued",
      attestationId: "urn:qron:1",
      issuerId: ISSUER,
      idempotencyKey: "urn:qron:1",
    });
    const revoke = await recordStatusEvent(env, {
      eventType: "attestation.revoked",
      attestationId: "urn:qron:1",
      issuerId: ISSUER,
      idempotencyKey: "urn:qron:1",
    });
    expect(revoke).toMatchObject({ ok: false, status: 409 });
    expect(table.some(r => r.event_type === "attestation.revoked")).toBe(false);
  });

  it("refuses a supersede retry that names a different replacement", async () => {
    await recordStatusEvent(env, {
      eventType: "attestation.superseded",
      attestationId: "urn:a",
      issuerId: ISSUER,
      idempotencyKey: "s1",
      supersedesAttestationId: "urn:a2",
    });
    const reuse = await recordStatusEvent(env, {
      eventType: "attestation.superseded",
      attestationId: "urn:a",
      issuerId: ISSUER,
      idempotencyKey: "s1",
      supersedesAttestationId: "urn:a3",
    });
    expect(reuse).toMatchObject({ ok: false, status: 409 });
  });

  it("writes without a key insert a fresh event every time", async () => {
    const a = await recordStatusEvent(env, {
      eventType: "attestation.revoked",
      attestationId: "urn:a",
      issuerId: ISSUER,
    });
    expect(a).toEqual({ ok: true, eventId: "evt-1" });
    expect(table).toHaveLength(1);
  });

  it("fails closed when the registry is not configured", async () => {
    const r = await recordStatusEvent({}, {
      eventType: "attestation.revoked",
      attestationId: "urn:a",
      issuerId: ISSUER,
      idempotencyKey: "k1",
    });
    expect(r).toMatchObject({ ok: false, status: 503 });
  });
});
