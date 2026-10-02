import { test } from "node:test";
import assert from "node:assert/strict";
import {
  checkMigrationSql,
  findPublicTables,
  run,
} from "./check-supabase-grants.mjs";

test("passes a new public table with the service_role grant and RLS", () => {
  const sql = `
    create table if not exists public.widget_events (id bigint generated always as identity primary key);
    alter table public.widget_events enable row level security;
    grant select, insert, update, delete on table public.widget_events to service_role;`;
  assert.deepEqual(checkMigrationSql(sql).errors, []);
});

test("fails a new public table with no GRANT", () => {
  const sql = `create table public.widget_events (id uuid primary key);
    alter table public.widget_events enable row level security;`;
  const { errors } = checkMigrationSql(sql, "m.sql");
  assert.equal(errors.length, 1);
  assert.match(errors[0], /public\.widget_events without an explicit GRANT/);
});

test("treats an unqualified table as public", () => {
  assert.deepEqual(
    findPublicTables("CREATE TABLE IF NOT EXISTS widgets (id int);"),
    ["widgets"]
  );
  assert.equal(
    checkMigrationSql("CREATE TABLE widgets (id int);").errors.length,
    1
  );
});

test("ignores other schemas, temp tables and commented-out SQL", () => {
  const sql = `create table private.secrets (id int);
    create temp table scratch (id int);
    -- create table public.not_real (id int);
    /* create table public.also_not_real (id int); */`;
  assert.deepEqual(checkMigrationSql(sql).errors, []);
});

test("revoke-only is not a grant (service_role loses access after Oct 30)", () => {
  const sql = `create table public.issuers (id text primary key);
    alter table public.issuers enable row level security;
    revoke all on table public.issuers from anon, authenticated;`;
  assert.equal(checkMigrationSql(sql).errors.length, 1);
});

test("client-role grant without RLS fails", () => {
  const sql = `create table public.todos (id int);
    grant select on public.todos to anon;
    grant select, insert, update, delete on public.todos to service_role;`;
  const { errors } = checkMigrationSql(sql);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /enable row level security/);
});

test("documented three-role pattern with RLS passes", () => {
  const sql = `create table "public"."Todos" (id int);
    grant select on public."Todos" to anon;
    grant select, insert, update, delete on public."Todos" to authenticated;
    grant select, insert, update, delete on public."Todos" to service_role;
    alter table public."Todos" enable row level security;`;
  assert.deepEqual(checkMigrationSql(sql).errors, []);
});

test("explicit exemption comment is honoured", () => {
  const sql = `-- supabase-grants-exempt: public.direct_only reached only via DATABASE_URL
    create table public.direct_only (id int);`;
  assert.deepEqual(checkMigrationSql(sql).errors, []);
});

test("ALTER-only migrations are not affected", () => {
  assert.deepEqual(
    checkMigrationSql(
      "alter table public.lead_captures add column if not exists company text;"
    ).errors,
    []
  );
});

test("repository migrations pass with the committed baseline", () => {
  assert.deepEqual(run().errors, []);
});
