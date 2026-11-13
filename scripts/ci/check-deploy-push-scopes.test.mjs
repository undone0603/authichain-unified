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
