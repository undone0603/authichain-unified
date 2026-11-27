import test from "node:test";
import assert from "node:assert/strict";
import {isArchiveOnly,isAgentzOnly,isAuthichainAppOnly,decide,
 AUTHICHAIN_TASKS} from "./ci-scope.mjs";
const SHA="a".repeat(40);
test("archive/changelog-only change skips only non-quality tasks",()=>{
 assert.equal(isArchiveOnly(["docs/archive/old.md","pkg/CHANGELOG.md"]),true);
 for(const task of ["test-workers","test-other","build","extras","typecheck-ratchet"])
  assert.equal(decide(task,"docs/pr",SHA,["docs/archive/old.md"]),"skip");
});
test("quality, main, and unknown metadata always run full",()=>{
 for(const [task,branch,sha] of [["quality","pr",SHA],["build","main",SHA],
  ["build","",SHA],["build","pr","bad"]])
  assert.equal(decide(task,branch,sha,["docs/archive/old.md"]),"full");
});
test("substantive edits are never skipped",()=>{
 for(const path of ["README.md","docs/operations/notes.md","src/lib/grants.ts",
  "workers/stripe-webhook/src/index.ts","supabase/migrations/grants.sql",
  ".github/workflows/main.yml",".circleci/quality-check.sh",
  "docs/archive/../src/index.ts"])
  assert.equal(decide("build","pr",SHA,[path]),"full",path);
});
test("empty, mixed, absolute and noncanonical paths fail closed",()=>{
 for(const paths of [[],["docs/archive/a","src/app.ts"],["/docs/archive/a"],
  ["docs/archive/"],["docs/archive/../../a"],["docs\\archive\\a"]])
  assert.equal(isArchiveOnly(paths),false,JSON.stringify(paths));
});
const APP=[...AUTHICHAIN_TASKS];
test("AgentZ-only changes skip every AuthiChain task and run AgentZ",()=>{
 const paths=["agentz/core/runner.py","agentz/tests/test_x.py","requirements-agentz.txt",
  "pyproject.toml","docs/agentz/evidence/a.md","docs/archive/old.md"];
 assert.equal(isAgentzOnly(paths),true);
 for(const task of APP)assert.equal(decide(task,"pr",SHA,paths),"skip",task);
 assert.equal(decide("agentz","pr",SHA,paths),"full");
 assert.equal(decide("quality","pr",SHA,paths),"full");
});
test("AuthiChain app-only changes skip AgentZ and run every AuthiChain task",()=>{
 const paths=["src/lib/plans.ts","server/jobs/x.ts","apps/verifier-web/a.tsx",
  "supabase/migrations/a.sql","packages/policy/index.ts"];
 assert.equal(isAuthichainAppOnly(paths),true);
 assert.equal(decide("agentz","pr",SHA,paths),"skip");
 for(const task of APP)assert.equal(decide(task,"pr",SHA,paths),"full",task);
});
test("contract, shared and AgentZ-read paths run both products",()=>{
 for(const path of ["src/app/api/agentz/webhook/route.ts","server/jobs/agentz-supervisor.ts",
  "supabase/functions/agentZ-growth-engine/index.ts","workers/authichain-com/src/bot-identities.ts",
  "workers/authichain-automation/index.js","protocol/fixtures/a.json","scripts/ci/ci-scope.mjs",
  ".circleci/config.yml",".github/workflows/agentz-ci.yml","package.json","pnpm-lock.yaml",
  "tests/test_other.py","README.md","src/","agentz/"]) {
  assert.equal(decide("agentz","pr",SHA,[path]),"full",path);
  assert.equal(decide("build","pr",SHA,[path]),"full",path);
 }
});
test("mixed products, main and noncanonical paths fail closed",()=>{
 const mixed=["agentz/cli.py","src/lib/plans.ts"];
 for(const task of [...APP,"agentz"]) {
  assert.equal(decide(task,"pr",SHA,mixed),"full",task);
  assert.equal(decide(task,"main",SHA,["agentz/cli.py"]),"full",task);
  assert.equal(decide(task,"main",SHA,["src/a.ts"]),"full",task);
 }
 for(const paths of [[],["agentz/../src/a.ts"],["/agentz/a.py"],["agentz\\a.py"]]) {
  assert.equal(isAgentzOnly(paths),false,JSON.stringify(paths));
  assert.equal(isAuthichainAppOnly(paths),false,JSON.stringify(paths));
 }
 assert.equal(isAuthichainAppOnly(["src/../agentz/a.py"]),false);
});
