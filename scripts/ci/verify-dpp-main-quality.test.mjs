import { test } from "node:test";
import assert from "node:assert/strict";
import { REQUIRED_DPP, verifyEvidence, verifyLive } from "./verify-dpp-main-quality.mjs";
const REPO = "undone0603/authichain-unified";
const sha = "a".repeat(40);
const url = "https://app.circleci.com/workflow/00000000-0000-0000-0000-000000000001/job/00000000-0000-0000-0000-000000000002";
const baseline = () => ({
  repository: REPO,
  targetSha: sha,
  dispatchSha: sha,
  branch: {name: "main", protected: true, commit: {sha}},
  statuses: {sha, total_count: REQUIRED_DPP.length,
    statuses: REQUIRED_DPP.map(context => ({context, state: "success", target_url: url}))},
});
test("accepts eight independently attributed exact-head CircleCI successes", () => {
  const result = verifyEvidence(baseline());
  assert.equal(result.circleci_checks, 8);
  assert.equal(result.sha, sha);
});
test("fails closed on missing PostgreSQL race/attestation job", () => {
  const x = baseline();x.statuses.statuses.pop();x.statuses.total_count--;
  assert.throws(() => verifyEvidence(x), /incomplete|unverified/);
});
test("fails closed on pending aggregate quality gate", () => {
  const x = baseline();x.statuses.statuses.find(s => s.context.endsWith("main-quality-gate")).state="pending";
  assert.throws(() => verifyEvidence(x), /unverified/);
});
test("fails closed on failed quality job", () => {
  const x = baseline();x.statuses.statuses[0].state="failure";
  assert.throws(() => verifyEvidence(x), /unverified/);
});
test("fails closed on a forged or unrelated status URL", () => {
  const x = baseline();x.statuses.statuses[0].target_url="https://example.org/fake";
  assert.throws(() => verifyEvidence(x), /unverified/);
});
test("latest pending status overrides stale success for same context", () => {
  const x = baseline();
  x.statuses.statuses.unshift({...x.statuses.statuses[0],state:"pending"});
  x.statuses.total_count++;
  assert.throws(() => verifyEvidence(x), /unverified/);
});
test("requires exact SHA and protected main tip", () => {
  const x = baseline();x.dispatchSha="b".repeat(40);
  assert.throws(() => verifyEvidence(x), /SHA/);
  const y = baseline();y.branch.commit.sha="b".repeat(40);
  assert.throws(() => verifyEvidence(y), /protected main/);
  const z = baseline();z.branch.protected=false;
  assert.throws(() => verifyEvidence(z), /protected main/);
});
test("rejects a status object for another commit", () => {
  const x=baseline();x.statuses.sha="b".repeat(40);
  assert.throws(() => verifyEvidence(x), /incomplete/);
});
test("verifies read-only GitHub evidence from current branch and SHA", async () => {
  const x=baseline();const requests=[];
  const result=await verifyLive(
    {GH_TOKEN:"synthetic-read-only-token",REPOSITORY:REPO,TARGET_SHA:sha,DISPATCH_SHA:sha},
    async target=>{
      requests.push(target);
      return {ok:true,json:async()=>target.endsWith("/branches/main")?x.branch:x.statuses};
    }
  );
  assert.equal(result.circleci_checks,8);
  assert.equal(requests.length,2);
});
test("fails closed on missing API evidence", async () => {
  await assert.rejects(verifyLive(
    {GH_TOKEN:"synthetic",REPOSITORY:REPO,TARGET_SHA:sha,DISPATCH_SHA:sha},
    async()=>({ok:false,status:403})
  ),/unavailable/);
});
