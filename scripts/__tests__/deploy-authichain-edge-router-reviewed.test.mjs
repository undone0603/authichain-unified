import { readFileSync } from "node:fs";
import { strict as assert } from "node:assert";
import { test } from "node:test";

const path = new URL("../../.github/workflows/deploy-authichain-edge-router-reviewed.yml", import.meta.url);
const yaml = readFileSync(path, "utf8");

test("protected release is manual only and never runs on a main push", () => {
  assert.match(yaml, /^  workflow_dispatch:/m);
  assert.doesNotMatch(yaml, /^  push:/m);
  assert.match(yaml, /environment: production-cloudflare/);
  assert.match(yaml, /AUTHICHAIN_EDGE_DEPLOY_APPROVED/);
  assert.match(yaml, /deploy-authichain-edge-router'/);
});

test("exact main SHA and paginated quality gate are required before any deploy", () => {
  assert.match(yaml, /test "\$EXPECTED_SHA" = "\$GITHUB_SHA"/);
  assert.match(yaml, /git rev-parse origin\/main/);
  assert.match(yaml, /github\.paginate\(github\.rest\.checks\.listForRef/);
  assert.match(yaml, /uses: actions\/github-script@[0-9a-f]{40}/);
  assert.doesNotMatch(yaml, /uses: actions\/github-script@v[0-9]+/);

  assert.match(yaml, /Main quality gate/);
  assert.match(yaml, /latest\.conclusion !== 'success'/);
  assert.ok(yaml.indexOf("Require successful exact-head Main quality gate") < yaml.indexOf("Publish pinned authichain-edge-router only"));
});

test("release preserves webhook bindings and blocks unverified success", () => {
  assert.match(yaml, /--dry-run --minify --keep-vars --config wrangler\.toml/);
  assert.match(yaml, /wrangler deploy --minify --keep-vars --config wrangler\.toml/);
  assert.match(yaml, /scripts\/ci\/post-deploy-smoke\.mjs/);
  assert.doesNotMatch(yaml, /wrangler secret put|--admin|--force/);
  assert.doesNotMatch(yaml, /production_send\s*=\s*true/);
});
