#!/usr/bin/env node
// Used by .github/workflows/deploy-workers.yml's "Select workers" step on
// the auto-deploy path (a plain push, CLOUDFLARE_DEPLOY_ENABLED off, not a
// workflow_dispatch): narrows the deploy matrix to only the workers/* dirs
// that both changed in this push AND are on AUTO_DEPLOY_ALLOWLIST below.
// Replaces an earlier inline jq expression -- this version is committed,
// testable code instead of shell arithmetic nobody could run without jq.
import { execFileSync } from "node:child_process";

// Same set as the full matrix in deploy-workers.yml, minus
// authichain-agentz (Cloudflare Containers, Workers Paid, dispatch-only).
// A push deploys the members of this list that the push actually changed.
// passport-demo, qron-portfolio, first-dollar-desk, and
// stripe-webhook-worker stay off: they are archived, recovered-only, or
// pending retire, and are not in the matrix.
export const AUTO_DEPLOY_ALLOWLIST = [
  "authichain-api",
  "authichain-api-gateway",
  "authichain-automation",
  "authichain-com",
  "authichain-dashboard",
  "qron-automation",
  "qron-image-gen",
  "qron-outreach",
  "qron-space",
  "resend-relay",
  "strainchain-io",
  "govchain-us",
  "bitcoin-auth",
  "outreach-queue",
  "ai-classification",
  "analytics",
  "auth",
  "authichain-autopilot",
  "authichain-chain-data",
  "authichain-gateway",
  "authichain-license-issuer",
  "authichain-qron-provenance",
  "authichain-scan-validate",
  "authichain-telegram",
  "authichain-verify-worker",
  "stripe-webhook",
  "authichain-openclaw",
  "authichain-infra",
  "authichain-outreach-engine",
  "blockchain",
  "chipchain-io",
  "dpp-fulfillment",
  "fanchain-io",
  "glowchain-io",
  "gs1-resolver",
  "harvestchain-io",
  "luxechain-io",
  "partchain-io",
  "provenchain-io",
  "rxchain-io",
  "threadchain-io",
  "watchchain-io",
  "qfs-adapter",
  "authichain-bridge",
];

/**
 * Pure. changedWorkerDirs: the workers/* directory names touched in this
 * push (e.g. ["gs1-resolver", "authichain-com"] for a push touching both).
 * Returns the subset of `allowlist` present in `changedWorkerDirs`, in
 * `allowlist`'s own order.
 */
export function selectAutoDeployWorkers(changedWorkerDirs, allowlist) {
  const changed = new Set(changedWorkerDirs);
  return allowlist.filter(worker => changed.has(worker));
}

/**
 * Diffs `before...sha` under workers/ and returns the set of top-level
 * workers/* directory names touched. Never throws: a missing `before` ref
 * (shallow clone, force-push, first push to a branch) or any other git
 * error yields an empty set -- "nothing changed" -- so callers degrade to
 * an empty auto-deploy matrix rather than a failed job.
 */
export function changedWorkerDirsBetween(before, sha) {
  try {
    const out = execFileSync(
      "git",
      ["diff", "--name-only", before, sha, "--", "workers/"],
      { encoding: "utf8" }
    );
    const dirs = new Set();
    for (const line of out.split("\n")) {
      const seg = line.split("/")[1];
      if (seg) dirs.add(seg);
    }
    return [...dirs];
  } catch {
    return [];
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const before = process.env.PUSH_BEFORE ?? "";
  const sha = process.env.PUSH_SHA ?? "";
  const changed = changedWorkerDirsBetween(before, sha);
  const eligible = selectAutoDeployWorkers(changed, AUTO_DEPLOY_ALLOWLIST);
  console.log(JSON.stringify(eligible));
}
