import {test} from "node:test";
import assert from "node:assert/strict";
import {assertPolicy,verifyEnvironment} from "./verify-dpp-release-env.mjs";
const ok=()=>({name:"production-supabase",deployment_branch_policy:{protected_branches:true,custom_branch_policies:false},protection_rules:[{type:"branch_policy"}]});
test("accepts explicit protected-branches-only environment",()=>assert.equal(assertPolicy(ok()),true));
test("rejects absent, unprotected and custom branch environment",()=>{
  for(const bad of [null,{...ok(),name:"Production"},{...ok(),deployment_branch_policy:{protected_branches:false,custom_branch_policies:false}},{...ok(),deployment_branch_policy:{protected_branches:true,custom_branch_policies:true}},{...ok(),protection_rules:null}])
    assert.throws(()=>assertPolicy(bad),/production-supabase/);
});
test("reads exact GitHub environment without modifying it",async()=>{
  let url="";
  assert.equal(await verifyEnvironment({token:"test",fetchImpl:async u=>(url=u,{ok:true,json:async()=>ok()})}),"production-supabase");
  assert.equal(url,"https://api.github.com/repos/undone0603/authichain-unified/environments/production-supabase");
});
test("fails closed on unavailable environment API",async()=>{
  await assert.rejects(verifyEnvironment({token:"test",fetchImpl:async()=>({ok:false,status:403})}),/HTTP 403/);
});
