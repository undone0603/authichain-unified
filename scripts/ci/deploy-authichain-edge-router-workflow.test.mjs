import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const yml = readFileSync(
  path.join(ROOT, ".github/workflows/deploy-authichain-edge-router.yml"),
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
  const publish = step("Publish authichain-edge-router");
  assert.match(publish, /wrangler@4\.149\.0 versions upload --minify --keep-vars --dry-run --outdir/);
  assert.match(publish, /upload-worker-version\.mjs authichain-edge-router/);
  assert.match(publish, /promote-worker-version\.mjs authichain-edge-router/);
  assert.doesNotMatch(publish, /parse-wrangler-version-id\.mjs/);
  // Every successful promotion must leave a traceable GitHub-run/source/version record.
  assert.match(publish, /promotion=\$\(node .*promote-worker-version/);
  assert.match(publish, /GITHUB_SHA/);
  assert.match(publish, /GITHUB_RUN_ID/);
  assert.match(publish, /GITHUB_RUN_ATTEMPT/);
  assert.match(publish, /GITHUB_STEP_SUMMARY/);
  assert.match(publish, /Worker version:/);
  assert.doesNotMatch(publish, /npx wrangler deploy /);
  assert.doesNotMatch(yml, /secret put AUTHICHAIN_ATTESTATION_PRIVATE_KEY/);
  assert.doesNotMatch(yml, /secret put AUTHICHAIN_ATTESTATION_KEY_ID/);
  assert.doesNotMatch(yml, /secret put AUTHICHAIN_ATTESTATION_PUBLIC_JWK/);
  assert.doesNotMatch(yml, /secret put AUTHICHAIN_ATTESTATION_RETIRED/);
});

test("job keeps WSL IPv4 NODE_OPTIONS and does not cancel in-flight publishes", () => {
  assert.match(
    yml,
    /NODE_OPTIONS: "--dns-result-order=ipv4first --no-network-family-autoselection"/
  );
  assert.match(yml, /^\s+cancel-in-progress: false\s*$/m);
  assert.doesNotMatch(yml, /^\s+cancel-in-progress:\s*true/m);
});

test("smoke expects current jWTo5QsZ kid and retired T3AL7c4w kid", () => {
  const smoke = step("Smoke JWKS current + retired kids");
  assert.match(smoke, /jWTo5QsZfTVi2oQqsfq9E-aSB2XZ0vrXmfE3h0amEDM/);
  assert.match(smoke, /T3AL7c4wZVoXk1IXvpaaHGUmoZHZ3k1mTommJu9wToQ/);
  assert.match(smoke, /protocol\/jwks\.json/);
  assert.match(smoke, /protocol\/issuer\.json/);
});
