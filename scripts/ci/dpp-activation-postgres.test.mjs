/**
 * Real PostgreSQL acceptance for the DPP activation-email claim/finish RPCs.
 * Runs ONLY with DPP_TEST_DATABASE_URL against a disposable test database.
 * Does not send email, call Stripe, or access Supabase production.
 */
import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import pg from "pg";

const url = process.env.DPP_TEST_DATABASE_URL;
if (!url || !/^(postgres|postgresql):\/\//.test(url)) {
  throw new Error("DPP_TEST_DATABASE_URL required: dedicated disposable PostgreSQL only");
}
const parsed = new URL(url);
if (!["localhost", "127.0.0.1", "::1"].includes(parsed.hostname)) {
  throw new Error("DPP test database MUST be local disposable PostgreSQL");
}
const pool = new pg.Pool({ connectionString: url, max: 6, connectionTimeoutMillis: 5000 });
const migrate = readFileSync(
  "supabase/migrations/20261112213000_dpp_activation_email_outbox.sql",
  "utf8"
);
const query = (sql, params=[]) => pool.query(sql, params);
const claim = async (sid, pid, token) => (await query(
  "select public.claim_dpp_activation_email($1,$2,$3) as outcome",
  [sid,pid,token]
)).rows[0].outcome;
const finish = async (sid, token, outcome) => (await query(
  "select public.finish_dpp_activation_email($1,$2,$3) as finished",
  [sid,token,outcome]
)).rows[0].finished;
const token = n => "claim-token-" + n;
const id = n => "cs_test_activation_" + n;

try {
  // PostgreSQL sidecar may start after the Node primary container.
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      await query("select 1");
      ready = true;
      break;
    } catch (err) {
      if (attempt === 29) throw err;
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
  assert.ok(ready, "disposable PostgreSQL readiness");
  // This is a disposable database. Create Supabase-shaped roles to validate ACLs.
  for (const role of ["anon","authenticated","service_role"]) {
    await query(`do $$ begin if not exists (select from pg_roles where rolname = '${role}') then create role ${role} nologin; end if; end $$`);
  }
  await query(migrate);
  await query(migrate); // rerunning migration must not break semantics or ACLs

  for (const role of ["anon", "authenticated"]) {
    const acl = (await query(`select
      has_table_privilege($1, 'public.dpp_activation_email_delivery', 'SELECT') as tbl,
      has_function_privilege($1, 'public.claim_dpp_activation_email(text,text,text)', 'EXECUTE') as claim,
      has_function_privilege($1, 'public.finish_dpp_activation_email(text,text,text)', 'EXECUTE') as finish`,
      [role])).rows[0];
    assert.deepEqual(acl, { tbl:false, claim:false, finish:false }, role + " access");
  }
  const service = (await query(`select
    has_table_privilege('service_role','public.dpp_activation_email_delivery','SELECT') as tbl,
    has_function_privilege('service_role','public.claim_dpp_activation_email(text,text,text)','EXECUTE') as claim`)).rows[0];
  assert.deepEqual(service, {tbl:true, claim:true});

  // True concurrent independent connections; row lock + ON CONFLICT serialize claims.
  const sid = id("parallel");
  const outcomes = await Promise.all(Array.from({length:8}, (_,i)=>
    claim(sid,"profile-one",token("parallel-"+i))));
  assert.equal(outcomes.filter(x=>x==="claimed").length,1, "exactly one sender claims");
  assert.equal(outcomes.filter(x=>x==="reconcile").length,7, "others must not send");
  const row=(await query("select claim_token,attempt_count,state from public.dpp_activation_email_delivery where stripe_session_id=$1",[sid])).rows[0];
  assert.equal(row.state,"sending");
  assert.equal(Number(row.attempt_count),1);
  assert.equal(await finish(sid,token("wrong"),"sent"),false,"wrong token cannot acknowledge");
  assert.equal(await finish(sid,row.claim_token,"sent"),true);
  assert.equal(await claim(sid,"profile-one",token("late")),"sent","success is replay-safe");
  assert.equal(await claim(sid,"profile-one",token("later")),"sent","repeated replay-safe");
  assert.equal(Number((await query("select attempt_count from public.dpp_activation_email_delivery where stripe_session_id=$1",[sid])).rows[0].attempt_count),1);
  
  // Crash between provider call and persistence: 'sending' remains reconcile.
  const crash=id("crash");
  assert.equal(await claim(crash,"profile-one",token("crash")),"claimed");
  assert.equal(await claim(crash,"profile-one",token("crash-retry")),"reconcile");

  // Unknown transport result must not automatically retry.
  const unknown=id("unknown");
  assert.equal(await claim(unknown,"profile-one",token("unknown")),"claimed");
  assert.equal(await finish(unknown,token("unknown"),"unknown"),true);
  assert.equal(await claim(unknown,"profile-one",token("unknown-retry")),"reconcile");

  // Definite negative provider response can be retried without entitlement writes.
  const failed=id("failed");
  assert.equal(await claim(failed,"profile-one",token("first")),"claimed");
  assert.equal(await finish(failed,token("first"),"failed"),true);
  assert.equal(await claim(failed,"profile-one",token("second")),"claimed");
  assert.equal(await finish(failed,token("second"),"sent"),true);
  assert.equal(await claim(failed,"profile-one",token("third")),"sent");

  // Session identity and state transitions are strict.
  await assert.rejects(claim(failed,"wrong-profile",token("mismatch")),/profile_mismatch/);
  assert.equal(await finish(failed,token("second"),"failed"),false);
  await assert.rejects(finish(failed,token("wrong"),"arbitrary"),/invalid_dpp_activation_outcome/);
  assert.equal((await query("select count(*)::int as n from public.dpp_activation_email_delivery")).rows[0].n,4);
  console.log("DPP_ACTIVATION_POSTGRES_PASS");
} finally {
  await pool.end();
}
