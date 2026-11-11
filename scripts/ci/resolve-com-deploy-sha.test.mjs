import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  inspectGit,
  isProtectedChange,
  PROTECTED_PATHS,
  resolveDeploySha,
} from "./resolve-com-deploy-sha.mjs";

const EXPECTED = "a".repeat(40);
const MAIN = "b".repeat(40);
const WORKER_DIR = PROTECTED_PATHS[0];
const WORKFLOW = ".github/workflows/deploy-authichain-com.yml";
const WORKER_ROOT = WORKER_DIR.replace(/\/$/, "");

test("exact HEAD match deploys expected_sha", () => {
  assert.deepEqual(
    resolveDeploySha({
      expectedSha: EXPECTED,
      mainSha: EXPECTED,
      isAncestor: true,
      changedFiles: [],
    }),
    { sha: EXPECTED, path: "exact-head" }
  );
});

test("ancestor with only unrelated paths (e.g. autonomy.json) passes", () => {
  assert.deepEqual(
    resolveDeploySha({
      expectedSha: EXPECTED,
      mainSha: MAIN,
      isAncestor: true,
      changedFiles: [".github/autonomy.json", "docs/NETWORK.md"],
    }),
    { sha: EXPECTED, path: "ancestor" }
  );
});

test("ancestor fails when the protected Worker tree changed", () => {
  const touched = `${WORKER_DIR}src/index.ts`;
  assert.throws(
    () =>
      resolveDeploySha({
        expectedSha: EXPECTED,
        mainSha: MAIN,
        isAncestor: true,
        changedFiles: [touched],
      }),
    new RegExp(`protected paths changed: ${touched.replaceAll("/", "\\/")}`)
  );
});

test("ancestor fails when the deploy workflow or root package files changed", () => {
  for (const file of [
    WORKFLOW,
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
  ]) {
    assert.throws(
      () =>
        resolveDeploySha({
          expectedSha: EXPECTED,
          mainSha: MAIN,
          isAncestor: true,
          changedFiles: [file],
        }),
      /protected paths changed/
    );
  }
});

test("ancestor fails closed when git diff reports no files", () => {
  for (const changedFiles of [[], null]) {
    assert.throws(
      () =>
        resolveDeploySha({
          expectedSha: EXPECTED,
          mainSha: MAIN,
          isAncestor: true,
          changedFiles,
        }),
      /git diff was empty/
    );
  }
});

test("ancestor fails when newly protected lockfiles or bundled modules changed", () => {
  const newProtected = [
    "workers/_shared/estate-landing.ts",
    "workers/authichain-verify-worker/mcp-routes.ts",
    "src/lib/plans.ts",
    "worker-app/checkout-growth.ts",
    "schemas/example.json",
    "protocol/example.ts",
    "content/seo/page.md",
    "content/microsites/pack.json",
    "scripts/sync-microsite-packs.mjs",
    "package-lock.json",
    "yarn.lock",
    "bun.lockb",
    "bun.lock",
    "npm-shrinkwrap.json",
    "scripts/ci/resolve-com-deploy-sha.mjs",
    "scripts/ci/autonomous-release-gate.mjs",
    "scripts/ci/parse-wrangler-version-id.mjs",
    "scripts/ci/promote-worker-version.mjs",
    ".npmrc",
  ];
  for (const file of newProtected) {
    assert.throws(
      () =>
        resolveDeploySha({
          expectedSha: EXPECTED,
          mainSha: MAIN,
          isAncestor: true,
          changedFiles: [file],
        }),
      /protected paths changed/
    );
  }
});

test("non-ancestor behind or beside main fails", () => {
  assert.throws(
    () =>
      resolveDeploySha({
        expectedSha: EXPECTED,
        mainSha: MAIN,
        isAncestor: false,
        changedFiles: [".github/autonomy.json"],
      }),
    /not an ancestor of main/
  );
});

test("nested package.json outside the Worker is not a root lockfile hit", () => {
  assert.equal(isProtectedChange("apps/web/package.json"), false);
  assert.equal(isProtectedChange("package.json"), true);
  assert.equal(isProtectedChange(`${WORKER_ROOT}-extra/x.ts`), false);
  assert.equal(isProtectedChange(WORKER_ROOT), true);
});

test("malformed SHAs fail closed", () => {
  assert.throws(
    () =>
      resolveDeploySha({
        expectedSha: "abc",
        mainSha: MAIN,
        isAncestor: true,
        changedFiles: [],
      }),
    /40-character lowercase hex/
  );
});

function gitRepo() {
  const dir = mkdtempSync(path.join(tmpdir(), "ac-sha-"));
  const git = (...args) =>
    execFileSync("git", args, { cwd: dir, encoding: "utf8" }).trim();
  execFileSync("git", ["init", "-q", "-b", "main"], { cwd: dir });
  git("config", "user.email", "ci@example.test");
  git("config", "user.name", "ci");
  mkdirSync(path.join(dir, WORKER_ROOT), { recursive: true });
  mkdirSync(path.join(dir, ".github", "workflows"), { recursive: true });
  writeFileSync(path.join(dir, WORKER_DIR, "w.txt"), "w\n");
  writeFileSync(path.join(dir, "package.json"), "{}\n");
  writeFileSync(path.join(dir, "pnpm-lock.yaml"), "lock\n");
  writeFileSync(path.join(dir, "pnpm-workspace.yaml"), "packages: []\n");
  writeFileSync(path.join(dir, WORKFLOW), "name: d\n");
  git("add", ".");
  git("commit", "-qm", "base");
  const base = git("rev-parse", "HEAD");
  return { dir, git, base };
}

test("git: expected_sha == main HEAD is exact-head", () => {
  const { dir, base } = gitRepo();
  const inspected = inspectGit({
    expectedSha: base,
    mainRef: "main",
    cwd: dir,
  });
  assert.equal(inspected.mainSha, base);
  assert.deepEqual(
    resolveDeploySha({ expectedSha: base, ...inspected }),
    { sha: base, path: "exact-head" }
  );
});

test("git: ancestor with only autonomy.json is allowed; Worker edits are not", () => {
  const { dir, git, base } = gitRepo();
  writeFileSync(path.join(dir, ".github", "autonomy.json"), "{}\n");
  git("add", ".github/autonomy.json");
  git("commit", "-qm", "unrelated");
  const head = git("rev-parse", "HEAD");
  const ok = inspectGit({ expectedSha: base, mainRef: "main", cwd: dir });
  assert.equal(ok.mainSha, head);
  assert.equal(ok.isAncestor, true);
  assert.deepEqual(ok.changedFiles, [".github/autonomy.json"]);
  assert.deepEqual(resolveDeploySha({ expectedSha: base, ...ok }), {
    sha: base,
    path: "ancestor",
  });

  const workerFile = path.join(WORKER_DIR, "w.txt");
  writeFileSync(path.join(dir, workerFile), "changed\n");
  git("add", workerFile);
  git("commit", "-qm", "worker");
  const blocked = inspectGit({
    expectedSha: base,
    mainRef: "main",
    cwd: dir,
  });
  assert.equal(blocked.isAncestor, true);
  assert.throws(
    () => resolveDeploySha({ expectedSha: base, ...blocked }),
    new RegExp(`${WORKER_DIR}w\\.txt`.replaceAll("/", "\\/"))
  );
});
