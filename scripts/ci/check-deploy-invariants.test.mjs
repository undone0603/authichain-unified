import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import {
  cancelInProgressTrueLines,
  checkCancelInProgress,
  checkCiGateWorkflows,
  checkWorkersDev,
  topLevelConcurrencyGroup,
  topLevelTomlValue,
  triggersOnPushToMain,
} from "./check-deploy-invariants.mjs";

function repo(files) {
  const root = mkdtempSync(path.join(tmpdir(), "deploy-inv-"));
  for (const [rel, text] of Object.entries(files)) {
    mkdirSync(path.dirname(path.join(root, rel)), { recursive: true });
    writeFileSync(path.join(root, rel), text);
  }
  return root;
}

const TARGET = [{ name: "w", file: "w/wrangler.toml" }];

test("topLevelTomlValue ignores keys inside [tables] and comments", () => {
  const text = 'name = "w" # c\n[env.dev]\nworkers_dev = true\n';
  assert.equal(topLevelTomlValue(text, "name"), '"w"');
  assert.equal(topLevelTomlValue(text, "workers_dev"), undefined);
});

test("workers_dev = false passes", () => {
  const root = repo({ "w/wrangler.toml": 'name = "w"\nworkers_dev = false\n' });
  assert.deepEqual(checkWorkersDev(root, TARGET), []);
});

test("workers_dev = true fails", () => {
  const root = repo({ "w/wrangler.toml": 'name = "w"\nworkers_dev = true\n' });
  assert.match(checkWorkersDev(root, TARGET)[0], /must be false/);
});

test("missing workers_dev fails (wrangler would pick a default)", () => {
  const root = repo({
    "w/wrangler.toml": 'name = "w"\n[vars]\nworkers_dev = false\n',
  });
  assert.match(checkWorkersDev(root, TARGET)[0], /missing/);
});

test("a commented-out workers_dev = false still fails", () => {
  const root = repo({
    "w/wrangler.toml": 'name = "w"\n# workers_dev = false\n',
  });
  assert.match(checkWorkersDev(root, TARGET)[0], /missing/);
});

test("a renamed Worker is reported, not silently passed", () => {
  const root = repo({
    "w/wrangler.toml": 'name = "other"\nworkers_dev = false\n',
  });
  assert.match(checkWorkersDev(root, TARGET)[0], /expected w/);
});

test("the real repo: both Workers have workers_dev = false", () => {
  assert.deepEqual(checkWorkersDev(), []);
});

const DEPLOY = (onBlock, cancel) => `name: d
on:
${onBlock}
concurrency:
  group: d-\${{ github.ref }}
  cancel-in-progress: ${cancel}
jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - run: npx wrangler deploy --config wrangler.toml
`;

test("push to main detection: inline, list and unfiltered forms", () => {
  assert.equal(
    triggersOnPushToMain(DEPLOY("  push:\n    branches: [main]", "true")),
    true
  );
  assert.equal(
    triggersOnPushToMain(
      DEPLOY("  push:\n    branches:\n      - main", "true")
    ),
    true
  );
  assert.equal(
    triggersOnPushToMain(DEPLOY("  push:\n  workflow_dispatch:", "true")),
    true
  );
  assert.equal(
    triggersOnPushToMain(DEPLOY("  push:\n    branches: [release]", "true")),
    false
  );
  assert.equal(
    triggersOnPushToMain(DEPLOY("  workflow_dispatch:", "true")),
    false
  );
});

test("literal cancel-in-progress: true on a push-to-main deploy fails", () => {
  const root = repo({
    ".github/workflows/d.yml": DEPLOY("  push:\n    branches: [main]", "true"),
  });
  const errors = checkCancelInProgress(root);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /d\.yml:7/);
});

test("the PR-only expression passes", () => {
  const root = repo({
    ".github/workflows/d.yml": DEPLOY(
      "  push:\n    branches: [main]",
      "${{ github.event_name == 'pull_request' }}"
    ),
  });
  assert.deepEqual(checkCancelInProgress(root), []);
});

test("non-deploy and non-main workflows are not checked", () => {
  const root = repo({
    ".github/workflows/ci.yml":
      "on:\n  push:\n    branches: [main]\nconcurrency:\n  cancel-in-progress: true\njobs: {}\n",
    ".github/workflows/rel.yml": DEPLOY(
      "  push:\n    branches: [release]",
      "true"
    ),
  });
  assert.deepEqual(checkCancelInProgress(root), []);
});

test("cancelInProgressTrueLines matches quoted true and trailing comments only", () => {
  const text =
    "a\n  cancel-in-progress: 'true' # x\n  cancel-in-progress: false\n";
  assert.deepEqual(cancelInProgressTrueLines(text), [2]);
});

// ─── CI gate workflows (CFA-123) ─────────────────────────────────────────────

const CI_OK = `name: CI Main
on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
concurrency:
  group: ci-main-\${{ github.event_name == 'push' && github.sha || github.head_ref || github.ref }}
  cancel-in-progress: \${{ github.event_name == 'pull_request' }}
jobs: {}
`;

test("CI gate: per-commit group on push + PR-only cancel passes", () => {
  const root = repo({ ".github/workflows/main.yml": CI_OK });
  assert.deepEqual(checkCiGateWorkflows(root, ["main.yml"]), []);
});

test("CI gate: shared main group fails (newer push cancels the pending run)", () => {
  const shared = CI_OK.replace(
    /group: .*/,
    "group: ci-main-${{ github.head_ref || github.ref }}"
  );
  const root = repo({ ".github/workflows/main.yml": shared });
  const errors = checkCiGateWorkflows(root, ["main.yml"]);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /per commit/);
});

test("CI gate: literal cancel-in-progress: true fails", () => {
  const bad = CI_OK.replace(
    /cancel-in-progress: .*/,
    "cancel-in-progress: true"
  );
  const root = repo({ ".github/workflows/main.yml": bad });
  const errors = checkCiGateWorkflows(root, ["main.yml"]);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /main\.yml:\d+: cancel-in-progress: true/);
});

test("CI gate: a listed workflow that is missing fails", () => {
  const root = repo({ "x.txt": "" });
  assert.match(checkCiGateWorkflows(root, ["main.yml"])[0], /missing/);
});

test("topLevelConcurrencyGroup reads block and inline forms", () => {
  assert.equal(
    topLevelConcurrencyGroup(
      "concurrency:\n  group: g-1\n  cancel-in-progress: false\n"
    ),
    "g-1"
  );
  assert.equal(topLevelConcurrencyGroup("concurrency: g-2\n"), "g-2");
  assert.equal(topLevelConcurrencyGroup("on: push\n"), null);
});
