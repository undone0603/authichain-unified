/**
 * POST /issue: generate certId and serial when omitted, reject colliding
 * serials on the same GTIN, keep ISSUE_SECRET auth, and still resolve.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "./index.ts";

const SECRET = "issue-test-secret";
const ORIGIN = "https://id.example.com";
const GTIN = "09506000149301";
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const SERIAL_RE = /^[0-9a-f]{20}$/;

function fakeDb() {
  const seals: Record<string, unknown>[] = [];
  const statements: string[] = [];

  return {
    seals,
    statements,
    prepare(sql: string) {
      statements.push(sql.replace(/\s+/g, " ").trim());
      let values: unknown[] = [];
      const statement = {
        bind(...bound: unknown[]) {
          values = bound;
          return statement;
        },
        async first() {
          if (/WHERE gtin = \?1 AND serial = \?2/i.test(sql)) {
            return (
              seals.find(
                row => row.gtin === values[0] && row.serial === values[1]
              ) ?? null
            );
          }
          if (/WHERE cert_id = \?1/i.test(sql)) {
            const certId = String(values[0]).toLowerCase();
            return (
              seals.find(row => String(row.cert_id).toLowerCase() === certId) ??
              null
            );
          }
          if (/FROM seals WHERE lookup_key/i.test(sql)) {
            return seals.find(row => row.lookup_key === values[0]) ?? null;
          }
          return null;
        },
        async all() {
          if (/FROM seals WHERE cert_id/i.test(sql)) {
            const certId = String(values[0]).toLowerCase();
            return {
              results: seals.filter(
                row => String(row.cert_id).toLowerCase() === certId
              ),
            };
          }
          return { results: [] };
        },
        async run() {
          if (/INSERT INTO seals/i.test(sql)) {
            const [
              id,
              lookup_key,
              gtin,
              lot,
              serial,
              cert_id,
              brand,
              product_name,
              issuer,
              chain,
              contract,
              tx_hash,
              fingerprint_sha256,
              metadata_json,
              created_at,
            ] = values;
            if (seals.some(row => row.lookup_key === lookup_key)) {
              throw new Error("UNIQUE constraint failed: seals.lookup_key");
            }
            seals.push({
              id,
              lookup_key,
              gtin,
              lot,
              serial,
              cert_id,
              brand,
              product_name,
              issuer,
              chain,
              contract,
              tx_hash,
              fingerprint_sha256,
              status: "issued",
              status_reason: null,
              revoked_at: null,
              revoke_reason: null,
              first_country: null,
              first_activated_at: null,
              scan_count: 0,
              last_scan_at: null,
              metadata_json,
              created_at,
            });
            return { success: true };
          }
          return { success: true };
        },
      };
      return statement;
    },
    async batch(statements: unknown[]) {
      return statements.map(() => ({ success: true }));
    },
  };
}

function env(db = fakeDb(), issueSecret: string | undefined = SECRET) {
  return {
    DB: db,
    RESOLVER_ORIGIN: ORIGIN,
    PASSPORT_ORIGIN: "https://example.com",
    ISSUE_SECRET: issueSecret,
  } as never;
}

function post(
  body: unknown,
  headers: Record<string, string> = { authorization: "Bearer " + SECRET }
) {
  return new Request(`${ORIGIN}/issue`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
}

async function issue(runtime: ReturnType<typeof env>, body: unknown) {
  return worker.fetch(post(body), runtime);
}

test("omitted certId becomes a generated public UUID", async () => {
  const db = fakeDb();
  const runtime = env(db);
  const res = await issue(runtime, { gtin: GTIN, serial: "SN-GEN-1" });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.match(body.certId, UUID_RE);
  assert.equal(db.seals[0].cert_id, body.certId);
  assert.notEqual(body.certId, body.id);
});

test("caller-supplied certId is kept when valid", async () => {
  const db = fakeDb();
  const res = await issue(env(db), {
    certId: "AC-DEMO-001",
    gtin: GTIN,
    serial: "SN-KEEP",
  });
  assert.equal(res.status, 201);
  assert.equal((await res.json()).certId, "AC-DEMO-001");
  assert.equal(db.seals[0].cert_id, "AC-DEMO-001");
});

test("invalid caller-supplied certId is rejected", async () => {
  const db = fakeDb();
  const blank = await issue(env(db), {
    certId: "  ",
    gtin: GTIN,
    serial: "SN-BAD",
  });
  assert.equal(blank.status, 400);
  assert.deepEqual(await blank.json(), { error: "invalid_cert_id" });

  const control = await issue(env(db), {
    certId: "AC\nDEMO",
    gtin: GTIN,
    serial: "SN-BAD",
  });
  assert.equal(control.status, 400);
  assert.equal(db.seals.length, 0);
});

test("caller-supplied certId may not contain / ? # % or whitespace", async () => {
  const db = fakeDb();
  const runtime = env(db);
  for (const certId of [
    "AC/0001",
    "AC?X",
    "AC#1",
    "AC%2F",
    "AC DEMO",
    " AC-1",
  ]) {
    const res = await issue(runtime, { certId, gtin: GTIN, serial: "SN-BAD" });
    assert.equal(res.status, 400, certId);
    assert.deepEqual(await res.json(), { error: "invalid_cert_id" });
  }
  assert.equal(db.seals.length, 0);
});

test("omitted serial is unique, unguessable, and not the GTIN or origin", async () => {
  const db = fakeDb();
  const res = await issue(env(db), { gtin: GTIN, brand: "Acme" });
  assert.equal(res.status, 201);
  const body = await res.json();
  assert.match(body.serial, SERIAL_RE);
  assert.notEqual(body.serial, GTIN);
  assert.equal(body.serial.includes(GTIN), false);
  assert.equal(ORIGIN.includes(body.serial), false);
  assert.equal(body.digitalLink.includes(body.serial), true);
  assert.equal(body.lookupKey, `gtin:${GTIN}:ser:${body.serial}`);
  assert.equal(db.seals[0].serial, body.serial);
});

test("caller-supplied serial on the same GTIN is rejected with 409", async () => {
  const db = fakeDb();
  const runtime = env(db);
  const first = await issue(runtime, {
    certId: "AC-ONE",
    gtin: GTIN,
    serial: "SN-001",
  });
  assert.equal(first.status, 201);

  const collision = await issue(runtime, {
    certId: "AC-TWO",
    gtin: GTIN,
    serial: "SN-001",
  });
  assert.equal(collision.status, 409);
  assert.deepEqual(await collision.json(), {
    error: "serial_collision",
    gtin: GTIN,
    serial: "SN-001",
  });
  assert.equal(db.seals.length, 1);

  const otherGtin = await issue(runtime, {
    certId: "AC-THREE",
    gtin: "09506000134369",
    serial: "SN-001",
  });
  assert.equal(otherGtin.status, 201);
  assert.equal(db.seals.length, 2);
});

test("retry with the same certId and a generated serial is 409; /cert still resolves", async () => {
  const db = fakeDb();
  const runtime = env(db);
  const first = await issue(runtime, { certId: "AC-RETRY", gtin: GTIN });
  assert.equal(first.status, 201);
  const firstBody = await first.json();

  const retry = await issue(runtime, { certId: "ac-retry", gtin: GTIN });
  assert.equal(retry.status, 409);
  assert.deepEqual(await retry.json(), {
    error: "already_issued",
    certId: "ac-retry",
  });
  assert.equal(db.seals.length, 1);

  const cert = await worker.fetch(
    new Request(`${ORIGIN}/cert/AC-RETRY`, {
      headers: { accept: "application/json" },
    }),
    runtime
  );
  assert.equal(cert.status, 200);
  const certBody = await cert.json();
  assert.equal(certBody.identifier.certId, "AC-RETRY");
  assert.equal(certBody.identifier.serial, firstBody.serial);
});

test("same certId with a different caller-supplied serial is 409", async () => {
  const db = fakeDb();
  const runtime = env(db);
  const first = await issue(runtime, {
    certId: "AC-DUP",
    gtin: GTIN,
    serial: "SN-A",
  });
  assert.equal(first.status, 201);

  const second = await issue(runtime, {
    certId: "AC-DUP",
    gtin: GTIN,
    serial: "SN-B",
  });
  assert.equal(second.status, 409);
  assert.deepEqual(await second.json(), {
    error: "already_issued",
    certId: "AC-DUP",
  });
  assert.equal(db.seals.length, 1);
});

test("POST /issue is 401 without a valid ISSUE_SECRET", async () => {
  const runtime = env();
  const missing = await worker.fetch(
    post({ gtin: GTIN }, { authorization: "" }),
    runtime
  );
  assert.equal(missing.status, 401);
  assert.deepEqual(await missing.json(), { error: "unauthorized" });

  const wrong = await worker.fetch(
    post({ gtin: GTIN }, { authorization: "Bearer not-the-secret" }),
    runtime
  );
  assert.equal(wrong.status, 401);
});

test("POST /issue is 503 when ISSUE_SECRET is unset", async () => {
  const runtime = env();
  (runtime as { ISSUE_SECRET?: string }).ISSUE_SECRET = undefined;
  const res = await issue(runtime, { gtin: GTIN });
  assert.equal(res.status, 503);
  const body = await res.json();
  assert.equal(body.error, "issuing_disabled");
});

test("generated cert and serial still resolve on QR, Digital Link, and /cert", async () => {
  const db = fakeDb();
  const runtime = env(db);
  const issued = await issue(runtime, { gtin: GTIN, brand: "Acme" });
  assert.equal(issued.status, 201);
  const body = await issued.json();
  const { certId, serial, digitalLink } = body;
  assert.match(certId, UUID_RE);
  assert.match(serial, SERIAL_RE);

  const qr = await worker.fetch(
    new Request(digitalLink, {
      redirect: "manual",
      headers: { accept: "application/json" },
    }),
    runtime
  );
  assert.equal(qr.status, 307);
  assert.equal(
    qr.headers.get("location"),
    `${ORIGIN}/verify/01/${GTIN}/21/${serial}`
  );

  const verify = await worker.fetch(
    new Request(`${ORIGIN}/verify/01/${GTIN}/21/${serial}`, {
      headers: { accept: "application/json" },
    }),
    runtime
  );
  assert.equal(verify.status, 200);
  const verified = await verify.json();
  // First GET scan advances issued → active; clone.ts is unchanged.
  assert.equal(verified.status, "active");
  assert.equal(verified.identifier.serial, serial);
  assert.equal(verified.identifier.certId, certId);

  const cert = await worker.fetch(
    new Request(`${ORIGIN}/cert/${certId}`, {
      headers: { accept: "application/json" },
    }),
    runtime
  );
  assert.equal(cert.status, 200);
  const certBody = await cert.json();
  assert.equal(certBody.identifier.certId, certId);
  assert.equal(certBody.identifier.serial, serial);
});
