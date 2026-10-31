import { test } from "node:test";
import assert from "node:assert/strict";
import worker from "./index.ts";

const SECRET = "lifecycle-test-secret";

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
          if (/UPDATE seals/i.test(sql)) {
            const [reason, revoked_at, lookup_key] = values;
            const seal = seals.find(row => row.lookup_key === lookup_key);
            if (seal && seal.status !== "revoked") {
              seal.status = "revoked";
              seal.status_reason = reason;
              seal.revoke_reason = reason;
              seal.revoked_at = revoked_at;
            }
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
    RESOLVER_ORIGIN: "https://id.example.com",
    PASSPORT_ORIGIN: "https://example.com",
    ISSUE_SECRET: issueSecret,
  } as never;
}

function authenticatedPost(path: string, body: unknown, secret = SECRET) {
  return new Request(`https://id.example.com${path}`, {
    method: "POST",
    headers: {
      authorization: "Bearer " + secret,
      "content-type": "application/json",
    },
    body: JSON.stringify(body),
  });
}

test("issue, resolve by certificate ID, revoke, and read the revoked passport", async () => {
  const db = fakeDb();
  const runtime = env(db);
  const issued = await worker.fetch(
    authenticatedPost("/issue", {
      certId: "AC-DEMO-001",
      gtin: "09506000149301",
      serial: "SN-001",
      brand: "Acme",
      productName: "Widget",
      issuer: "Acme Inc",
      fingerprintSha256: `sha256:${"a".repeat(64)}`,
      metadata: { evidence: "coa-reference" },
    }),
    runtime
  );

  assert.equal(issued.status, 201);
  const issueBody = await issued.json();
  assert.equal(issueBody.lookupKey, "gtin:09506000149301:ser:SN-001");
  assert.equal(db.seals[0].fingerprint_sha256, "a".repeat(64));

  const passport = await worker.fetch(
    new Request("https://id.example.com/v1/passport/AC-DEMO-001"),
    runtime
  );
  assert.equal(passport.status, 200);
  const passportBody = await passport.json();
  assert.equal(passportBody.status, "issued");
  assert.deepEqual(passportBody.fingerprint, {
    digest: `sha256:${"a".repeat(64)}`,
    source: "issuer_supplied",
    verified: false,
    caveat:
      "The resolver stores this digest as supplied. It does not verify the source bytes, what they cover, or when they existed.",
  });

  const revoked = await worker.fetch(
    authenticatedPost("/revoke", {
      lookupKey: issueBody.lookupKey,
      reason: "Issuer withdrew this certificate",
    }),
    runtime
  );
  assert.equal(revoked.status, 200);
  const revokeBody = await revoked.json();
  assert.equal(revokeBody.status, "revoked");
  assert.equal(revokeBody.alreadyRevoked, false);

  const secondRevocation = await worker.fetch(
    authenticatedPost("/revoke", {
      lookupKey: issueBody.lookupKey,
      reason: "Duplicate retry",
    }),
    runtime
  );
  assert.equal(secondRevocation.status, 200);
  assert.equal((await secondRevocation.json()).alreadyRevoked, true);

  const revokedPassport = await worker.fetch(
    new Request("https://id.example.com/v1/passport/AC-DEMO-001"),
    runtime
  );
  assert.equal(revokedPassport.status, 200);
  assert.equal((await revokedPassport.json()).status, "revoked");
});

test("revocation requires the issuer secret and a reason", async () => {
  const unauthorized = await worker.fetch(
    new Request("https://id.example.com/revoke", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ lookupKey: "cert:unknown", reason: "withdrawn" }),
    }),
    env()
  );
  assert.equal(unauthorized.status, 401);

  const noReason = await worker.fetch(
    authenticatedPost("/revoke", {
      lookupKey: "cert:unknown",
      reason: " ",
    }),
    env()
  );
  assert.equal(noReason.status, 400);
});

test("seal issuance rejects malformed SHA-256 fingerprints", async () => {
  const db = fakeDb();
  const response = await worker.fetch(
    authenticatedPost("/issue", {
      certId: "AC-BAD-FINGERPRINT",
      fingerprintSha256: "sha256:not-a-digest",
    }),
    env(db)
  );

  assert.equal(response.status, 400);
  assert.deepEqual(await response.json(), {
    error: "invalid_fingerprint_sha256",
  });
  assert.equal(db.seals.length, 0);
});

test("certificate-ID fallback refuses ambiguous records", async () => {
  const db = fakeDb();
  db.seals.push(
    { lookup_key: "gtin:one", cert_id: "DUPLICATE-1" },
    { lookup_key: "gtin:two", cert_id: "duplicate-1" }
  );
  const response = await worker.fetch(
    new Request("https://id.example.com/v1/passport/DUPLICATE-1"),
    env(db)
  );
  assert.equal(response.status, 404);
});
