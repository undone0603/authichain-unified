// Safety regression for the three additional observed workflow files.
// Native Node 22, no network, no dependencies, no GitHub credentials.
import test from "node:test";
import assert from "node:assert/strict";
import {
  loadManifest, listWorkflowFiles, validateManifest, planReconcile,
} from "./reconcile.mjs";

const deployments = [
  "deploy-authichain-edge-router.yml",
  "deploy-qron-space.yml",
];

test("the checked-out workflow directory is classified exactly once", () => {
  const manifest = loadManifest();
  const files = listWorkflowFiles();
  const errs = validateManifest(manifest, files);
  assert.deepEqual(errs, [], errs.join("; "));
});

test("both existing production publish workflows are operator-held", () => {
  const m = loadManifest();
  for (const file of deployments) {
    assert.equal(m.lanes.ship.workflows[file], "on");
    assert.ok(m.operator_hold.workflows.includes(file), `${file} must not be toggled automatically`);
  }
  assert.equal(m.lanes.manual.workflows["wsl-net-check.yml"], "manual");
  assert.equal(m.lanes.manual.managed, false);
});

test("reconcile neither enables nor disables protected deploy workflows", () => {
  const m = loadManifest();
  const remote = [
    { id: 101, path: ".github/workflows/deploy-authichain-edge-router.yml", state: "disabled_manually" },
    { id: 102, path: ".github/workflows/deploy-qron-space.yml", state: "active" },
    { id: 103, path: ".github/workflows/wsl-net-check.yml", state: "disabled_manually" },
  ];
  const result = planReconcile(m, remote);
  assert.deepEqual(result.changes, []);
  assert.deepEqual(result.unknownRemote, []);
});

test("outbound and payment guardrails remain operator-held or disabled", () => {
  const m = loadManifest();
  assert.equal(m.cold_outreach.enabled, false);
  for (const filename of [
    "b2b-outreach.yml", "content-publish.yml", "gov-mint.yml",
    "marketing-autonomous.yml", "pipeline-tick.yml",
  ]) {
    assert.ok(m.operator_hold.workflows.includes(filename));
  }
});
