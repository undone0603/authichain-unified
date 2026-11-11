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

test("uplink gate is a configurable floor sized to the measured link, not 200 KB/s", () => {
  const probe = step("Preflight uplink probe");
  assert.match(probe, /MIN_UPLINK_BYTES_PER_SEC: "80000"/);
  assert.match(probe, /-lt "\$\{MIN_UPLINK_BYTES_PER_SEC\}"/);
  assert.doesNotMatch(probe, /-lt 200000/);
  // A bundle at the floor must still upload well inside the script's 600 s ceiling.
  const floor = Number(probe.match(/MIN_UPLINK_BYTES_PER_SEC: "(\d+)"/)[1]);
  assert.ok(floor >= 20_000 && 9_300_000 / floor < 600, "floor must allow an 8.8 MiB upload in under 600 s");
  assert.ok(floor <= 11_000 * 10, "floor must stay well above the 7-11 KB/s stall speeds");
});

test("rollback target is recorded before publish and fails closed", () => {
  const record = step("Record live version (rollback target)");
  assert.match(record, /set -euo pipefail/);
  assert.match(record, /live-worker-version\.mjs authichain-edge-router/);
  assert.match(record, /PREV_VERSION_ID=\$\{prev\}" >> "\$GITHUB_ENV"/);
  assert.doesNotMatch(record, /\|\| true/);
  assert.ok(
    yml.indexOf("- name: Record live version") < yml.indexOf("- name: Publish authichain-edge-router"),
    "live version must be recorded before anything is uploaded"
  );
});

test("publish marks the promoted version only after promotion succeeds", () => {
  const publish = step("Publish authichain-edge-router");
  const promoteAt = publish.indexOf("promotion=$(node");
  const markAt = publish.indexOf('PROMOTED_VERSION_ID=${vid}');
  assert.ok(promoteAt > -1 && markAt > promoteAt, "marker must follow the promote call");
});

test("smoke retries before declaring failure, with no pipe into grep -q", () => {
  const smoke = step("Smoke JWKS current + retired kids");
  assert.match(smoke, /set -euo pipefail/);
  assert.match(smoke, /for attempt in 1 2 3 4 5; do/);
  assert.match(smoke, /JWKS\/issuer smoke failed after 5 attempts/);
  assert.doesNotMatch(smoke, /\| grep/);
  assert.doesNotMatch(smoke, /\|\| true/);
});

test("failed smoke after promotion restores the previous version via the API promote path", () => {
  const rollback = step("Roll back to previous version");
  assert.match(
    rollback,
    /if: failure\(\) && env\.PROMOTED_VERSION_ID != '' && env\.PREV_VERSION_ID != ''/
  );
  assert.match(rollback, /promote-worker-version\.mjs authichain-edge-router "\$\{PREV_VERSION_ID\}"/);
  assert.match(rollback, /CLOUDFLARE_API_TOKEN: \$\{\{ secrets\.CLOUDFLARE_API_TOKEN \}\}/);
  assert.match(rollback, /CLOUDFLARE_ACCOUNT_ID: \$\{\{ secrets\.CLOUDFLARE_ACCOUNT_ID \}\}/);
  assert.doesNotMatch(rollback, /\|\| true/);
  assert.doesNotMatch(rollback, /wrangler/);
  // Last step: it must see the smoke result and nothing may run after it.
  assert.ok(
    yml.indexOf("- name: Roll back to previous version") >
      yml.indexOf("- name: Smoke JWKS current + retired kids")
  );
  assert.equal(yml.match(/\n      - name: /g).length, yml.slice(0, yml.indexOf("- name: Roll back")).match(/\n      - name: /g).length + 1);
});

test("shared self-hosted workspace is restored to a full tree before anything runs", () => {
  const restore = step("Restore full tree after sparse checkout");
  assert.match(restore, /if: runner\.environment == 'self-hosted'/);
  assert.match(restore, /set -euo pipefail/);
  const disable = restore.indexOf("git sparse-checkout disable");
  const reset = restore.indexOf("git reset --hard HEAD");
  assert.ok(disable > -1 && reset > disable, "disable sparse first, then materialize with reset --hard");
  assert.match(restore, /test "\$\(git rev-parse HEAD\)" = "\$\{GITHUB_SHA\}"/);
  assert.match(restore, /git ls-files -v \| awk '\$1 == "S"/);
  // Every file this job executes or bundles from must be present on disk.
  assert.match(restore, /test -f scripts\/ci\/live-worker-version\.mjs/);
  assert.match(restore, /test -f scripts\/ci\/upload-worker-version\.mjs/);
  assert.match(restore, /test -f scripts\/ci\/promote-worker-version\.mjs/);
  assert.match(restore, /test -f worker-app\/wrangler\.toml/);
  assert.doesNotMatch(restore, /\|\| true/);
  const at = name => yml.indexOf(`- name: ${name}`);
  assert.ok(yml.indexOf("uses: actions/checkout@v7") < at("Restore full tree after sparse checkout"));
  assert.ok(at("Restore full tree after sparse checkout") < at("Install node-gyp (native builds)"));
  assert.ok(at("Restore full tree after sparse checkout") < at("Install\n"), "restore must precede pnpm install");
  assert.ok(at("Restore full tree after sparse checkout") < at("Record live version (rollback target)"));
});

test("public pages are smoke-tested after promotion and before any rollback decision", () => {
  const pages = step("Smoke public pages");
  assert.match(pages, /set -euo pipefail/);
  for (const url of [
    "https://authichain.com/ ",
    "https://authichain.com/pricing ",
    "https://qron.space/ ",
    "https://strainchain.io/ ",
    "https://govchain.us/opportunities;",
  ]) {
    assert.ok(pages.includes(url), `smoke must cover ${url.trim()}`);
  }
  assert.match(pages, /api\/health/);
  assert.match(pages, /"status":"ok"/);
  assert.match(pages, /for attempt in 1 2 3 4 5; do/);
  assert.match(pages, /public page smoke failed after 5 attempts/);
  assert.doesNotMatch(pages, /\| grep/);
  assert.doesNotMatch(pages, /\|\| true/);
  const at = name => yml.indexOf(`- name: ${name}`);
  assert.ok(at("Smoke JWKS current + retired kids") < at("Smoke public pages"));
  assert.ok(at("Smoke public pages") < at("Roll back to previous version"));
});

test("runner pnpm is checked only after setup-node has put node on PATH", () => {
  const at = name => yml.indexOf(`- name: ${name}`);
  const setupNode = yml.indexOf("uses: actions/setup-node@v7");
  const runnerPnpm = at("Use runner pnpm (self-hosted)");
  assert.ok(setupNode > -1 && runnerPnpm > -1, "both steps must exist");
  assert.ok(
    setupNode < runnerPnpm,
    "pnpm is a corepack shim with an env-node shebang; the listener PATH may have no node",
  );
  assert.ok(runnerPnpm < at("Install node-gyp (native builds)"));
  assert.ok(runnerPnpm < at("Install\n"), "version check must precede pnpm install");
  const s = step("Use runner pnpm (self-hosted)");
  assert.match(s, /if: runner\.environment == 'self-hosted'/);
  assert.match(s, /set -euo pipefail/);
  assert.match(s, /command -v node/);
  assert.match(s, /command -v pnpm/);
  assert.match(s, /pnpm --version/);
  // Nothing that needs node may run before setup-node (comments excluded).
  const before = yml.slice(0, setupNode).replace(/#.*$/gm, "");
  assert.doesNotMatch(before, /pnpm --version|\bnode scripts\/|\bnpm /);
});