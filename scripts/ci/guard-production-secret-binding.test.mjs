import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { test } from "node:test";
import { assertProtectedBindingPolicy, REQUIRED } from "./guard-production-secret-binding.mjs";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const SHA = "a".repeat(40);
const GOOD_URL = "https://app.circleci.com/workflow/5f1ac019-3ae9-4ed0-92d9-50f4b62ba8a4/job/1d5a6b94-86c9-4a0e-bc0a-5e0fc0929e4e";
function validFixture() {
  return {
    repository:"undone0603/authichain-unified", eventName:"workflow_dispatch",
    ref:"refs/heads/main", expectedSha:SHA, dispatchSha:SHA,
    environmentName:"production-cloudflare-edge-router",
    branch:{name:"main",protected:true,commit:{sha:SHA}},
    ruleset:{
      id:24073494,name:"main-no-direct-push",enforcement:"active",
      bypass_actors:[],conditions:{ref_name:{include:["refs/heads/main"]}},
      rules:[{type:"pull_request"}],
    },
    environment:{
      name:"production-cloudflare-edge-router",
      deployment_branch_policy:{protected_branches:true,custom_branch_policies:false},
      can_admins_bypass:false,protection_rules:[{type:"branch_policy"}],
    },
    statuses:{
      total_count:REQUIRED.length,
      statuses:REQUIRED.map((context)=>({context,state:"success",target_url:GOOD_URL})),
    },
  };
}
test("valid protected-main, environment, and all eight CircleCI checks pass",()=>{
  assert.deepEqual(assertProtectedBindingPolicy(validFixture()),{
    sha:SHA,environment:"production-cloudflare-edge-router",checks:8,
  });
});
for(const [reason,modify] of [
  ["non-manual event",(f)=>{f.eventName="push";}],
  ["wrong ref",(f)=>{f.ref="refs/heads/feature";}],
  ["wrong dispatch SHA",(f)=>{f.dispatchSha="b".repeat(40);}],
  ["main moved",(f)=>{f.branch.commit.sha="b".repeat(40);}],
  ["unprotected main",(f)=>{f.branch.protected=false;}],
  ["disabled ruleset",(f)=>{f.ruleset.enforcement="disabled";}],
  ["ruleset bypass",(f)=>{f.ruleset.bypass_actors=[{actor_type:"RepositoryRole"}];}],
  ["missing PR rule",(f)=>{f.ruleset.rules=[];}],
  ["missing environment",(f)=>{f.environment=null;}],
  ["unprotected environment",(f)=>{f.environment.deployment_branch_policy.protected_branches=false;}],
  ["admin bypass",(f)=>{f.environment.can_admins_bypass=true;}],
  ["wrong environment",(f)=>{f.environment.name="production";}],
  ["incomplete status count",(f)=>{f.statuses.total_count+=1;}],
  ["pending aggregate",(f)=>{f.statuses.statuses.at(-1).state="pending";}],
  ["untrusted CI URL",(f)=>{f.statuses.statuses[0].target_url="https://example.com/pass";}],
  ["missing context",(f)=>{f.statuses.statuses.pop();f.statuses.total_count-=1;}],
]){
  test("fails closed: "+reason,()=>{
    const f=validFixture();modify(f);
    assert.throws(()=>assertProtectedBindingPolicy(f),/protected secret binding:/);
  });
}
test("read-only token may omit privileged ruleset bypass metadata",()=>{
  const f=validFixture();delete f.ruleset.bypass_actors;
  assert.equal(assertProtectedBindingPolicy(f).checks,8);
});
test("all four bind workflows require exact SHA, environment, and isolated credentials",()=>{
  const reqs={
    "bind-stripe-webhook-secrets.yml":["production-cloudflare-edge-router","AUTHICHAIN_EDGE_ROUTER_CLOUDFLARE"],
    "bind-lead-secrets.yml":["production-cloudflare-edge-router","AUTHICHAIN_EDGE_ROUTER_CLOUDFLARE"],
    "bind-x402-secrets.yml":["production-cloudflare-x402-secrets","AUTHICHAIN_X402_SECRET_BIND_CLOUDFLARE"],
    "set-qron-outreach-guardrail-secret.yml":["production-cloudflare-qron-outreach","AUTHICHAIN_QRON_OUTREACH_CLOUDFLARE"],
  };
  for(const [name,[environment,prefix]] of Object.entries(reqs)){
    const yml=readFileSync(path.join(ROOT,".github/workflows",name),"utf8");
    assert.match(yml,/workflow_dispatch:/);
    assert.doesNotMatch(yml,/^  push:/m);
    assert.match(yml,/github\.ref == 'refs\/heads\/main'/);
    assert.ok(yml.includes("name: "+environment));
    assert.ok(yml.includes("guard-production-secret-binding.mjs"));
    assert.ok(yml.includes("actions: read"),"the default token needs Actions read for environment inspection");
    assert.ok(yml.includes("group: production-secret-binding-"),"all manual writers must serialize");
    assert.ok(yml.includes("cancel-in-progress: false"));
    assert.ok(yml.includes("GH_TOKEN: "+"$"+"{{ github.token }}"));
    assert.ok(!yml.includes("AUTHICHAIN_ENV_POLICY_READ_TOKEN"));
    assert.ok(yml.includes("ref: "+"$"+"{{ inputs.expected_sha }}"));
    assert.ok(yml.includes("persist-credentials: false"));
    assert.ok(yml.includes("git sparse-checkout disable"));
    assert.ok(yml.includes("secrets."+prefix+"_API_TOKEN"));
    assert.ok(yml.includes("secrets."+prefix+"_ACCOUNT_ID"));
    assert.doesNotMatch(yml,/secrets\.CLOUDFLARE_API_TOKEN\b/);
    assert.doesNotMatch(yml,/secrets\.CLOUDFLARE_ACCOUNT_ID\b/);
    assert.ok(yml.indexOf("guard-production-secret-binding.mjs")<
      yml.indexOf("wrangler secret put"),"policy must precede writes: "+name);
  }
});
test("x402 is single-Worker manual only; push deploy never rewrites pay-to",()=>{
  const binder=readFileSync(path.join(ROOT,".github/workflows/bind-x402-secrets.yml"),"utf8");
  const deploy=readFileSync(path.join(ROOT,".github/workflows/deploy-workers.yml"),"utf8");
  assert.match(binder,/bind_pair "\$WORKER"/);
  assert.doesNotMatch(binder,/for name in authichain-com/);
  assert.doesNotMatch(binder,/^  push:/m);
  assert.match(binder,/Unreviewed pay-to destination refused/);
  assert.match(binder,/Unreviewed facilitator refused/);
  assert.doesNotMatch(deploy,/secret put X402_(?:PAY_TO|FACILITATOR_URL|USDC_ASSET)/);
  assert.match(deploy,/--keep-vars/);
});
test("qron uses byte-exact one-Worker rotation",()=>{
  const yml=readFileSync(path.join(ROOT,".github/workflows/set-qron-outreach-guardrail-secret.yml"),"utf8");
  assert.match(yml,/printf '%s' "\$INTERNAL_API_SECRET" \| wrangler secret put INTERNAL_API_SECRET --name qron-outreach/);
  assert.doesNotMatch(yml,/secret put INTERNAL_API_SECRET --name authichain-edge-router/);
  const bindStep=yml.slice(yml.indexOf("- name: Set INTERNAL_API_SECRET on qron-outreach only"));
  assert.equal((bindStep.match(/^        env:$/gm)||[]).length,1,"exactly one env mapping for the binding step");
});

test("manual protected deployment workflows cannot auto-publish production",()=>{
  for(const [name,environment,prefix] of [
    ["deploy-edge-worker.yml","production-cloudflare-revenue-worker","AUTHICHAIN_REVENUE_WORKER_CLOUDFLARE"],
    ["deploy-cloudflare.yml","production-cloudflare-manufacturer-status","AUTHICHAIN_MANUFACTURER_STATUS_CLOUDFLARE"],
  ]){
    const yml=readFileSync(path.join(ROOT,".github/workflows",name),"utf8");
    assert.match(yml,/workflow_dispatch:/);
    assert.doesNotMatch(yml,/^  push:/m);
    assert.match(yml,/if: github\.event_name == 'workflow_dispatch' && github\.ref == 'refs\/heads\/main'/);
    assert.ok(yml.includes("name: "+environment));
    assert.ok(yml.includes("guard-production-secret-binding.mjs"));
    assert.ok(yml.includes("ref: "+"$"+"{{ inputs.expected_sha }}"));
    assert.ok(yml.includes("cancel-in-progress: false"));
    assert.ok(yml.includes("secrets."+prefix+"_API_TOKEN"));
    assert.ok(yml.includes("secrets."+prefix+"_ACCOUNT_ID"));
    assert.doesNotMatch(yml,/secrets\.CLOUDFLARE_API_TOKEN\b/);
    assert.doesNotMatch(yml,/secrets\.CLOUDFLARE_ACCOUNT_ID\b/);
    assert.ok(yml.indexOf("guard-production-secret-binding.mjs") < yml.indexOf("wrangler deploy"),"release policy precedes upload");
    if(name==="deploy-edge-worker.yml") assert.ok(yml.indexOf("guard-production-secret-binding.mjs") < yml.indexOf("wrangler secret put"),"release policy precedes secret updates");
  }
});
test("revenue and manufacturer environments are authorized only with matching evidence",()=>{
  for(const environmentName of ["production-cloudflare-revenue-worker","production-cloudflare-manufacturer-status"]){
    const f=validFixture();f.environmentName=environmentName;f.environment.name=environmentName;
    assert.equal(assertProtectedBindingPolicy(f).environment,environmentName);
    f.environment.deployment_branch_policy.protected_branches=false;
    assert.throws(()=>assertProtectedBindingPolicy(f),/protected secret binding:/);
  }
});

test("deploy-workers push path cannot rotate sensitive credentials",()=>{
  const yml=readFileSync(path.join(ROOT,".github/workflows/deploy-workers.yml"),"utf8");
  for(const title of [
    "Bind agentz secrets",
    "Bind command-center secrets",
    "Bind claw AGENTZ_* secrets",
    "Bind Stripe secret on authichain-com",
    "Bind ISSUE_SECRET on gs1-resolver",
  ]){
    const marker="- name: "+title+"\n        if: |\n";
    assert.equal(yml.split(marker).length,2,"one binder: "+title);
    const step=yml.slice(yml.indexOf(marker));
    assert.match(step,/^          github\.event_name == 'workflow_dispatch' &&/m,
      "no automatic push secret binder: "+title);
  }
  assert.doesNotMatch(yml,/secret put X402_(?:PAY_TO|FACILITATOR_URL|USDC_ASSET)/);
  assert.match(yml,/--keep-vars/);
});
