import {test} from 'node:test';
import assert from 'node:assert/strict';
import {assertReleasePolicy, REQUIRED, REPO, ENV, RULESET, verifyLive} from './autonomous-release-gate.mjs';
const SHA = 'a'.repeat(40);
const URL = 'https://circleci.com/gh/undone0603/authichain-unified/2914';
function fixture() {
  return {
    repo: REPO, expectedSha: SHA, dispatchSha: SHA,
    branch: {name: 'main', protected: true, commit: {sha: SHA}},
    ruleset: {id: RULESET, name: 'main-no-direct-push', enforcement: 'active',
      conditions: {ref_name: {include: ['refs/heads/main']}},
      bypass_actors: [], rules: [{type: 'pull_request'}]},
    environment: {name: ENV,
      deployment_branch_policy: {protected_branches: true, custom_branch_policies: false},
      protection_rules: []},
    statuses: {total_count: 7,
      statuses: REQUIRED.map(context => ({context, state: 'success', target_url: URL}))},
  };
}
function rejects(change, why) {const x=fixture();change(x);assert.throws(() => assertReleasePolicy(x), why);}

test('accepts exact main SHA, protected branch, no human gate and all seven successful jobs', () => {
  assert.deepEqual(assertReleasePolicy(fixture()), {sha: SHA, checks: 7, environment: ENV});
});
test('accepts successful CircleCI app workflow/job links on current main', () => {
  const x = fixture();
  const currentMainJob = 'https://app.circleci.com/workflow/e99fd4ba-7989-4a70-978b-d54f184a9e18/job/87f65d57-d79f-4b16-bc74-bc212fb2c9ea';
  x.statuses.statuses.forEach(s => { s.target_url = currentMainJob; });
  assert.equal(assertReleasePolicy(x).checks, 7);
});

test('rejects impersonated CircleCI app hosts and extra job URL paths', () => {
  const legitimate = 'https://app.circleci.com/workflow/e99fd4ba-7989-4a70-978b-d54f184a9e18/job/87f65d57-d79f-4b16-bc74-bc212fb2c9ea';
  rejects(x => { x.statuses.statuses[0].target_url = legitimate.replace('app.circleci.com/', 'app.circleci.com.evil.test/'); }, /test-workers/);
  rejects(x => { x.statuses.statuses[0].target_url = legitimate + '/extra'; }, /test-workers/);
});

test('rejects wrong repository, malformed SHA, dispatch mismatch and stale main', () => {
  rejects(x => x.repo = 'someone/else', /wrong repository/);
  rejects(x => x.expectedSha = 'invalid', /SHA mismatch/);
  rejects(x => x.dispatchSha = 'b'.repeat(40), /SHA mismatch/);
  rejects(x => x.branch.commit.sha = 'b'.repeat(40), /main has moved/);
  rejects(x => x.branch.protected = false, /not protected/);
});
test('accepts ancestor match when live main is ahead and SHA_MATCH_PATH is ancestor', () => {
  const x = fixture();
  x.shaMatchPath = 'ancestor';
  x.dispatchSha = 'b'.repeat(40);
  x.branch.commit.sha = 'b'.repeat(40);
  assert.deepEqual(assertReleasePolicy(x), {sha: SHA, checks: 7, environment: ENV});
});
test('ancestor path still requires all seven CircleCI jobs on expected_sha', () => {
  const x = fixture();
  x.shaMatchPath = 'ancestor';
  x.dispatchSha = 'b'.repeat(40);
  x.branch.commit.sha = 'b'.repeat(40);
  x.statuses.statuses[0].state = 'pending';
  assert.throws(() => assertReleasePolicy(x), /test-workers/);
});
test('ancestor path rejects when expected_sha is still live main HEAD', () => {
  const x = fixture();
  x.shaMatchPath = 'ancestor';
  assert.throws(() => assertReleasePolicy(x), /behind main HEAD/);
});
test('unknown SHA match path is rejected', () => {
  rejects(x => x.shaMatchPath = 'maybe', /unknown SHA match path/);
});
test('requires active main PR ruleset with no explicit bypass actor', () => {
  rejects(x => x.ruleset.enforcement = 'disabled', /ruleset/);
  rejects(x => x.ruleset.conditions.ref_name.include = ['refs/heads/dev'], /ruleset/);
  rejects(x => x.ruleset.rules = [], /ruleset/);
  rejects(x => x.ruleset.bypass_actors = [{actor_id: 1}], /ruleset/);
});
test('requires the exact environment and protected branch restrictions', () => {
  rejects(x => x.environment = null, /environment/);
  rejects(x => x.environment.name = 'Production', /environment/);
  rejects(x => x.environment.deployment_branch_policy.protected_branches = false, /environment/);
  rejects(x => x.environment.deployment_branch_policy.custom_branch_policies = true, /environment/);
  rejects(x => x.environment.protection_rules = [{type: 'required_reviewers'}], /environment/);
  rejects(x => x.environment.protection_rules = [{type: 'wait_timer'}], /environment/);
  // GitHub API echo of protected_branches — must still pass.
  const withBranchPolicy = fixture();
  withBranchPolicy.environment.protection_rules = [{type: 'branch_policy'}];
  assert.deepEqual(assertReleasePolicy(withBranchPolicy), {sha: SHA, checks: 7, environment: ENV});
  rejects(x => x.environment.protection_rules = [{type: 'branch_policy'}, {type: 'wait_timer'}], /environment/);
});
test('fails when any required status is absent, failed, pending or has a fake destination', () => {
  rejects(x => {x.statuses.statuses.pop();x.statuses.total_count = 6;}, /status evidence/);
  rejects(x => {x.statuses.statuses[0].state = 'pending';}, /test-workers/);
  rejects(x => {x.statuses.statuses[0].state = 'failure';}, /test-workers/);
  rejects(x => {x.statuses.statuses[0].target_url = 'https://circleci.com.evil.test/gh/undone0603/authichain-unified/2914';}, /test-workers/);
  rejects(x => {x.statuses.statuses[0].target_url = 'https://circleci.com/gh/undone0603/authichain-unified/2914/evil';}, /test-workers/);
  rejects(x => {x.statuses.total_count = 101;}, /status evidence/);
});
test('newest status for each context wins over previously green result', () => {
  rejects(x => {x.statuses.statuses.unshift({...x.statuses.statuses[0], state: 'pending'});
    x.statuses.total_count += 1;}, /test-workers/);
});
test('read-only live verifier accepts only four scoped GitHub reads', async () => {
  const x = fixture(), paths=[];
  const responses = {'/branches/main':x.branch,
    ['/rulesets/' + RULESET]:x.ruleset,
    ['/environments/' + ENV]:x.environment,
    ['/commits/' + SHA + '/status?per_page=100']:x.statuses};
  const fakeFetch = async url => {const path = url.replace('https://api.github.com/repos/' + REPO, '');
    paths.push(path);return {ok:true,json:async()=>responses[path]};};
  assert.equal((await verifyLive({GH_TOKEN:'test-token',REPOSITORY:REPO,TARGET_SHA:SHA,DISPATCH_SHA:SHA},fakeFetch)).checks,7);
  assert.equal(paths.length,4);
  assert(paths.every(p => p in responses));
});
test('missing GitHub response rejects the release before deployment', async () => {
  await assert.rejects(verifyLive({GH_TOKEN:'token',REPOSITORY:REPO,TARGET_SHA:SHA,DISPATCH_SHA:SHA},
    async()=>({ok:false,status:404})),/HTTP 404/);
});
test('live verifier on ancestor path still reads CircleCI statuses for expected_sha', async () => {
  const x = fixture();
  x.branch.commit.sha = 'b'.repeat(40);
  const paths=[];
  const responses = {'/branches/main':x.branch,
    ['/rulesets/' + RULESET]:x.ruleset,
    ['/environments/' + ENV]:x.environment,
    ['/commits/' + SHA + '/status?per_page=100']:x.statuses};
  const fakeFetch = async url => {const path = url.replace('https://api.github.com/repos/' + REPO, '');
    paths.push(path);return {ok:true,json:async()=>responses[path]};};
  assert.equal((await verifyLive({GH_TOKEN:'test-token',REPOSITORY:REPO,TARGET_SHA:SHA,
    DISPATCH_SHA:'b'.repeat(40),SHA_MATCH_PATH:'ancestor'},fakeFetch)).checks,7);
  assert.equal(paths.filter(p => p.startsWith('/commits/')).join(),
    '/commits/' + SHA + '/status?per_page=100');
});
