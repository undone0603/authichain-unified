import assert from "node:assert/strict";
import fs from "node:fs/promises";
import { test, before, after } from "node:test";
import pg from "pg";

// Never open a live or shared database. No Stripe or Supabase credentials.
for (const [key, value] of Object.entries({
  CIRCLECI: "true", DPP_ISOLATED_POSTGRES: "true", PGHOST: "127.0.0.1",
  PGPORT: "5432", PGUSER: "dpp_ci", PGDATABASE: "dpp_ci",
})) assert.equal(process.env[key], value, "unsafe isolated test target: " + key);
for (const key of ["DATABASE_URL", "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY", "STRIPE_WEBHOOK_SECRET"])
  assert.ok(!process.env[key], key + " must not be present in isolated test");
const pool = new pg.Pool({ host: "127.0.0.1", port: 5432, user: "dpp_ci",
  database: "dpp_ci", password: process.env.PGPASSWORD, max: 10 });
const sql = await fs.readFile("supabase/migrations/20261115183000_atomic_stripe_pack_session_grants.sql", "utf8");
const sleep = ms => new Promise(r => setTimeout(r, ms));
async function grant(s, plan = "starter", profile = "p1") {
  const { rows } = await pool.query(
    "SELECT public.grant_stripe_pack_session($1,$2,$3,$4) AS result",
    [profile, s, plan, null]);
  return rows[0].result;
}
async function state() {
  const { rows: [profile] } = await pool.query(
    "SELECT generations_limit,generations_used,last_grant_session_id FROM public.profiles WHERE id='p1'");
  const { rows } = await pool.query(
    "SELECT idempotency_key FROM public.founder_exit_side_effects ORDER BY idempotency_key");
  return { profile, receipts: rows.map(r => r.idempotency_key) };
}
async function reset() {
  await pool.query("TRUNCATE public.founder_exit_side_effects, public.profiles");
  await pool.query("INSERT INTO public.profiles (id,brand,generations_limit,generations_used) VALUES ('p1','qron',0,0),('p2','qron',0,0)");
}
before(async () => {
  for (let i = 0; ; i++) {
    try { await pool.query("SELECT 1"); break; }
    catch (e) { if (i >= 29) throw e; await sleep(500); }
  }
  const { rows: [d] } = await pool.query("SELECT current_database() AS name");
  assert.equal(d.name, "dpp_ci");
  const { rows: [t] } = await pool.query(
    "SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema='public' AND table_name IN ('profiles','founder_exit_side_effects')");
  assert.equal(t.n, 0, "refuse a pre-existing target schema");
  await pool.query("DO $$ BEGIN CREATE ROLE anon; EXCEPTION WHEN duplicate_object THEN NULL; END $$");
  await pool.query("DO $$ BEGIN CREATE ROLE authenticated; EXCEPTION WHEN duplicate_object THEN NULL; END $$");
  await pool.query("DO $$ BEGIN CREATE ROLE service_role NOLOGIN; EXCEPTION WHEN duplicate_object THEN NULL; END $$");
  await pool.query("CREATE TABLE public.profiles (id text PRIMARY KEY, brand text, subscription_plan text, subscription_status text, stripe_subscription_id text, stripe_customer_id text, last_payment_at timestamptz, generations_limit integer DEFAULT 0, generations_used integer DEFAULT 0, last_grant_session_id text)");
  await pool.query("CREATE TABLE public.founder_exit_side_effects (idempotency_key text PRIMARY KEY, recorded_at timestamptz NOT NULL DEFAULT now(), profile_id text)");
  await pool.query(sql);
});
after(async () => pool.end());

test("security: service_role only", async () => {
  const fn = "public.grant_stripe_pack_session(text,text,text,text)";
  for (const [role, expected] of [["service_role", true],["anon", false],["authenticated", false]]) {
    const { rows: [r] } = await pool.query(
      "SELECT has_function_privilege($1,$2,'EXECUTE') AS allowed", [role, fn]);
    assert.equal(r.allowed, expected, role);
  }
});
test("A then B then replay A adds only 200", async () => {
  await reset();
  assert.equal((await grant("cs_A")).status, "granted");
  assert.equal((await grant("cs_B")).status, "granted");
  assert.equal((await grant("cs_A")).status, "already_granted");
  const s = await state();
  assert.equal(s.profile.generations_limit, 200);
  assert.deepEqual(s.receipts, ["grant:cs_A","grant:cs_B"]);
});
test("eight simultaneous deliveries of one session yield exactly one grant", async () => {
  await reset();
  const r = await Promise.all(Array.from({length:8}, () => grant("cs_shared")));
  assert.equal(r.filter(v => v.status === "granted").length, 1);
  assert.equal(r.filter(v => v.status === "already_granted").length, 7);
  assert.equal((await state()).profile.generations_limit, 100);
  assert.deepEqual((await state()).receipts, ["grant:cs_shared"]);
});
test("concurrent different sessions do not lose updates", async () => {
  await reset();
  const r = await Promise.all(["a","b","c","d"].map(x => grant("cs_"+x)));
  assert.ok(r.every(x => x.status === "granted"));
  assert.equal((await state()).profile.generations_limit, 400);
});
test("Creator replay and a later Starter grant remain independent", async () => {
  await reset();
  const r = await Promise.all([grant("cs_creator","creator"),grant("cs_creator","creator")]);
  assert.deepEqual(r.map(v=>v.status).sort(), ["already_granted","granted"]);
  await grant("cs_starter");
  await grant("cs_creator","creator");
  assert.equal((await state()).profile.generations_limit, 600);
});
test("receipt-insert exception rolls back and retry succeeds", async () => {
  await reset();
  await pool.query("CREATE FUNCTION public.inject_receipt_error() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected receipt crash'; END $$");
  await pool.query("CREATE TRIGGER inject_receipt_error AFTER INSERT ON public.founder_exit_side_effects FOR EACH ROW EXECUTE FUNCTION public.inject_receipt_error()");
  try {
    await assert.rejects(grant("cs_abort_receipt"), /injected receipt crash/);
    assert.equal((await state()).profile.generations_limit, 0);
    assert.deepEqual((await state()).receipts, []);
  } finally {
    await pool.query("DROP TRIGGER inject_receipt_error ON public.founder_exit_side_effects");
    await pool.query("DROP FUNCTION public.inject_receipt_error()");
  }
  assert.equal((await grant("cs_abort_receipt")).status, "granted");
  assert.equal((await state()).profile.generations_limit, 100);
});
test("post-update exception rolls back both writes and retry succeeds", async () => {
  await reset();
  await pool.query("CREATE FUNCTION public.inject_update_error() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected update crash'; END $$");
  await pool.query("CREATE TRIGGER inject_update_error AFTER UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.inject_update_error()");
  try {
    await assert.rejects(grant("cs_abort_update"), /injected update crash/);
    assert.equal((await state()).profile.generations_limit, 0);
    assert.deepEqual((await state()).receipts, []);
  } finally {
    await pool.query("DROP TRIGGER inject_update_error ON public.profiles");
    await pool.query("DROP FUNCTION public.inject_update_error()");
  }
  assert.equal((await grant("cs_abort_update")).status, "granted");
  assert.equal((await state()).profile.generations_limit, 100);
});
test("legacy receipt backfill avoids a second grant", async () => {
  await reset();
  await pool.query("UPDATE public.profiles SET generations_limit=100,last_grant_session_id='cs_legacy' WHERE id='p1'");
  assert.equal((await grant("cs_legacy")).status, "already_granted");
  assert.equal((await state()).profile.generations_limit, 100);
  assert.deepEqual((await state()).receipts, ["grant:cs_legacy"]);
});
test("cross-profile replay and unsupported plan fail closed", async () => {
  await reset();
  await grant("cs_p1");
  await assert.rejects(grant("cs_p1","starter","p2"), /pack_receipt_profile_mismatch/);
  await assert.rejects(grant("cs_bad","dpp_readiness"), /unsupported_pack_plan/);
  const {rows:[p2]}=await pool.query("SELECT generations_limit FROM public.profiles WHERE id='p2'");
  assert.equal(p2.generations_limit, 0);
});
