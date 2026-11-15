import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  collectAuthichainComBundleInputs,
  inspectGit,
  isSafeAncestorChange,
  resolveDeploySha,
  SAFE_ANCESTOR_PATHS,
} from "./resolve-com-deploy-sha.mjs";

const EXPECTED = "a".repeat(40);
const MAIN = "b".repeat(40);
const WORKER_DIR = "workers/authichain-com/";
const WORKFLOW = ".github/workflows/deploy-authichain-com.yml";
const WORKER_ROOT = WORKER_DIR.replace(/\/$/, "");
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");

const SHIPPED_GAP_FILES = [
  "scripts/lib/evm-chains.ts",
  "content/dpp/regulatory-timeline.json",
  "content/strainchain/mendo-love-farms/certificates.json",
  "content/strainchain/gtr-seeds/certificates.json",
  "tsconfig.json",
];

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

test("ancestor with only allowlisted paths (autonomy.json, docs/) passes", () => {
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

test("ancestor fails when the Worker tree changed", () => {
  const touched = `${WORKER_DIR}src/index.ts`;
  assert.throws(
    () =>
      resolveDeploySha({
        expectedSha: EXPECTED,
        mainSha: MAIN,
        isAncestor: true,
        changedFiles: [touched],
      }),
    new RegExp(
      `paths outside the ancestor allowlist changed: ${touched.replaceAll("/", "\\/")}`
    )
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
      /paths outside the ancestor allowlist changed/
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

test("ancestor fails when shipped payment, claim, or tsconfig inputs changed", () => {
  for (const file of SHIPPED_GAP_FILES) {
    assert.throws(
      () =>
        resolveDeploySha({
          expectedSha: EXPECTED,
          mainSha: MAIN,
          isAncestor: true,
          changedFiles: [file],
        }),
      /paths outside the ancestor allowlist changed/
    );
  }
});

test("ancestor fails when allowlisted docs mix with a shipped file", () => {
  assert.throws(
    () =>
      resolveDeploySha({
        expectedSha: EXPECTED,
        mainSha: MAIN,
        isAncestor: true,
        changedFiles: [".github/autonomy.json", "scripts/lib/evm-chains.ts"],
      }),
    /scripts\/lib\/evm-chains\.ts/
  );
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

test("allowlist is exact prefix match, not a sibling-path hit", () => {
  assert.equal(isSafeAncestorChange(".github/autonomy.json"), true);
  assert.equal(isSafeAncestorChange("docs/NETWORK.md"), true);
  assert.equal(isSafeAncestorChange("docs"), true);
  assert.equal(isSafeAncestorChange("documentation/x.md"), false);
  assert.equal(isSafeAncestorChange(".github/autonomy.json.bak"), false);
  assert.equal(isSafeAncestorChange("apps/web/package.json"), false);
  assert.equal(isSafeAncestorChange("package.json"), false);
  assert.equal(isSafeAncestorChange(`${WORKER_ROOT}-extra/x.ts`), false);
  assert.equal(isSafeAncestorChange(WORKER_ROOT), false);
  assert.equal(SAFE_ANCESTOR_PATHS.length, 2);
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

test("every file the Worker ships is outside the ancestor allowlist", () => {
  const shipped = collectAuthichainComBundleInputs(ROOT);
  assert.ok(shipped.length >= 100, `bundle closure too small: ${shipped.length}`);
  assert.ok(shipped.includes(`${WORKER_DIR}src/index.ts`));
  assert.ok(shipped.includes(`${WORKER_DIR}wrangler.toml`));
  for (const file of SHIPPED_GAP_FILES) {
    assert.ok(shipped.includes(file), `missing shipped input ${file}`);
  }
  const leaked = shipped.filter(isSafeAncestorChange);
  assert.deepEqual(
    leaked,
    [],
    "allowlist overlaps the shipped Worker graph: " + leaked.join(", ")
  );
  for (const file of shipped) {
    assert.throws(
      () =>
        resolveDeploySha({
          expectedSha: EXPECTED,
          mainSha: MAIN,
          isAncestor: true,
          changedFiles: [file],
        }),
      /paths outside the ancestor allowlist changed/
    );
  }
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

test("git: expected_sha missing from the repo fails closed", () => {
  const { dir } = gitRepo();
  const missing = "c".repeat(40);
  assert.throws(
    () =>
      inspectGit({
        expectedSha: missing,
        mainRef: "main",
        cwd: dir,
      }),
    /git merge-base --is-ancestor failed/
  );
});
