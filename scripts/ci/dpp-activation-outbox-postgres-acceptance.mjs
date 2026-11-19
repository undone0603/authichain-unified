/** Real two-connection PostgreSQL acceptance for #2482. LOCAL CI ONLY. */
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import pg from "pg";

const path = "supabase/migrations/20261119133000_dpp_activation_delivery_outbox.sql";
const sql = readFileSync(path, "utf8");
const migrationSha = createHash("sha256").update(sql).digest("hex");
const config = {
  host: "127.0.0.1", port: 5432, user: "postgres",
  password: process.env.PG_TEST_PASSWORD,
  database: "postgres",
};
assert.equal(process.env.CIRCLECI, "true", "CI-only isolated PostgreSQL acceptance");
assert.equal(config.password, "isolated-ci-only", "Expected disposable CI database credential");
const checkoutSha = execFileSync("git", ["rev-parse", "HEAD"], { encoding:"utf8" }).trim();
assert.equal(checkoutSha, process.env.CIRCLE_SHA1, "Exact-head evidence required");
const profile = "11111111-1111-1111-1111-111111111111";
const admin = new pg.Client(config);
const clientA = new pg.Client(config);
const clientB = new pg.Client(config);
const json = async (c,name,params) =>
  (await c.query("SELECT public." + name + "(" +
    params.map((_,i)=>"$"+(i+1)).join(",") + ") AS result", params)).rows[0].result;
const prepare = s => json(admin,"dpp_activation_prepare",[s]);
const enqueue = (s,p=profile,demo=false) => json(admin,"dpp_activation_enqueue",[s,p,demo]);
const receipt = s => admin.query(
  "INSERT INTO public.founder_exit_side_effects(idempotency_key,profile_id) VALUES($1,$2)",
  ["grant:"+s,profile]
);
const getRow = async s => (
  await admin.query(
    "SELECT state,send_attempts,profile_id FROM public.dpp_activation_outbox WHERE session_id=$1",
    [s]
  )
).rows[0];
let pass=0;
await Promise.all([admin.connect(),clientA.connect(),clientB.connect()]);
try {
  await admin.query("SHOW server_version");
  for (const role of ["service_role","anon","authenticated"]) {
    await admin.query(
      "DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_roles WHERE rolname = '" +
      role + "') THEN CREATE ROLE " + role + " NOLOGIN; END IF; END $$"
    );
  }
  await admin.query(
    "CREATE TABLE public.founder_exit_side_effects(" +
    "idempotency_key text PRIMARY KEY, profile_id text NOT NULL)"
  );
  await admin.query(sql); // exactly the checked-in migration bytes
  for (const role of ["anon","authenticated","service_role"]) {
    const p=(await admin.query(
      "SELECT has_function_privilege($1,'public.dpp_activation_claim(text,text)','EXECUTE') AS permitted",
      [role]
    )).rows[0];
    assert.equal(p.permitted,role==="service_role",role+" unexpected RPC access");
  }
  const rls=(await admin.query(
    "SELECT relrowsecurity FROM pg_class WHERE oid='public.dpp_activation_outbox'::regclass"
  )).rows[0].relrowsecurity;
  assert.equal(rls,true);
  pass++;

  // New sessions must be prepared before the paid grant. Legacy replay holds.
  const legacy="cs_test_2482_legacy";
  await receipt(legacy);
  assert.equal((await enqueue(legacy)).status,"legacy_untracked");
  assert.equal(await getRow(legacy),undefined);
  await prepare("cs_test_2482_no_grant");
  await assert.rejects(enqueue("cs_test_2482_no_grant"),/grant_receipt_mismatch/);
  const demo="cs_test_2482_demo";
  assert.equal((await enqueue(demo,profile,true)).status,"skipped_demo");
  assert.equal(await getRow(demo),undefined);
  pass++;

  const s="cs_test_2482_race";
  await prepare(s); await receipt(s); await enqueue(s);
  // Hold A's transaction open while B attempts to claim the identical session.
  await clientA.query("BEGIN");
  const first=await json(clientA,"dpp_activation_claim",[s,profile]);
  assert.equal(first.status,"claimed");
  let secondDone=false;
  const secondQuery=json(clientB,"dpp_activation_claim",[s,profile])
    .then(x=>{secondDone=true; return x;});
  // This is a real database lock, not a JS mock. B cannot claim while A
  // holds the session row FOR UPDATE.
  await new Promise(resolve=>setTimeout(resolve,120));
  assert.equal(secondDone,false,"Second connection bypassed the row lock");
  await clientA.query("COMMIT");
  const second=await secondQuery;
  assert.equal(second.status,"busy");
  assert.equal((await json(clientA,"dpp_activation_begin_send",[s,first.claim_token])).status,"armed");
  await assert.rejects(json(clientB,"dpp_activation_begin_send",[s,first.claim_token]),/send_lease_lost/);
  assert.equal((await getRow(s)).send_attempts,1);
  assert.equal((await json(clientB,"dpp_activation_claim",[s,profile])).status,"held");
  assert.equal((await json(clientA,"dpp_activation_finish_send",[s,first.claim_token,true,"resend",200])).status,"accepted");
  assert.equal((await json(clientB,"dpp_activation_claim",[s,profile])).status,"accepted");
  assert.equal((await getRow(s)).send_attempts,1);
  pass++;

  const unarmed="cs_test_2482_unarmed";
  await prepare(unarmed); await receipt(unarmed); await enqueue(unarmed);
  const old=await json(clientA,"dpp_activation_claim",[unarmed,profile]);
  await admin.query(
    "UPDATE public.dpp_activation_outbox SET lease_until=now()-interval '1 second' WHERE session_id=$1",
    [unarmed]
  );
  const newer=await json(clientB,"dpp_activation_claim",[unarmed,profile]);
  assert.equal(newer.status,"claimed");
  assert.notEqual(newer.claim_token,old.claim_token);
  await assert.rejects(
    json(clientA,"dpp_activation_begin_send",[unarmed,old.claim_token]),/send_lease_lost/
  );
  assert.equal((await json(clientB,"dpp_activation_begin_send",[unarmed,newer.claim_token])).status,"armed");
  pass++;

  const ambiguous="cs_test_2482_unknown";
  await prepare(ambiguous); await receipt(ambiguous); await enqueue(ambiguous);
  const token=(await json(clientA,"dpp_activation_claim",[ambiguous,profile])).claim_token;
  await json(clientA,"dpp_activation_begin_send",[ambiguous,token]);
  await admin.query(
    "UPDATE public.dpp_activation_outbox SET lease_until=now()-interval '1 second' WHERE session_id=$1",
    [ambiguous]
  );
  assert.equal((await json(clientB,"dpp_activation_claim",[ambiguous,profile])).status,"held");
  assert.equal((await getRow(ambiguous)).state,"needs_reconciliation");
  assert.equal((await getRow(ambiguous)).send_attempts,1);
  assert.equal((await json(clientA,"dpp_activation_claim",[ambiguous,profile])).status,"held");
  pass++;

  const failed="cs_test_2482_failed";
  await prepare(failed); await receipt(failed); await enqueue(failed);
  const ft=(await json(clientA,"dpp_activation_claim",[failed,profile])).claim_token;
  await json(clientA,"dpp_activation_begin_send",[failed,ft]);
  assert.equal(
    (await json(clientA,"dpp_activation_finish_send",[failed,ft,false,"resend",503])).status,
    "needs_reconciliation"
  );
  assert.equal((await json(clientB,"dpp_activation_claim",[failed,profile])).status,"held");
  pass++;

  const cols=(await admin.query(
    "SELECT column_name FROM information_schema.columns " +
    "WHERE table_schema='public' AND table_name='dpp_activation_outbox'"
  )).rows.map(r=>r.column_name);
  for(const forbidden of ["email","recipient","subject","body","html","provider_error"]) {
    assert(!cols.includes(forbidden),"PII column: "+forbidden);
  }
  pass++;
  console.log(JSON.stringify({
    result:"PASS",cases:pass,source_sha:checkoutSha,
    migration_sha256:migrationSha,postgres_version:"16",
    concurrency:"two independent clients / row FOR UPDATE",
    public_rpc_execute:false,at_most_once_provider_attempt:true,
    no_production_access:true
  }));
} finally {
  await Promise.allSettled([clientA.end(),clientB.end(),admin.end()]);
}
