import test from "node:test";
import assert from "node:assert/strict";
import {isArchiveOnly,decide} from "./ci-scope.mjs";
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
