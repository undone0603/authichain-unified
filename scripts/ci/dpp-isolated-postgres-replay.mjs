#!/usr/bin/env node
/** Executes real DPP PL/pgSQL migrations on disposable PostgreSQL only. */
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import pg from "pg";
const { Client } = pg;
const url = process.env.DPP_TEST_DATABASE_URL ?? "";
assert.ok(url, "missing isolated DB URL");
const parsed = new URL(url);
assert.equal(process.env.CIRCLECI, "true");
assert.equal(process.env.DPP_ISOLATED_POSTGRES, "true");
assert.ok(["127.0.0.1", "localhost"].includes(parsed.hostname), "remote DB forbidden");
assert.equal(parsed.port, "5432");
assert.equal(parsed.pathname, "/dpp_ci");
assert.equal(parsed.username, "dpp_ci");
assert.equal(process.env.STRIPE_SECRET_KEY, undefined);
assert.equal(process.env.SUPABASE_SERVICE_ROLE_KEY, undefined);
async function open() {
  const c = new Client({ connectionString: url, connectionTimeoutMillis: 5000 });
  await c.connect();
  return c;
}
async function query(c, sql, params = []) { return (await c.query(sql, params)).rows; }
async function grant(profile, session) {
  const c = await open();
  try {
    const rows = await query(c, "SELECT public.grant_dpp_checkout_session($1,$2,$3,$4) AS result", [profile,session,"authichain","cus_ci_synthetic"]);
    return rows[0].result;
  } finally { await c.end(); }
}
async function state(c, profile) {
  const p = await query(c, "SELECT generations_limit,generations_used,last_grant_session_id,subscription_plan,subscription_status FROM public.profiles WHERE id=$1",[profile]);
  const receipts = await query(c, "SELECT idempotency_key FROM public.founder_exit_side_effects ORDER BY idempotency_key");
  return {profile:p[0],receipts:receipts.map(x=>x.idempotency_key)};
}
const main = await open();
try {
  const existing = await query(main, "SELECT to_regclass('public.profiles') AS p,to_regclass('public.founder_exit_side_effects') AS r");
  assert.equal(existing[0].p,null,"CI DB is not empty");
  assert.equal(existing[0].r,null,"CI DB is not empty");
  for(const role of ["anon","authenticated","service_role"]) await main.query("CREATE ROLE "+role+" NOLOGIN");
  await main.query([
    "CREATE TABLE public.profiles (",
    "id text PRIMARY KEY,brand text,generations_limit integer DEFAULT 0,",
    "generations_used integer DEFAULT 0,stripe_subscription_id text,",
    "subscription_plan text,subscription_status text,last_payment_at timestamptz,",
    "stripe_customer_id text,last_grant_session_id text);",
    "CREATE TABLE public.founder_exit_side_effects (idempotency_key text PRIMARY KEY);"
  ].join(" "));
  for(const migration of [
    "supabase/migrations/20261112170400_atomic_dpp_session_grants.sql",
    "supabase/migrations/20261112195000_dpp_legacy_grant_marker_guard.sql"
  ]) await main.query(await readFile(new URL("../../"+migration,import.meta.url),"utf8"));
  for(const role of ["anon","authenticated","service_role"]) {
    const rows=await query(main,"SELECT has_function_privilege($1,'public.grant_dpp_checkout_session(text,text,text,text)','EXECUTE') AS allowed",[role]);
    assert.equal(rows[0].allowed,role==="service_role","wrong ACL for "+role);
  }
  await main.query("INSERT INTO public.profiles(id,generations_limit,generations_used) VALUES ('buyer-a',0,0)");
  const parallel=await Promise.all(Array.from({length:8},()=>grant("buyer-a","cs_ci_parallel")));
  assert.equal(parallel.filter(x=>x.status==="granted").length,1,"duplicate grant");
  assert.equal(parallel.filter(x=>x.status==="already_granted").length,7,"replay not suppressed");
  let s=await state(main,"buyer-a");
  assert.equal(s.profile.generations_limit,50);
  assert.equal(s.profile.generations_used,0);
  assert.deepEqual(s.receipts,["grant:cs_ci_parallel"]);
  // The newest migration binds the receipt to its original profile.
  let receipt = await query(main,
    "SELECT profile_id FROM public.founder_exit_side_effects WHERE idempotency_key=$1",
    ["grant:cs_ci_parallel"]);
  assert.equal(receipt[0].profile_id, "buyer-a", "grant receipt missing buyer association");
  assert.equal((await grant("buyer-a","cs_ci_parallel")).status,"already_granted");
  s=await state(main,"buyer-a");
  assert.equal(s.profile.generations_limit,50);
  await assert.rejects(grant("missing","cs_ci_rollback"),/dpp_grant_profile_not_found/);
  assert.equal((await query(main,"SELECT count(*)::int n FROM public.founder_exit_side_effects WHERE idempotency_key='grant:cs_ci_rollback'"))[0].n,0,"receipt not rolled back");
  await main.query("INSERT INTO public.profiles(id) VALUES ('missing')");
  assert.equal((await grant("missing","cs_ci_rollback")).status,"granted");
  await main.query("INSERT INTO public.profiles(id,generations_limit,last_grant_session_id) VALUES ('legacy',50,'cs_ci_legacy')");
  assert.equal((await grant("legacy","cs_ci_legacy")).status,"already_granted");
  s=await state(main,"legacy");
  assert.equal(s.profile.generations_limit,50);
  assert.ok(s.receipts.includes("grant:cs_ci_legacy"));
  receipt = await query(main,
    "SELECT profile_id FROM public.founder_exit_side_effects WHERE idempotency_key=$1",
    ["grant:cs_ci_legacy"]);
  assert.equal(receipt[0].profile_id, "legacy", "legacy receipt missing profile");
  await main.query("UPDATE public.profiles SET generations_used=10 WHERE id='buyer-a'");
  assert.equal((await grant("buyer-a","cs_ci_second")).status,"granted");
  s=await state(main,"buyer-a");
  assert.equal(s.profile.generations_limit,90);
  assert.equal(s.profile.generations_used,0);
  await main.query("INSERT INTO public.profiles(id,generations_limit,stripe_subscription_id,subscription_plan,subscription_status) VALUES ('sub',100,'sub_ci','professional','active')");
  assert.equal((await grant("sub","cs_ci_sub")).status,"granted");
  s=await state(main,"sub");
  assert.equal(s.profile.generations_limit,150);
  assert.equal(s.profile.subscription_plan,"professional");
  assert.equal(s.profile.subscription_status,"active");
  await main.query("INSERT INTO public.profiles(id,generations_limit,generations_used) VALUES ('unlimited',999999,123)");
  assert.equal((await grant("unlimited","cs_ci_unlimited")).status,"granted");
  s=await state(main,"unlimited");
  assert.equal(s.profile.generations_limit,999999);
  assert.equal(s.profile.generations_used,123);
  console.log("DPP_ISOLATED_POSTGRES_PASS eight parallel clients, duplicate suppression, rollback, legacy marker, incremental credits, subscription, unlimited, role ACL");
} finally { await main.end(); }
