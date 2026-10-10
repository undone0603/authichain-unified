import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";
import {
  cancelInProgressTrueLines,
  checkCancelInProgress,
  checkCiGateWorkflows,
  checkPreviewUrls,
  checkWorkersDev,
  PREVIEW_URLS_OFF,
  WORKERS_DEV_OFF,
  stripJsonc,
  topLevelConcurrencyGroup,
  topLevelTomlValue,
  triggersOnPushToMain,
} from "./check-deploy-invariants.mjs";

const REPO_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  ".."
);

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

const JTARGET = [{ name: "w", file: "w/wrangler.jsonc" }];

test("jsonc: \"workers_dev\": false passes, comments and trailing commas ok", () => {
  const root = repo({
    "w/wrangler.jsonc":
      '// c\n{\n  "name": "w", // x\n  /* "workers_dev": true */\n  "url": "https://a//b",\n  "workers_dev": false,\n}\n',
  });
  assert.deepEqual(checkWorkersDev(root, JTARGET), []);
});

test("jsonc: workers_dev true or missing fails", () => {
  const t = repo({ "w/wrangler.jsonc": '{ "name": "w", "workers_dev": true }' });
  assert.match(checkWorkersDev(t, JTARGET)[0], /must be false/);
  const m = repo({
    "w/wrangler.jsonc": '{ "name": "w", // "workers_dev": false\n "env": { "x": { "workers_dev": false } } }',
  });
  assert.match(checkWorkersDev(m, JTARGET)[0], /missing/);
});

test("stripJsonc keeps // inside strings", () => {
  assert.deepEqual(JSON.parse(stripJsonc('{"a":"x//y", // z\n}')), { a: "x//y" });
});

test("stripJsonc removes // line comments", () => {
  const text = '// head\n{\n  "a": 1, // tail\n  // "b": 2,\n  "c": 3\n}\n';
  assert.deepEqual(JSON.parse(stripJsonc(text)), { a: 1, c: 3 });
});

test("stripJsonc removes /* block */ comments, single- and multi-line", () => {
  const text =
    '/* head\n * more\n */{"a": /* inline */ 1,\n /* "b": 2,\n "c": 3, */ "d": 4}';
  assert.deepEqual(JSON.parse(stripJsonc(text)), { a: 1, d: 4 });
  // A block comment between tokens doesn't glue them together.
  assert.deepEqual(JSON.parse(stripJsonc('[1,/*x*/2]')), [1, 2]);
});

test("stripJsonc removes trailing commas in objects and arrays", () => {
  const text =
    '{\n  "a": [1, 2, ],\n  "b": { "c": true, },\n  "d": [ { "e": 1 }, ],\n}\n';
  assert.deepEqual(JSON.parse(stripJsonc(text)), {
    a: [1, 2],
    b: { c: true },
    d: [{ e: 1 }],
  });
});

test("stripJsonc removes trailing commas followed by comments", () => {
  const text = '{\n  "a": 1, // last\n  /* gone */\n}\n';
  assert.deepEqual(JSON.parse(stripJsonc(text)), { a: 1 });
});

test("stripJsonc keeps comment markers and ',}' inside strings", () => {
  const text = '{"a": "x/*y*/z", "b": "p,}q", "c": "r,]", "d": "e\\"//f",}';
  assert.deepEqual(JSON.parse(stripJsonc(text)), {
    a: "x/*y*/z",
    b: "p,}q",
    c: "r,]",
    d: 'e"//f',
  });
});

const PTARGET = [{ name: "w", file: "w/wrangler.jsonc" }];
const APP = (extra) =>
  `// app\n{\n  "name": "w",\n  "workers_dev": false,\n${extra}  "main": "x.ts", // trailing\n}\n`;

test("preview_urls: explicit false passes (with comments and trailing commas)", () => {
  const root = repo({
    "w/wrangler.jsonc": APP('  /* CFA-144 */ "preview_urls": false,\n'),
  });
  assert.deepEqual(checkPreviewUrls(root, PTARGET), []);
});

test("preview_urls: missing fails", () => {
  const root = repo({ "w/wrangler.jsonc": APP("") });
  const errors = checkPreviewUrls(root, PTARGET);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /preview_urls is missing/);
});

test("preview_urls: only commented out fails as missing", () => {
  const root = repo({
    "w/wrangler.jsonc": APP('  // "preview_urls": false,\n  /* "preview_urls": false, */\n'),
  });
  assert.match(checkPreviewUrls(root, PTARGET)[0], /preview_urls is missing/);
});

test("preview_urls: only inside env.* fails as missing", () => {
  const root = repo({
    "w/wrangler.jsonc": APP('  "env": { "dev": { "preview_urls": false } },\n'),
  });
  assert.match(checkPreviewUrls(root, PTARGET)[0], /preview_urls is missing/);
});

test("preview_urls: true (or non-boolean) fails", () => {
  const t = repo({ "w/wrangler.jsonc": APP('  "preview_urls": true,\n') });
  const errors = checkPreviewUrls(t, PTARGET);
  assert.equal(errors.length, 1);
  assert.match(errors[0], /preview_urls = true; must be false/);
  const s = repo({ "w/wrangler.jsonc": APP('  "preview_urls": "false",\n') });
  assert.match(checkPreviewUrls(s, PTARGET)[0], /must be false/);
});

test("authichain-app: the real wrangler.app.jsonc fails if preview_urls is removed or true", () => {
  const real = readFileSync(path.join(REPO_ROOT, "wrangler.app.jsonc"), "utf8");
  assert.match(real, /^\s*"preview_urls":\s*false,/m);
  const target = PREVIEW_URLS_OFF.filter(t => t.name === "authichain-app");
  assert.equal(target.length, 1);
  const removed = repo({
    "wrangler.app.jsonc": real.replace(/^\s*"preview_urls":\s*false,\n/m, ""),
  });
  assert.match(checkPreviewUrls(removed, target)[0], /authichain-app\): preview_urls is missing/);
  const on = repo({
    "wrangler.app.jsonc": real.replace(/"preview_urls":\s*false/, '"preview_urls": true'),
  });
  assert.match(checkPreviewUrls(on, target)[0], /authichain-app\): preview_urls = true; must be false/);
  // Unmodified copy passes.
  assert.deepEqual(checkPreviewUrls(repo({ "wrangler.app.jsonc": real }), target), []);
});

test("WORKERS_DEV_OFF covers dpp-fulfillment but not first-dollar-desk (CFA-153)", () => {
  const names = WORKERS_DEV_OFF.map(t => t.name);
  assert.ok(names.includes("dpp-fulfillment"));
  assert.ok(!names.includes("first-dollar-desk"));
  assert.equal(
    WORKERS_DEV_OFF.find(t => t.name === "dpp-fulfillment").file,
    "workers/dpp-fulfillment/wrangler.toml"
  );
});

test("the real repo: every PREVIEW_URLS_OFF Worker has preview_urls = false", () => {
  assert.deepEqual(checkPreviewUrls(), []);
});

test("the real repo: every WORKERS_DEV_OFF Worker has workers_dev = false", () => {
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
