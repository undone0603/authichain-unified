import {test} from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {assertInstalledPins,inspectWorkerPins,PINS} from "./verify-runtime-attestation-bindings.mjs";
import {validateEndpoint,assertAttestationResult,inspectLive} from "./verify-runtime-attestation-live.mjs";
const sha="a".repeat(40),hash="sha256:"+"1".repeat(20);
const good={verified:true,deployedVersion:sha,checkedAt:new Date().toISOString(),connections:{
  databaseUrl:{path:"postgres-js:getDb",verified:true,identity:hash},
  webhookSupabase:{path:"stripe-webhook:supabase-js",verified:true,identity:hash}
}};
test("attestation mode splits independent migration from DPP outbox and keeps both protected",()=>{
  const w=readFileSync(".github/workflows/deploy-authichain-app.yml","utf8");
  for(const phrase of ["release_mode:","attestation-bootstrap","dpp-email",
    "scripts/ci/verify-runtime-attestation-production.sh",
    "scripts/ci/verify-dpp-outbox-production.sh",
    "secrets.AUTHICHAIN_ATTESTATION_BOOTSTRAP_RELEASE_GO",
    "node scripts/ci/verify-runtime-attestation-bindings.mjs",
    "node scripts/ci/verify-runtime-attestation-live.mjs",
    "name: production-cloudflare","name: production-supabase",
    "node scripts/ci/verify-dpp-main-quality.mjs",
    "bash scripts/with-build-lock.sh pnpm exec opennextjs-cloudflare build --config wrangler.app.jsonc"])
    assert.ok(w.includes(phrase),phrase);
  assert.ok(!w.includes("Require successful exact-head GitHub Main quality gate"),"obsolete GitHub quality gate cannot be required");
  assert.ok(w.includes("inputs.release_mode == 'dpp-email'"),"DPP-only stage guard missing");
  assert.ok(w.includes("inputs.release_mode == 'attestation-bootstrap'"),"bootstrap stage guard missing");
  const sh=readFileSync("scripts/ci/verify-runtime-attestation-production.sh","utf8");
  for(const marker of ["default_transaction_read_only=on","20261116153000",
    "pg_catalog.pg_control_system()","has_function_privilege","RUNTIME_ATTESTATION_DB_READY"])
    assert.ok(sh.includes(marker),marker);
  assert.ok(!sh.includes("psql -f")&&!sh.includes("supabase db push"));
});
test("Worker settings require every secret pin, never plain text or missing",()=>{
  const goodPins=PINS.map(name=>({name,type:"secret_text"}));
  assert.equal(assertInstalledPins(goodPins),5);
  for(const name of PINS) assert.throws(()=>assertInstalledPins(goodPins.filter(b=>b.name!==name)),/missing/);
  assert.throws(()=>assertInstalledPins([{name:PINS[0],type:"plain_text"}]),/missing/);
});
test("Cloudflare inventory is read-only and fails closed",async()=>{
 const accountId="a".repeat(32),token="TEST_ONLY";
 let seen;
 const n=await inspectWorkerPins({accountId,token,fetchImpl:async(u,opt)=>{
  seen={u,opt};return {ok:true,json:async()=>({success:true,result:{bindings:PINS.map(name=>({name,type:"secret_text"}))}})};
 }});
 assert.equal(n,5);assert.equal(seen.opt.method,"GET");
 assert.ok(seen.u.endsWith("/workers/scripts/authichain-app/settings"));
 await assert.rejects(inspectWorkerPins({accountId,token,fetchImpl:async()=>({ok:false,status:403})}),/unavailable/);
});
test("HTTPS live endpoint, version and both connection fingerprints are mandatory",async()=>{
 const url="https://qron.space/api/internal/runtime-db-attestation";
 assert.equal(validateEndpoint(url),url);
 for(const bad of ["http://qron.space/api/internal/runtime-db-attestation",
  "https://evil.example/api/internal/runtime-db-attestation",
  url+"?token=secret"]) assert.throws(()=>validateEndpoint(bad));
 assert.equal(assertAttestationResult(good,sha),true);
 assert.throws(()=>assertAttestationResult({...good,deployedVersion:"b".repeat(40)},sha));
 assert.throws(()=>assertAttestationResult({...good,connections:{...good.connections,webhookSupabase:{...good.connections.webhookSupabase,identity:"sha256:"+"2".repeat(20)}}},sha));
 assert.equal(await inspectLive({url,token:"k".repeat(40),sha,fetchImpl:async()=>({status:200,json:async()=>good})}),true);
 await assert.rejects(inspectLive({url,token:"k".repeat(40),sha,fetchImpl:async()=>({status:503})}),/200/);
});
