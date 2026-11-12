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

test("both jobs run on the self-hosted WSL runner with IPv4 NODE_OPTIONS", () => {
  assert.match(
    yml,
    /runs-on: \[self-hosted, Linux, ARM64, authichain-wsl\]/
  );
  assert.equal(
    (yml.match(/runs-on: \[self-hosted, Linux, ARM64, authichain-wsl\]/g) || []).length,
    2
  );
  assert.doesNotMatch(yml, /runs-on: ubuntu-24\.04/);
  assert.match(
    yml,
    /NODE_OPTIONS: "--dns-result-order=ipv4first --no-network-family-autoselection"/
  );
});

test("shared self-hosted workspace is restored to a full tree after every checkout", () => {
  const titles = yml.match(/- name: Restore full tree after sparse checkout/g) || [];
  assert.equal(titles.length, 2, "verify and deploy jobs must each restore the tree");
  const first = yml.indexOf("- name: Restore full tree after sparse checkout");
  const second = yml.indexOf("- name: Restore full tree after sparse checkout", first + 1);
  const checkouts = [];
  let from = 0;
  while (true) {
    const at = yml.indexOf("uses: actions/checkout@v4", from);
    if (at === -1) break;
    checkouts.push(at);
    from = at + 1;
  }
  assert.equal(checkouts.length, 2);
  assert.ok(checkouts[0] < first && first < checkouts[1], "first restore follows the verify checkout");
  assert.ok(checkouts[1] < second, "second restore follows the deploy checkout");
  assert.ok(first < yml.indexOf("- name: Test fail-closed automated release policy"));
  assert.ok(second < yml.indexOf("- name: Confirm checked-out and current main SHA"));
  assert.ok(second < yml.indexOf("- name: Install pinned dependencies"));

  const verifyRestore = step("Restore full tree after sparse checkout");
  const deployRestore = yml.slice(second, yml.indexOf("- name: Confirm checked-out and current main SHA"));
  for (const block of [verifyRestore, deployRestore]) {
    assert.match(block, /if: runner\.environment == 'self-hosted'/);
    assert.match(block, /set -euo pipefail/);
    const disable = block.indexOf("git sparse-checkout disable");
    const reset = block.indexOf("git reset --hard HEAD");
    assert.ok(disable > -1 && reset > disable, "disable sparse first, then materialize with reset --hard");
    assert.match(block, /test "\$\(git rev-parse HEAD\)" = "/);
    assert.match(block, /git ls-files -v \| awk '\$1 == "S"/);
    assert.match(block, /test -f scripts\/ci\/autonomous-release-gate\.test\.mjs/);
    assert.match(block, /test -f scripts\/ci\/autonomous-release-gate\.mjs/);
    assert.match(block, /test -f scripts\/ci\/parse-wrangler-version-id\.mjs/);
    assert.match(block, /test -f scripts\/ci\/promote-worker-version\.mjs/);
    assert.match(block, /test -f workers\/authichain-com\/wrangler\.toml/);
    assert.doesNotMatch(block, /\|\| true/);
  }
  assert.match(verifyRestore, /steps\.head\.outputs\.sha/);
  assert.match(deployRestore, /needs\.verify\.outputs\.sha/);
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

