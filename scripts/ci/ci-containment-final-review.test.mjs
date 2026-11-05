import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const workflow = name => readFileSync(`.github/workflows/${name}.yml`, "utf8");

test("trust-lab does not execute branch-push code on unverified ops runner", () => {
  const src = workflow("trust-lab");
  assert.match(src, /push:\n    branches: \[main\]/);
  assert.match(src, /github\.event_name != 'pull_request'/);
});

test("anonymous PR checks explicitly request read-only token permissions", () => {
  for (const name of ["trust-lab", "nightstamp-scan-gate"]) {
    assert.match(workflow(name), /\npermissions:\n  contents: read\n/);
  }
});

test("buyer signals PR syntax check does not persist checkout credentials", () => {
  const src = workflow("buyer-signals");
  const verify = src.split("  signals:\n")[0].split("  verify-pr:\n")[1];
  assert.ok(verify);
  assert.match(verify, /permissions:\n      contents: read/);
  assert.match(verify, /uses: actions\/checkout@v7\n        with:\n          persist-credentials: false/);
});

test("Dependabot auto-merge rejects prefix-spoofed bot accounts", () => {
  const src = workflow("automerge-dependabot");
  assert.ok(src.includes("author !== 'dependabot[bot]'"));
  assert.ok(!src.includes("startsWith('dependabot')"));
});

test("Dependabot auto-merge requires a completed successful named gate", () => {
  const src = workflow("automerge-dependabot");
  assert.ok(src.includes("c.name === 'Main quality gate'"));
  assert.ok(src.includes("checks.data.total_count > checkRuns.length"));
  assert.ok(src.includes("c.status === 'completed' && c.conclusion === 'success'"));
});

test("Dependabot merge must have independent current-head approval", () => {
  const src = workflow("automerge-dependabot");
  assert.ok(src.includes("r.state === 'APPROVED' && r.commit_id === ref"));
  assert.ok(src.includes("r.user?.type === 'User'"));
});

test("Dependabot merge is SHA-locked to validated PR head", () => {
  assert.ok(workflow("automerge-dependabot").includes("merge_method: 'squash', sha"));
});

test("duplicate Dependabot auto-merge is disabled until reviewed", () => {
  assert.match(workflow("dependabot-auto-merge"), /\n    if: \$\{\{ false \}\}/);
});

test("privileged CI repair listener verifies triggering repository identity", () => {
  const src = workflow("ci-repair-loop");
  assert.ok(src.includes("workflow_run.head_branch == 'main' && github.event.workflow_run.head_repository.full_name == github.repository"));
});

test("privileged merge-autopilot workflow is held pending verified independent approval", () => {
  const src = workflow("merge-autopilot");
  assert.ok(src.includes("\n  sweep:\n"));
  assert.match(src, /\n    if: \$\{\{ false \}\}/);
  assert.ok(src.includes("successful CI alone is not independent human approval"));
});

test("content PR creation and validation remain, while automatic merge is held", () => {
  const src = workflow("content-routine-pr");
  assert.ok(src.includes("- name: Run main quality gate on the routine branch"));
  assert.ok(src.includes("- name: Open pull request"));
  assert.match(src, /- name: Enable auto-merge for content-only changes\n(?:[^\n]*\n){0,5}        if: \$\{\{ false \}\}/);
});
