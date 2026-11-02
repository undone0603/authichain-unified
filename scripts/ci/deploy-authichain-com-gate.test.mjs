import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const path = fileURLToPath(
  new URL("../../.github/workflows/deploy-authichain-com.yml", import.meta.url)
);
const yml = readFileSync(path, "utf8");

test("authichain-com must check exact-head CI before any D1 or Worker write", () => {
  const guard = yml.indexOf("- name: Require exact-head CI Main gate");
  const d1 = yml.indexOf("- name: Apply D1 migrations");
  const worker = yml.indexOf("- name: Publish authichain-com");
  assert.ok(guard > 0 && guard < d1 && guard < worker);
  assert.match(yml, /\npermissions:\n  contents: read\n  actions: read/);
  assert.ok(yml.includes("run: node scripts/ci/require-exact-head-main-gate.mjs"));
  assert.ok(yml.includes("GITHUB_TOKEN: " + "$" + "{{ github.token }}"));
  const gateSection = yml.slice(guard, d1);
  assert.doesNotMatch(gateSection, /continue-on-error: true/);
});

test("authichain-com retains its production release and no-cancel restrictions", () => {
  assert.match(yml, /cancel-in-progress: false/);
  assert.match(yml, /runs-on: \[self-hosted, Linux, ARM64, authichain-wsl\]/);
  assert.match(yml, /wrangler d1 migrations apply authichain-db --remote/);
  assert.match(yml, /promote-worker-version\.mjs authichain-com/);
});
