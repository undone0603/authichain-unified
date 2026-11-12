import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {assertReleasePolicy, REQUIRED, REPO, ENV, RULESET, verifyLive} from './autonomous-release-gate.mjs';
const SHA = 'a'.repeat(40);
// Job destination shape is verified against actual CircleCI statuses on main.
const WORKFLOW = '49ccea43-060d-4fcb-b0fe-a1229ceb7512';
const JOB = 'fa56472c-4a4b-4348-bda2-ef4cbbd1be9d';
const URL = 'https://app.circleci.com/workflow/' + WORKFLOW + '/job/' + JOB;
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
test('preserves legacy CircleCI URL support from main without accepting mixed formats', () => {
  const x = fixture();
  const legacyURL = 'https://circleci.com/gh/undone0603/authichain-unified/2914';
  for (const status of x.statuses.statuses) status.target_url = legacyURL;
  assert.equal(assertReleasePolicy(x).checks, 7);
  x.statuses.statuses[0].target_url = URL;
  assert.throws(() => assertReleasePolicy(x), /mixed CircleCI workflows/);
});
test('accepts the current CircleCI app job format from main', () => {
  const x = fixture();
  const currentMainJob = 'https://app.circleci.com/workflow/e99fd4ba-7989-4a70-978b-d54f184a9e18/job/87f65d57-d79f-4b16-bc74-bc212fb2c9ea';
  for (const status of x.statuses.statuses) status.target_url = currentMainJob;
  assert.equal(assertReleasePolicy(x).checks, 7);
});
test('rejects wrong repository, malformed SHA, dispatch mismatch and stale main', () => {
  rejects(x => x.repo = 'someone/else', /wrong repository/);
  rejects(x => x.expectedSha = 'invalid', /SHA mismatch/);
  rejects(x => x.dispatchSha = 'b'.repeat(40), /SHA mismatch/);
  rejects(x => x.branch.commit.sha = 'b'.repeat(40), /main has moved/);
  rejects(x => x.branch.protected = false, /not protected/);
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
  rejects(x => {x.statuses.statuses[0].target_url = URL.replace('app.circleci.com', 'app.circleci.com.evil.test');}, /test-workers/);
  rejects(x => {x.statuses.statuses[0].target_url = URL + '/evil';}, /test-workers/);
  rejects(x => {x.statuses.statuses[0].target_url = 'https://circleci.com/gh/undone0603/authichain-unified/2914/extra';}, /test-workers/);
  rejects(x => {x.statuses.statuses[0].target_url = 'https://circleci.com/gh/other-owner/authichain-unified/2914';}, /test-workers/);
  rejects(x => {x.statuses.statuses[0].target_url = 'https://circleci.com/gh/undone0603/authichain-unified/2914';}, /mixed CircleCI workflows/);
  rejects(x => {x.statuses.statuses[0].target_url = URL.replace('/job/', '/task/');}, /test-workers/);
  rejects(x => {x.statuses.statuses[0].target_url = URL.replace(JOB, 'invalid-uuid');}, /test-workers/);
  rejects(x => {x.statuses.statuses[0].target_url = URL.replace(WORKFLOW, '11111111-2222-3333-4444-555555555555');}, /mixed CircleCI workflows/);
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

test('payment Worker edge release remains manual-only, SHA-pinned and policy-protected', () => {
  const workflow = readFileSync(
    new URL('../../.github/workflows/deploy-authichain-edge-router.yml', import.meta.url),
    'utf8'
  );
  assert.match(workflow, /^on:\n  workflow_dispatch:\n    inputs:\n      expected_sha:/m);
  assert.doesNotMatch(workflow, /^  push:/m);
  assert.match(workflow, /if: github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /environment:\s*\n\s+name: production-cloudflare/);
  assert.match(workflow, /TARGET_SHA: \$\{\{ inputs\.expected_sha \}\}/);
  assert.match(workflow, /DISPATCH_SHA: \$\{\{ github\.sha \}\}/);
  assert.match(workflow, /test "\$\(git rev-parse HEAD\)" = "\$TARGET_SHA"/);
  assert.match(workflow, /node --test scripts\/ci\/autonomous-release-gate\.test\.mjs/);
  assert.match(workflow, /node scripts\/ci\/autonomous-release-gate\.mjs/);
  assert.match(workflow, /persist-credentials: false/);
  // Payment Worker releases must not inherit broad repository token aliases.
  assert.match(workflow, /secrets\.AUTHICHAIN_PRODUCTION_CLOUDFLARE_API_TOKEN/);
  assert.match(workflow, /secrets\.AUTHICHAIN_PRODUCTION_CLOUDFLARE_ACCOUNT_ID/);
  assert.doesNotMatch(workflow, /secrets\.CLOUDFLARE_API_TOKEN/);
  assert.doesNotMatch(workflow, /secrets\.CLOUDFLARE_ACCOUNT_ID/);
  assert.ok(
    workflow.indexOf('node scripts/ci/autonomous-release-gate.mjs') <
      workflow.indexOf('Record live version (rollback target)'),
    'policy must pass before any production upload or promotion'
  );
  const publish = workflow.slice(
    workflow.indexOf('      - name: Publish authichain-edge-router'),
    workflow.indexOf('      - name: Smoke JWKS current + retired kids')
  );
  const guards = [...publish.matchAll(/node \.\.\/scripts\/ci\/autonomous-release-gate\.mjs/g)]
    .map(match => match.index);
  assert.equal(guards.length, 2, 're-check exact main before upload and before promotion');
  const upload = publish.indexOf('upload-worker-version.mjs authichain-edge-router');
  const promotion = publish.indexOf('promote-worker-version.mjs authichain-edge-router');
  assert.ok(guards[0] < upload && upload < guards[1] && guards[1] < promotion,
    'slow upload must not permit an unapproved newer main SHA to be published');
});
