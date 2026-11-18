#!/usr/bin/env node
/** Read-only fail-closed policy for explicit protected production secret binding. */
import { pathToFileURL } from "node:url";
export const REPOSITORY = "undone0603/authichain-unified";
export const MAIN_RULESET = 24073494;
export const ENVIRONMENTS = new Set([
  "production-cloudflare-edge-router",
  "production-cloudflare-x402-secrets",
  "production-cloudflare-qron-outreach",
]);
export const REQUIRED = [
  "test-workers", "test-other", "typecheck-ratchet", "quality",
  "extras", "build", "runtime-db-attestation-postgres", "main-quality-gate",
].map((name) => "ci/circleci: " + name);
const SHA = /^[a-f0-9]{40}$/;
const CIRCLE_JOB = /^https:\/\/app\.circleci\.com\/workflow\/[0-9a-f-]+\/job\/[0-9a-f-]+$/;
function guard(ok, reason) {
  if (!ok) throw new Error("protected secret binding: " + reason);
}
export function assertProtectedBindingPolicy({
  repository, eventName, ref, expectedSha, dispatchSha, environmentName,
  branch, ruleset, environment, statuses,
}) {
  guard(repository === REPOSITORY, "wrong repository");
  guard(eventName === "workflow_dispatch" && ref === "refs/heads/main",
    "not an explicit main-branch dispatch");
  guard(SHA.test(expectedSha || "") && SHA.test(dispatchSha || ""),
    "missing or malformed exact SHA");
  guard(expectedSha === dispatchSha, "dispatch SHA differs from expected SHA");
  guard(branch?.name === "main" && branch.protected === true &&
    branch.commit?.sha === expectedSha, "protected main moved");
  guard(ruleset?.id === MAIN_RULESET &&
    ruleset.name === "main-no-direct-push" &&
    ruleset.enforcement === "active" &&
    ruleset.conditions?.ref_name?.include?.includes("refs/heads/main") &&
    ruleset.rules?.some((r) => r.type === "pull_request"),
  "required active PR ruleset unavailable");
  // Read-only tokens may omit bypass_actors entirely. Reject a visible bypass,
  // and never assert that an omitted field proves no bypass actors exist.
  if (Array.isArray(ruleset.bypass_actors)) {
    guard(ruleset.bypass_actors.length === 0, "ruleset allows a bypass actor");
  }
  guard(ruleset.current_user_can_bypass !== "always", "caller can bypass main rules");
  guard(ENVIRONMENTS.has(environmentName) &&
    environment?.name === environmentName &&
    environment.deployment_branch_policy?.protected_branches === true &&
    environment.deployment_branch_policy?.custom_branch_policies === false &&
    environment.can_admins_bypass === false &&
    Array.isArray(environment.protection_rules),
  "protected environment policy or administrator-bypass restriction unavailable");
  guard(Number.isInteger(statuses?.total_count) &&
    statuses.total_count >= REQUIRED.length &&
    statuses.total_count <= 100 &&
    Array.isArray(statuses.statuses) &&
    statuses.statuses.length === statuses.total_count,
  "incomplete exact-SHA status evidence");
  // The GitHub combined-status response lists newest statuses first.
  const newest = new Map();
  for (const entry of statuses.statuses) {
    if (typeof entry.context === "string" && !newest.has(entry.context)) {
      newest.set(entry.context, entry);
    }
  }
  for (const name of REQUIRED) {
    const entry = newest.get(name);
    guard(entry?.state === "success" &&
      CIRCLE_JOB.test(entry.target_url || ""),
    "missing or unverified exact-SHA CircleCI success: " + name);
  }
  return {sha: expectedSha, environment: environmentName, checks: REQUIRED.length};
}
async function getJson(path, token, fetchImpl) {
  const response = await fetchImpl(
    "https://api.github.com/repos/" + REPOSITORY + path,
    {headers: {
      Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    }},
  );
  guard(response.ok, "GitHub read failed: " + path.split("?")[0] +
    " HTTP " + response.status);
  return response.json();
}
export async function verifyLive(env = process.env, fetchImpl = fetch) {
  const repository = env.REPO, expectedSha = env.EXPECTED_SHA;
  const dispatchSha = env.DISPATCH_SHA, environmentName = env.RELEASE_ENV;
  const token = env.GH_TOKEN;
  guard(typeof token === "string" && token.length > 0,
    "GitHub read token unavailable");
  guard(repository === REPOSITORY && SHA.test(expectedSha || "") &&
    SHA.test(dispatchSha || "") && ENVIRONMENTS.has(environmentName),
  "invalid release context");
  const [branch, ruleset, environment, statuses] = await Promise.all([
    getJson("/branches/main", token, fetchImpl),
    getJson("/rulesets/" + MAIN_RULESET, token, fetchImpl),
    getJson("/environments/" + environmentName, token, fetchImpl),
    getJson("/commits/" + expectedSha + "/status?per_page=100", token, fetchImpl),
  ]);
  return assertProtectedBindingPolicy({
    repository, eventName: env.GITHUB_EVENT_NAME, ref: env.GITHUB_REF,
    expectedSha, dispatchSha, environmentName,
    branch, ruleset, environment, statuses,
  });
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyLive().then((evidence) => {
    console.log("Protected manual binding policy passed:",
      JSON.stringify(evidence));
  }).catch((error) => {
    console.error("::error::" + error.message);
    process.exitCode = 1;
  });
}
