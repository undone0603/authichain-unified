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
  const publish = step("Publish authichain-com");
  assert.match(publish, /wrangler versions upload --minify --keep-vars/);
  assert.match(publish, /parse-wrangler-version-id\.mjs/);
  assert.match(publish, /promote-worker-version\.mjs authichain-com/);
  assert.doesNotMatch(publish, /npx wrangler deploy /);
  assert.doesNotMatch(yml, /secret put AUTHICHAIN_ATTESTATION_PRIVATE_KEY/);
});

test("job keeps WSL IPv4 NODE_OPTIONS", () => {
  assert.match(
    yml,
    /NODE_OPTIONS: "--dns-result-order=ipv4first --no-network-family-autoselection"/
  );
});

test("x402 bind stays on authichain-com and skips edge-router", () => {
  const bind = step("Bind X402_PAY_TO + X402_FACILITATOR_URL + X402_USDC_ASSET");
  assert.match(bind, /secret put X402_PAY_TO --name authichain-com/);
  assert.doesNotMatch(bind, /secret put X402_PAY_TO --name authichain-edge-router/);
});
