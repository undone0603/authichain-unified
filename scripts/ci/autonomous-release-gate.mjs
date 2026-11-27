#!/usr/bin/env node
/** Fail-closed, read-only policy for the ONE manual authichain-com release.
 *  This replaces a human GitHub environment-review rule; it does not create
 *  an environment, issue secrets, deploy a Worker, or authorize payments.
 */
import { pathToFileURL } from 'node:url';

export const REPO = 'undone0603/authichain-unified';
export const ENV = 'production-cloudflare';
export const RULESET = 24073494;
export const REQUIRED = [
  'test-workers', 'test-other', 'typecheck-ratchet', 'quality',
  'extras', 'build', 'main-quality-gate',
].map(s => 'ci/circleci: ' + s);
const AUTHICHAIN_CANDIDATE_CHECKS = [
  ...REQUIRED.filter(context => context !== 'ci/circleci: main-quality-gate'),
  'ci/circleci: runtime-db-attestation-postgres',
  'ci/circleci: authichain-quality-gate',
];
const SHA = /^[a-f0-9]{40}$/;
// Accept the current CircleCI app job URL and the older repository-scoped job URL.
const CIRCLE_JOB = /^(?:https:\/\/circleci\.com\/gh\/undone0603\/authichain-unified\/[0-9]+\/?|https:\/\/app\.circleci\.com\/workflow\/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\/job\/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})$/;
function guard(ok, message) { if (!ok) throw new Error('release policy: ' + message); }

export function assertReleasePolicy({repo, expectedSha, dispatchSha, branch, ruleset, environment, statuses, shaMatchPath, candidate = false}) {
  const matchPath = shaMatchPath || 'exact-head';
  const required = candidate ? AUTHICHAIN_CANDIDATE_CHECKS : REQUIRED;
  guard(!candidate || matchPath === 'exact-head', 'candidate requires current protected main');
  guard(matchPath === 'exact-head' || matchPath === 'ancestor', 'unknown SHA match path');
  guard(repo === REPO, 'wrong repository');
  guard(SHA.test(expectedSha || '') && SHA.test(dispatchSha || ''), 'exact dispatch SHA mismatch');
  guard(branch?.name === 'main' && branch?.protected === true && SHA.test(branch?.commit?.sha || ''),
        'main is not protected or exact current main has moved');
  if (matchPath === 'exact-head') {
    guard(expectedSha === dispatchSha && branch.commit.sha === expectedSha,
          expectedSha === dispatchSha
            ? 'main is not protected or exact current main has moved'
            : 'exact dispatch SHA mismatch');
  } else {
    guard(expectedSha !== branch.commit.sha,
          'ancestor path requires expected_sha behind main HEAD');
    guard(dispatchSha === branch.commit.sha,
          'dispatch not from current main');
  }
  guard(ruleset?.id === RULESET && ruleset?.name === 'main-no-direct-push' &&
        ruleset?.enforcement === 'active' &&
        ruleset?.conditions?.ref_name?.include?.includes('refs/heads/main') &&
        ruleset?.rules?.some(rule => rule.type === 'pull_request') &&
        (!Array.isArray(ruleset?.bypass_actors) || ruleset.bypass_actors.length === 0),
        'protected main PR ruleset missing, disabled, or bypassable');
  // GitHub mirrors protected_branches into protection_rules as type
  // branch_policy. Allow that echo, plus at most one owner review gate
  // (owner, 2026-11-25): required_reviewers naming at least one reviewer, with
  // self-review prevented. Reject wait_timer and every other rule.
  const envRules = Array.isArray(environment?.protection_rules) ? environment.protection_rules : null;
  const otherEnvRules = (envRules || []).filter(rule => rule?.type !== 'branch_policy');
  const ownerReview = rule => rule?.type === 'required_reviewers' && rule.prevent_self_review === true &&
        Array.isArray(rule.reviewers) && rule.reviewers.length > 0;
  const allowedEnvRules = otherEnvRules.length === 0 ||
        (otherEnvRules.length === 1 && ownerReview(otherEnvRules[0]));
  guard(environment?.name === ENV && environment?.deployment_branch_policy?.protected_branches === true &&
        environment?.deployment_branch_policy?.custom_branch_policies === false &&
        envRules !== null && allowedEnvRules,
        'environment must be protected-branches-only with at most one owner review gate and no wait timer or unknown rule');
  guard(Number.isInteger(statuses?.total_count) && statuses.total_count >= required.length &&
        statuses.total_count <= 100 && Array.isArray(statuses?.statuses) &&
        statuses.statuses.length === statuses.total_count, 'missing/incomplete commit-status evidence');
  // GitHub /status returns newest statuses first; the first occurrence is authoritative.
  const recent = new Map();
  for (const entry of statuses.statuses) {
    if (typeof entry.context === 'string' && !recent.has(entry.context)) recent.set(entry.context, entry);
  }
  for (const name of required) {
    const status = recent.get(name);
    guard(status?.state === 'success' && CIRCLE_JOB.test(status?.target_url || ''),
          'unverified exact-commit CircleCI status: ' + name);
  }
  return {sha: expectedSha, checks: required.length, environment: ENV};
}

async function getJson(path, token, fetchImpl = fetch) {
  const response = await fetchImpl('https://api.github.com/repos/' + REPO + path, {
    headers: {Authorization: 'Bearer ' + token, Accept: 'application/vnd.github+json',
              'X-GitHub-Api-Version': '2022-11-28'},
  });
  guard(response.ok, 'GitHub policy read HTTP ' + response.status + ': ' + path.split('?')[0]);
  return response.json();
}

export async function verifyLive(env = process.env, fetchImpl = fetch, {candidate = false} = {}) {
  const {GH_TOKEN, REPOSITORY, TARGET_SHA, DISPATCH_SHA} = env;
  guard(GH_TOKEN?.length > 0, 'missing read-only GitHub token');
  guard(REPOSITORY === REPO && SHA.test(TARGET_SHA || '') && SHA.test(DISPATCH_SHA || ''),
        'invalid dispatch identity');
  const [branch, ruleset, environment, statuses] = await Promise.all([
    getJson('/branches/main', GH_TOKEN, fetchImpl),
    getJson('/rulesets/' + RULESET, GH_TOKEN, fetchImpl),
    getJson('/environments/' + ENV, GH_TOKEN, fetchImpl),
    getJson('/commits/' + TARGET_SHA + '/status?per_page=100', GH_TOKEN, fetchImpl),
  ]);
  return assertReleasePolicy({repo: REPOSITORY, expectedSha: TARGET_SHA,
    dispatchSha: DISPATCH_SHA, branch, ruleset, environment, statuses,
    candidate, shaMatchPath: env.SHA_MATCH_PATH});
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyLive().then(result => console.log('Automated protected release policy passed:', JSON.stringify(result)))
    .catch(err => {console.error('::error::' + err.message); process.exitCode = 1;});
}
