#!/usr/bin/env node
/** DPP-only extra release gate. The previous workflow step invokes
 * autonomous-release-gate.mjs for branch/ruleset/env + seven CircleCI checks.
 * This check independently re-verifies current protected main and the eight
 * exact-head CircleCI contexts, including real PostgreSQL acceptance.
 * Read only. Never dispatch CI, deploy, mutate a DB or replay a webhook.
 */
import { pathToFileURL } from "node:url";
import { REQUIRED, REPO } from "./autonomous-release-gate.mjs";

export const REQUIRED_DPP = [...REQUIRED, "ci/circleci: runtime-db-attestation-postgres"];
const SHA = /^[a-f0-9]{40}$/;
const CIRCLE_JOB = /^(?:https:\/\/circleci\.com\/gh\/undone0603\/authichain-unified\/[0-9]+\/?|https:\/\/app\.circleci\.com\/workflow\/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}\/job\/[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12})$/;
function assert(ok, message) {
  if (!ok) throw new Error("DPP release CI: " + message);
}

export function verifyEvidence({repository, targetSha, dispatchSha, branch, statuses}) {
  assert(repository === REPO, "wrong repository");
  assert(SHA.test(targetSha || "") && targetSha === dispatchSha, "SHA/dispatch mismatch");
  assert(branch?.name === "main" && branch?.protected === true &&
    branch?.commit?.sha === targetSha, "protected main tip does not match release");
  assert(statuses?.sha === targetSha && Number.isInteger(statuses?.total_count) &&
    statuses.total_count >= REQUIRED_DPP.length && statuses.total_count <= 100 &&
    Array.isArray(statuses.statuses) &&
    statuses.statuses.length === statuses.total_count, "incomplete exact-head status response");
  // GitHub commit statuses are ordered newest first. A stale prior green status
  // for the same context must never override a current pending/failure.
  const recent = new Map();
  for (const value of statuses.statuses) {
    if (typeof value?.context === "string" && !recent.has(value.context)) {
      recent.set(value.context, value);
    }
  }
  for (const context of REQUIRED_DPP) {
    const status = recent.get(context);
    assert(status?.state === "success" &&
      CIRCLE_JOB.test(status?.target_url || ""), "missing/unverified " + context);
  }
  return {sha: targetSha, circleci_checks: REQUIRED_DPP.length, protected_main: true};
}

async function getGitHub(path, token, request) {
  const response = await request("https://api.github.com/repos/" + REPO + path, {
    headers: {Authorization: "Bearer " + token,
      Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28"},
  });
  assert(response.ok, "GitHub evidence unavailable");
  return response.json();
}

export async function verifyLive(env=process.env, request=fetch) {
  const {GH_TOKEN, REPOSITORY, TARGET_SHA, DISPATCH_SHA} = env;
  assert(GH_TOKEN?.length > 0 && REPOSITORY === REPO && SHA.test(TARGET_SHA || "") &&
    TARGET_SHA === DISPATCH_SHA, "invalid release identity");
  const [branch, statuses] = await Promise.all([
    getGitHub("/branches/main", GH_TOKEN, request),
    getGitHub("/commits/" + TARGET_SHA + "/status?per_page=100", GH_TOKEN, request),
  ]);
  return verifyEvidence({repository: REPOSITORY, targetSha: TARGET_SHA,
    dispatchSha: DISPATCH_SHA, branch, statuses});
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  verifyLive()
    .then(result => console.log("DPP exact-main release CI verified:", JSON.stringify(result)))
    .catch(err => {console.error("::error::" + err.message);process.exitCode = 1;});
}
