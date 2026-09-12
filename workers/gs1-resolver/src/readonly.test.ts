/**
 * The read-only passport endpoint must never advance a seal's state.
 *
 * This is the fault worth a test rather than a comment: the app renders
 * passports from more than one region, so if a render counted as a scan, a
 * viewer refreshing the page would look like the multi-region burst that
 * drives active -> clone_suspected, and could mark a genuine seal cloned.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "./index.ts";

const SEAL = {
  id: "seal-1",
  lookup_key: "cert:ac-demo-001",
  gtin: "00012345678905",
  lot: null,
  serial: "AC-DEMO-001",
  expiry: null,
  cert_id: "AC-DEMO-001",
  brand: "Acme",
  product_name: "Widget",
  issuer: "Acme Inc",
  fingerprint_sha256: null,
  chain: "polygon",
  contract: null,
  tx_hash: null,
  status: "active",
  status_reason: null,
  first_country: "US",
  first_activated_at: 1_700_000_000_000,
  scan_count: 3,
  last_scan_at: 1_700_000_000_000,
  revoked_at: null,
  revoke_reason: null,
  metadata_json: null,
  created_at: 1_690_000_000_000,
};

/** Minimal D1 stand-in that records every statement it is handed. */
function fakeDb(statements: string[], seal: unknown = SEAL) {
  const stmt = (sql: string) => ({
    bind: () => stmt(sql),
    first: async () => (/FROM seals/i.test(sql) ? seal : null),
    all: async () => ({ results: [] }),
    run: async () => ({ success: true }),
  });
  return {
    prepare(sql: string) {
      statements.push(sql.replace(/\s+/g, " ").trim());
      return stmt(sql);
    },
    batch: async (xs: unknown[]) => xs.map(() => ({ success: true })),
  };
}

function env(statements: string[], seal: unknown = SEAL) {
  return {
    DB: fakeDb(statements, seal),
    RESOLVER_ORIGIN: "https://id.example.com",
    PASSPORT_ORIGIN: "https://example.com",
  } as never;
}

const writes = (s: string[]) => s.filter(q => /^INSERT|^UPDATE/i.test(q));

test("GET /v1/passport/{id} returns the seal without recording a scan", async () => {
  const statements: string[] = [];
  const res = await worker.fetch(
    new Request("https://id.example.com/v1/passport/AC-DEMO-001", {
      headers: { Accept: "application/json" },
    }),
    env(statements)
  );

  assert.equal(res.status, 200);
  const body = await res.json();

  assert.equal(
    body.status,
    "active",
    "reports stored status, does not recompute it"
  );
  assert.equal(body.scanRecorded, false);
  assert.equal(body.identifier.certId, "AC-DEMO-001");
  assert.equal(body.product.name, "Widget");
  assert.equal(
    body.history.scanCount,
    3,
    "scan count is reported as stored, not incremented by being read"
  );

  assert.deepEqual(
    writes(statements),
    [],
    `read path must issue no writes, got: ${writes(statements).join(" | ")}`
  );
});

test("the GS1 scan path still records — the read endpoint did not disable it", async () => {
  const statements: string[] = [];
  const res = await worker.fetch(
    new Request("https://id.example.com/cert/AC-DEMO-001", {
      headers: { Accept: "application/json" },
    }),
    env(statements)
  );

  assert.equal(res.status, 200);
  assert.ok(
    writes(statements).some(q => /INSERT INTO scans/i.test(q)),
    "scanning must still write a scan row"
  );
});

test("an unknown seal reads as not_found, not as an error page", async () => {
  const statements: string[] = [];
  const res = await worker.fetch(
    new Request("https://id.example.com/v1/passport/NOPE", {
      headers: { Accept: "application/json" },
    }),
    env(statements, null)
  );

  assert.equal(res.status, 404);
  const body = await res.json();
  assert.equal(body.status, "not_found");
  assert.equal(
    body.passportUrl,
    null,
    "nothing to link to when there is no seal"
  );
  assert.ok(
    body.doesNotProve,
    "absence must still ship the does-not-prove copy"
  );
  assert.deepEqual(writes(statements), []);
});

test("a resolved seal links to its passport page again", async () => {
  const res = await worker.fetch(
    new Request("https://id.example.com/v1/passport/AC-DEMO-001", {
      headers: { Accept: "application/json" },
    }),
    env([])
  );
  const body = await res.json();
  assert.equal(body.passportUrl, "https://example.com/passport/AC-DEMO-001");
});

test("the read endpoint rejects writes", async () => {
  const res = await worker.fetch(
    new Request("https://id.example.com/v1/passport/AC-DEMO-001", {
      method: "POST",
    }),
    env([])
  );
  assert.equal(res.status, 405);
});
