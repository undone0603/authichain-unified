/** Isolated PostgreSQL acceptance of the exact committed runtime identity migration. */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createHash } from "node:crypto";
import pg from "pg";

const migrationPath = "supabase/migrations/20261116153000_runtime_database_identity_attestation.sql";
const migration = readFileSync(migrationPath, "utf8");
const sha256 = createHash("sha256").update(migration).digest("hex");
const config = { host: "127.0.0.1", port: 5432, user: "postgres", password: process.env.PG_TEST_PASSWORD, database: "postgres" };
assert(config.password, "isolated PostgreSQL password required");
const admin = new pg.Client(config);
await admin.connect();
const testRoles = ["service_role", "anon", "authenticated", "public_only_probe"];
try {
  const version = (await admin.query("SHOW server_version")).rows[0].server_version;
  const baseline = (await admin.query("SELECT system_identifier::text AS system_identifier, current_database() AS database_name FROM pg_catalog.pg_control_system()")).rows[0];
  assert.match(baseline.system_identifier, /^[0-9]+$/);
  assert.equal(baseline.database_name, "postgres");
  await admin.query("BEGIN");
  for (const role of testRoles) {
    await admin.query(`CREATE ROLE ${role} NOLOGIN`);
  }
  await admin.query("CREATE TABLE public.attestation_unchanged_fixture (id integer PRIMARY KEY, value text NOT NULL)");
  await admin.query("INSERT INTO public.attestation_unchanged_fixture VALUES (1, 'unchanged')");
  await admin.query("COMMIT");
  // Execute the exact migration bytes without rewriting statements.
  await admin.query(migration);
  const before = (await admin.query("SELECT id, value FROM public.attestation_unchanged_fixture ORDER BY id")).rows;
  assert.equal(before.length, 1);
  for (const role of testRoles) {
    await admin.query("BEGIN");
    try {
      await admin.query(`SET LOCAL ROLE ${role}`);
      const allowed = role === "service_role";
      const hasPrivilege = (await admin.query("SELECT has_function_privilege(current_user, 'public.attest_runtime_database_identity()', 'EXECUTE') AS allowed")).rows[0].allowed;
      assert.equal(hasPrivilege, allowed, `Unexpected EXECUTE grant for ${role}`);
      if (allowed) {
        const identity = (await admin.query("SELECT public.attest_runtime_database_identity() AS identity")).rows[0].identity;
        assert.deepEqual(identity, baseline, "Identity differs from independently queried baseline");
      } else {
        let denied = false;
        try {
          await admin.query("SELECT public.attest_runtime_database_identity()");
        } catch (error) {
          denied = error.code === "42501";
        }
        assert(denied, `Expected permission denied for ${role}`);
      }
    } finally {
      await admin.query("ROLLBACK");
    }
  }
  const after = (await admin.query("SELECT id, value FROM public.attestation_unchanged_fixture ORDER BY id")).rows;
  assert.deepEqual(after, before, "Attestation mutated application fixture");
  console.log(JSON.stringify({ result: "PASS", migration_sha256: sha256, postgres_version: version, database_name: baseline.database_name, system_identifier_verified: true, allowed_roles: ["service_role"], denied_roles: ["anon", "authenticated", "public_only_probe (PUBLIC only)"], fixture_unchanged: true, checked_at: new Date().toISOString() }));
} finally {
  await admin.end();
}
