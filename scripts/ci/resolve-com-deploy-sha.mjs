#!/usr/bin/env node
/**
 * Decide whether expected_sha may be published for the protected
 * marketing Worker.
 *
 * Passes when expected_sha is current main HEAD, or an ancestor of main
 * whose intervening commits do not touch the Worker tree, this deploy
 * workflow, or root package/lock/workspace files. Always returns the
 * expected SHA so callers check out and publish that commit, not HEAD.
 */
import { appendFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const SHA = /^[a-f0-9]{40}$/;

export const PROTECTED_PATHS = [
  "workers/authichain-com/", // pragma: allowlist secret
  "workers/_shared/",
  "workers/authichain-verify-worker/",
  "src/lib/",
  "worker-app/",
  "schemas/",
  "protocol/",
  "content/seo/",
  "content/microsites/",
  "scripts/sync-microsite-packs.mjs",
  ".github/workflows/deploy-authichain-com.yml", // pragma: allowlist secret
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
  "package-lock.json",
  "yarn.lock",
  "bun.lockb",
  "bun.lock",
  "npm-shrinkwrap.json",
  "scripts/ci/",
  ".npmrc",
];

export function isProtectedChange(file) {
  const name = String(file || "");
  return PROTECTED_PATHS.some((p) =>
    p.endsWith("/")
      ? name === p.slice(0, -1) || name.startsWith(p)
      : name === p
  );
}

export function resolveDeploySha({
  expectedSha,
  mainSha,
  isAncestor,
  changedFiles,
}) {
  const expected = String(expectedSha || "").toLowerCase();
  const main = String(mainSha || "").toLowerCase();
  if (!SHA.test(expected) || !SHA.test(main)) {
    throw new Error(
      "deploy SHA check: expected_sha and main HEAD must be 40-character lowercase hex"
    );
  }
  if (expected === main) {
    return { sha: expected, path: "exact-head" };
  }
  if (!isAncestor) {
    throw new Error(
      `deploy SHA check: ${expected} is not current main HEAD (${main}) and is not an ancestor of main`
    );
  }
  const files = Array.isArray(changedFiles)
    ? changedFiles.map((f) => String(f || "").trim()).filter(Boolean)
    : [];
  if (files.length === 0) {
    throw new Error(
      "deploy SHA check: ancestor of main, but git diff was empty; fail closed"
    );
  }
  const protectedHits = files.filter(isProtectedChange);
  if (protectedHits.length) {
    throw new Error(
      "deploy SHA check: ancestor of main, but protected paths changed: " +
        protectedHits.join(", ")
    );
  }
  return { sha: expected, path: "ancestor" };
}

function git(args, cwd) {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

export function inspectGit({
  expectedSha,
  mainRef = "origin/main",
  cwd = process.cwd(),
} = {}) {
  const mainSha = git(["rev-parse", "--verify", mainRef], cwd).toLowerCase();
  let isAncestor = false;
  try {
    execFileSync("git", ["merge-base", "--is-ancestor", expectedSha, mainRef], {
      cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    });
    isAncestor = true;
  } catch (err) {
    if (err && err.status === 1) {
      isAncestor = false;
    } else {
      const detail = String(err?.stderr || err?.message || err).trim();
      throw new Error(
        "deploy SHA check: git merge-base --is-ancestor failed: " + detail
      );
    }
  }
  const changedFiles = git(
    ["diff", "--name-only", expectedSha, mainSha],
    cwd
  )
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
  return { mainSha, isAncestor, changedFiles };
}

export function logMatch(result, mainSha) {
  if (result.path === "exact-head") {
    console.log(
      `Deploy SHA check passed (exact HEAD): expected_sha ${result.sha} is current main HEAD.`
    );
    return;
  }
  console.log(
    `Deploy SHA check passed (ancestor): expected_sha ${result.sha} is an ancestor of main ${mainSha}; git diff has no protected-path changes. Checking out and deploying expected_sha, not HEAD.`
  );
}

function writeOutput(result) {
  const payload = `sha=${result.sha}\npath=${result.path}\n`;
  if (process.env.GITHUB_OUTPUT) appendFileSync(process.env.GITHUB_OUTPUT, payload);
  if (process.env.GITHUB_ENV) {
    appendFileSync(process.env.GITHUB_ENV, `SHA_MATCH_PATH=${result.path}\n`);
  }
}

function main(env = process.env, cwd = process.cwd()) {
  const expectedSha = env.TARGET_SHA || env.EXPECTED_SHA || "";
  const mainRef = env.MAIN_REF || "origin/main";
  const inspected = inspectGit({ expectedSha, mainRef, cwd });
  const result = resolveDeploySha({
    expectedSha,
    mainSha: inspected.mainSha,
    isAncestor: inspected.isAncestor,
    changedFiles: inspected.changedFiles,
  });
  logMatch(result, inspected.mainSha);
  writeOutput(result);
  return result;
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    main();
  } catch (err) {
    console.error("::error::" + err.message);
    process.exitCode = 1;
  }
}
