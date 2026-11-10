import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const yml = readFileSync(
  path.join(ROOT, ".github/workflows/deploy-authichain-com.yml"),
  "utf8"
);

function step(title) {
  const start = yml.indexOf(`- name: ${title}`);
  assert.ok(start > -1, `missing step ${title}`);
  const rest = yml.slice(start);
  const next = rest.search(/\n      - name: /);
  return next === -1 ? rest : rest.slice(0, next);
}

test("Publish uses versions upload + API promote, not wrangler deploy", () => {
  const publish = step("Upload and promote this exact Worker version only");
  assert.match(publish, /wrangler@4\.149\.0 versions upload --minify --keep-vars/);
  assert.match(publish, /parse-wrangler-version-id\.mjs/);
  assert.match(publish, /promote-worker-version\.mjs authichain-com/);
  assert.doesNotMatch(publish, /npx wrangler deploy /);
  assert.doesNotMatch(publish, /secret put /);
  assert.doesNotMatch(yml, /secret put AUTHICHAIN_ATTESTATION_PRIVATE_KEY/);
});

test("publish job runs on hosted ubuntu-24.04", () => {
  assert.match(yml, /runs-on: ubuntu-24\.04/);
  assert.doesNotMatch(yml, /NODE_OPTIONS:/);
});

test("x402 secrets stay pinned and this publish does not re-put them", () => {
  assert.match(yml, /--keep-vars/);
  assert.match(yml, /must not re-put these secrets/);
  assert.doesNotMatch(yml, /secret put X402_PAY_TO/);
  assert.doesNotMatch(yml, /secret put X402_FACILITATOR_URL/);
  assert.doesNotMatch(yml, /secret put X402_USDC_ASSET/);
  assert.doesNotMatch(yml, /secret put X402_PAY_TO --name authichain-edge-router/);
});

test("authichain-com package.json is valid JSON with one test script", () => {
  const pkgPath = path.join(ROOT, "workers/authichain-com/package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  assert.equal(pkg.name, "authichain-com-worker");
  assert.equal(typeof pkg.scripts.test, "string");
  assert.match(pkg.scripts.test, /generation-check\.test\.ts/);
  assert.match(pkg.scripts.test, /email-optin\.test\.ts/);
  assert.match(pkg.scripts.test, /bot-identity-routes\.test\.ts/);
});

test("agent-verify exports coerceSealBody and listedSealId for the worker bundle", () => {
  const src = readFileSync(path.join(ROOT, "src/lib/agent-verify.ts"), "utf8");
  assert.match(src, /export function coerceSealBody/);
  assert.match(src, /export function listedSealId/);
  const routes = readFileSync(
    path.join(ROOT, "workers/authichain-com/src/x402-routes.ts"),
    "utf8"
  );
  assert.match(routes, /from "\.\.\/\.\.\/\.\.\/src\/lib\/agent-verify"/);
  assert.match(routes, /from "\.\.\/\.\.\/\.\.\/src\/lib\/paid-seal-verify"/);
});

