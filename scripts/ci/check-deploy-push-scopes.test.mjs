import test from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, mkdirSync, readFileSync, writeFileSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  checkDirectDeployPushScopes,
  DIRECT_DEPLOY_PUSH_SCOPES,
} from "./check-deploy-invariants.mjs";

const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

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
  '      - "workers/manufacturer-status/**"',
  '      - "api/**"\n      - "src/lib/plans.ts"'
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
    '      - "src/lib/plans.ts"',
    '      - "src/lib/plans.ts"\n    paths-ignore:\n      - "docs/**"'
  );
  assert.match(check(safeCloudflare, extraFilter).join(" "), /only branches and paths/);
  const duplicate = safeCloudflare.replace(
    "  workflow_dispatch:",
    "  push:\n    branches:\n      - main\n  workflow_dispatch:"
  );
  assert.match(check(duplicate).join(" "), /only one explicit push/);
});

test("a scope that drops one of its required paths is rejected", () => {
  const narrowed = safeRevenue.replace('      - "src/lib/plans.ts"\n', "");
  assert.match(check(safeCloudflare, narrowed).join(" "), /paths must be exactly/);
});

test("single-quoted push event key is normalized and cannot skip the path filter", () => {
  const quoted = [
    "name: Deploy to Cloudflare",
    "on:",
    "  'push':",
    "    branches:",
    "      - main",
    "  workflow_dispatch:",
    "",
  ].join("\n");
  const errors = check(quoted);
  assert.ok(errors.length > 0, "quoted unfiltered push must not be treated as manual-only");
  assert.match(errors.join(" "), /not path-restricted/);
});

test("double-quoted push event key is normalized and cannot skip the path filter", () => {
  const quoted = [
    "name: Deploy to Cloudflare",
    "on:",
    '  "push":',
    "    branches:",
    "      - main",
    "  workflow_dispatch:",
    "",
  ].join("\n");
  const errors = check(quoted);
  assert.ok(errors.length > 0, "quoted unfiltered push must not be treated as manual-only");
  assert.match(errors.join(" "), /not path-restricted/);
});

test("an unrecognized on: event-header shape fails closed", () => {
  const unknown = safeCloudflare.replace(
    "  push:",
    "  <<: *legacy-on"
  );
  const errors = check(unknown);
  assert.ok(errors.length > 0, "unknown event-header shape must error");
  assert.match(errors.join(" "), /unrecognized on: event-header shape/);
});

test("quoted path-restricted push still satisfies the scope", () => {
  const quoted = safeCloudflare
    .replace("  push:", "  'push':")
    .replace("  workflow_dispatch:", '  "workflow_dispatch":');
  assert.deepEqual(check(quoted), []);
});

test("the real workflows satisfy their declared scopes", () => {
  assert.deepEqual(checkDirectDeployPushScopes(REPO_ROOT), []);
});

// A path filter is only safe if it covers everything the Worker bundles.
// Walk each Worker's relative imports from its entry point and require every
// file reached to sit inside the declared scope, so a new import from outside
// the Worker's directory fails here instead of silently never redeploying.
function bundledFiles(entry) {
  const seen = new Set();
  const queue = [entry];
  const specifier = /(?:\bfrom\s*|\bimport\s*\(\s*|\bimport\s+)["'](\.{1,2}\/[^"']+)["']/g;
  while (queue.length > 0) {
    const rel = queue.pop();
    if (seen.has(rel)) continue;
    seen.add(rel);
    const source = readFileSync(path.join(REPO_ROOT, rel), "utf8");
    for (const [, spec] of source.matchAll(specifier)) {
      const base = path.posix.join(path.posix.dirname(rel), spec);
      const resolved = [
        base, base + ".ts", base + ".tsx", base + ".mjs", base + ".js",
        base + "/index.ts", base + "/index.js",
      ].find(candidate => /\.[a-z]+$/.test(candidate) &&
        existsSync(path.join(REPO_ROOT, candidate)));
      assert.ok(resolved, rel + " imports " + spec + ", which could not be resolved");
      queue.push(resolved);
    }
  }
  return [...seen];
}

function inScope(file, paths) {
  return paths.some(pattern => pattern.endsWith("/**")
    ? file.startsWith(pattern.slice(0, -2))
    : file === pattern);
}

test("each scope covers every file its Worker bundles", () => {
  for (const { workflow, entry, paths } of DIRECT_DEPLOY_PUSH_SCOPES) {
    const outside = bundledFiles(entry).filter(file => !inScope(file, paths));
    assert.deepEqual(outside, [], workflow + " would not redeploy for a change to: " + outside.join(", "));
  }
});
