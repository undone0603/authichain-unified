import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const workflow = readFileSync(".github/workflows/self-hosted-ops-smoke.yml", "utf8");

test("trusted ops smoke never runs unreviewed PR code", () => {
  assert.match(workflow, /workflow_dispatch:/);
  assert.doesNotMatch(workflow, /pull_request:/);
  assert.match(workflow, /github\.ref == 'refs\/heads\/main'/);
  assert.match(workflow, /operator_confirms_isolation == 'yes'/);
  assert.match(workflow, /default: "no"/);
  assert.match(workflow, /runs-on: \[self-hosted, Linux, ARM64, authichain-ops\]/);
  assert.doesNotMatch(workflow, /authichain-wsl/);
});

test("preflight refuses ambiguous SHA, root, leftover Git and ambient credentials", () => {
  for (const marker of [
    'test "$(id -u)" -ne 0',
    'test "$GITHUB_WORKSPACE" = "$RUNNER_WORKSPACE/authichain-unified"',
    'test ! -L "$GITHUB_WORKSPACE"',
    'test "${#EXPECTED_SHA}" -eq 40',
    'test "$EXPECTED_SHA" = "$GITHUB_SHA"',
    'test -L "$GITHUB_WORKSPACE/.git"',
    'if test -e "$GITHUB_WORKSPACE/.git"',
    "CLOUDFLARE_API_TOKEN",
    "STRIPE_SECRET_KEY",
  ]) assert.ok(workflow.includes(marker), marker);
  assert.doesNotMatch(workflow, /rm -rf|git reset --hard/);
});

test("checkout is exact SHA, no persisted credentials, with actual fsck and no PR code", () => {
  assert.match(workflow, /ref: \$\{\{ github\.sha \}\}/);
  assert.match(workflow, /persist-credentials: false/);
  assert.match(workflow, /fetch-depth: 1/);
  assert.match(workflow, /test "\$\(git rev-parse HEAD\)" = "\$EXPECTED_SHA"/);
  assert.match(workflow, /git cat-file -t "\$EXPECTED_SHA"/);
  assert.match(workflow, /git fsck --full --no-reflogs/);
  assert.match(workflow, /test -z "\$\(git status --porcelain\)"/);
  assert.match(workflow, /Independent host and credential isolation: requires separate operator evidence/);
});
