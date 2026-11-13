import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { checkDirectDeployPushScopes } from "./check-deploy-invariants.mjs";

const safeCloudflare = [
  "name: Deploy to Cloudflare",
  "on:",
  "  push:",
  "    branches:",
  "      - main",
  "    paths:",
  '      - "workers/manufacturer-status/**"',
  "  workflow_dispatch:",
  "",
].join("\n");

const safeRevenue = safeCloudflare.replace(
  'workers/manufacturer-status/**', 'api/**'
);

function check(cloudflare = safeCloudflare, revenue = safeRevenue) {
  const root = mkdtempSync(path.join(os.tmpdir(), "deploy-scope-"));
  const dir = path.join(root, ".github", "workflows");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "deploy-cloudflare.yml"), cloudflare);
  writeFileSync(path.join(dir, "deploy-edge-worker.yml"), revenue);
  try {
    return checkDirectDeployPushScopes(root);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
}

test("only target source changes trigger a legacy direct push deploy", () => {
  assert.deepEqual(check(), []);
});

test("unfiltered push-to-main is rejected", () => {
  const unfiltered = safeCloudflare.replace(
    '    paths:\n      - "workers/manufacturer-status/**"\n', ""
  );
  assert.match(check(unfiltered).join(" "), /not path-restricted/);
});

test("docs or wildcard push trigger is rejected", () => {
  const broad = safeRevenue.replace('      - "api/**"', '      - "**"');
  assert.match(check(safeCloudflare, broad).join(" "), /paths must be exactly/);
});

test("workflow-only deployment trigger is rejected", () => {
  const broad = safeCloudflare.replace(
    '      - "workers/manufacturer-status/**"',
    '      - "workers/manufacturer-status/**"\n      - ".github/workflows/deploy-cloudflare.yml"'
  );
  assert.match(check(broad).join(" "), /paths must be exactly/);
});

test("manual-only workflow is permitted as fail-closed", () => {
  const manual = safeCloudflare.replace(
    '  push:\n    branches:\n      - main\n    paths:\n      - "workers/manufacturer-status/**"\n',
    ""
  );
  assert.deepEqual(check(manual), []);
});

test("inline on: push trigger cannot disguise a broad deployment", () => {
  const inline = safeCloudflare.replace(
    'on:\n  push:\n    branches:\n      - main\n    paths:\n      - "workers/manufacturer-status/**"\n  workflow_dispatch:',
    "on: [push, workflow_dispatch]"
  );
  assert.match(check(inline).join(" "), /unsupported inline/);
});

test("inline event map with unknown branches fails closed", () => {
  const inline = safeCloudflare.replace(
    '  push:\n    branches:\n      - main\n    paths:\n      - "workers/manufacturer-status/**"',
    "  push: { branches: ['*'], paths: ['**'] }"
  );
  assert.match(check(inline).join(" "), /only one explicit push/);
});

test("push trigger may only target main, never wildcard branches", () => {
  const broad = safeRevenue.replace("      - main", '      - "*"');
  assert.match(check(safeCloudflare, broad).join(" "), /branches must be exactly main/);
});

test("pull-request event cannot borrow production deploy secrets", () => {
  const broad = safeCloudflare.replace(
    "  workflow_dispatch:",
    "  pull_request:\n  workflow_dispatch:"
  );
  assert.match(check(broad).join(" "), /only one explicit push/);
});

test("extra push filters or duplicate push events are rejected", () => {
  const extraFilter = safeRevenue.replace(
    '      - "api/**"',
    '      - "api/**"\n    paths-ignore:\n      - "docs/**"'
  );
  assert.match(check(safeCloudflare, extraFilter).join(" "), /only branches and paths/);
  const duplicate = safeCloudflare.replace(
    "  workflow_dispatch:",
    "  push:\n    branches:\n      - main\n  workflow_dispatch:"
  );
  assert.match(check(duplicate).join(" "), /only one explicit push/);
});
