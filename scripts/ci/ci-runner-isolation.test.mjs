import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const main = readFileSync(".github/workflows/main.yml", "utf8");
const extras = readFileSync(".github/workflows/ci.yml", "utf8");
const publisher = readFileSync(
  ".github/workflows/deploy-authichain-edge-router.yml", "utf8"
);

test("all four required CI validation jobs use isolated authichain-ops", () => {
  const expressions = [...main.matchAll(/runs-on: \$\{\{([^\n]+)\}\}/g)].map(
    match => match[1]
  );
  assert.equal(expressions.length, 4);
  for (const exp of expressions) {
    assert.match(exp, /authichain-ops/);
    assert.doesNotMatch(exp, /authichain-wsl/);
    assert.match(exp, /head\.repo\.full_name == github\.repository/);
    assert.match(exp, /ubuntu-24\.04/);
  }
  const productionProof = main.slice(main.indexOf("  production-proof:"));
  assert.match(productionProof, /runs-on: \[self-hosted, Linux, ARM64, authichain-wsl\]/);
  assert.match(productionProof, /if: github\.event_name == 'push'/);
  assert.match(productionProof, /\[pipeline-proof\]/);
});

test("CI extras remain isolated while fork pull requests retain hosted runner", () => {
  assert.doesNotMatch(extras, /authichain-wsl/);
  assert.match(extras, /runs-on: .+authichain-ops.+ubuntu-24\.04/);
  assert.match(extras, /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/);
});

test("production publishing runner remains dedicated and is not changed by CI fix", () => {
  assert.match(publisher, /runs-on: \[self-hosted, Linux, ARM64, authichain-wsl\]/);
  assert.match(publisher, /cancel-in-progress: false/);
});

test("CI Main still requires real parallel test shards and an aggregate gate", () => {
  for (const required of [
    "Typecheck and lint",
    "Tests (shard \${{ matrix.shard }}/2)",
    "Production build",
    "Main quality gate",
  ]) {
    assert.ok(main.includes(required), `missing gate: ${required}`);
  }
  assert.match(main, /needs: \[quality, test, build\]/);
  assert.match(main, /if: \${{ !cancelled\(\) }}/);
});

const auxiliaryPrWorkflows = {
  "security-scan.yml": 1,
  "honest-launch-gate.yml": 1,
  "schema-drift.yml": 1,
  "windows-path-safety.yml": 1,
  "supabase-baseline.yml": 2,
  "compliance-audit.yml": 1,
  "vercel-deploy-guard.yml": 1,
  "nightstamp-scan-gate.yml": 1,
};

test("all nine auxiliary PR checks leave production publisher isolated", () => {
  for (const [name, jobCount] of Object.entries(auxiliaryPrWorkflows)) {
    const content = readFileSync(`.github/workflows/${name}`, "utf8");
    assert.match(content, /pull_request:/);
    const routes = content.split("\n").filter(line => line.trim().startsWith("runs-on:"));
    assert.equal(routes.length, jobCount, name);
    for (const route of routes) {
      assert.match(route, /github\.event_name == 'pull_request'/);
      assert.match(route, /authichain-ops/);
      assert.match(route, /head\.repo\.full_name == github\.repository/);
      assert.match(route, /ubuntu-24\.04/);
      // The existing production host remains assigned only to non-PR events.
      assert.match(route, /\|\| fromJSON\('\["self-hosted","Linux","ARM64","authichain-wsl"\]'\)/);
    }
  }
});

test("auxiliary routing is PR-only and retains existing push/schedule behavior", () => {
  for (const name of Object.keys(auxiliaryPrWorkflows)) {
    const content = readFileSync(`.github/workflows/${name}`, "utf8");
    const routes = content.split("\n").filter(line => line.trim().startsWith("runs-on:"));
    for (const route of routes) {
      assert.ok(route.includes("github.event_name == 'pull_request' && ("));
      assert.ok(route.includes("|| 'ubuntu-24.04') || fromJSON("));
      assert.ok(route.includes('"authichain-wsl"'));
    }
  }
});

test("typecheck ratchet never routes PR or push checks to the production publisher", () => {
  const content = readFileSync(".github/workflows/typecheck-ratchet.yml", "utf8");
  const routes = content.split("\n").filter(line => line.trim().startsWith("runs-on:"));
  assert.equal(routes.length, 1);
  assert.match(routes[0], /authichain-ops/);
  assert.match(routes[0], /ubuntu-24\.04/);
  assert.doesNotMatch(routes[0], /authichain-wsl/);
});

test("typecheck ratchet covers main pushes and fork PRs without publisher routing", () => {
  const source = readFileSync(".github/workflows/typecheck-ratchet.yml", "utf8");
  assert.ok(source.includes("  push:"));
  assert.ok(source.includes("    branches: [main]"));
  assert.ok(source.includes("  pull_request:"));
  assert.ok(
    !source.includes(
      "    if: " + "$" + "{{ github.event.pull_request.head.repo.full_name == github.repository }}"
    )
  );
  const runner = source
    .split(String.fromCharCode(10))
    .find(line => line.trim().startsWith("runs-on:"));
  assert.ok(runner);
  assert.ok(runner.includes("github.event_name == 'pull_request'"));
  assert.ok(runner.includes("ubuntu-24.04"));
  assert.ok(!runner.includes("authichain-wsl"));
});

test("worker build PRs are credential-free and use hosted runners for forks", () => {
  const workflow = readFileSync(".github/workflows/build-workers.yml", "utf8");
  const script = readFileSync("scripts/ci/build-workers.mjs", "utf8");
  const runner = workflow
    .split(String.fromCharCode(10))
    .find(line => line.trim().startsWith("runs-on:"));
  assert.ok(runner);
  assert.ok(runner.includes("github.event_name != 'pull_request'"));
  assert.ok(runner.includes("head.repo.full_name == github.repository"));
  assert.ok(runner.includes("ubuntu-24.04"));
  assert.ok(runner.includes("authichain-ops"));
  assert.ok(!runner.includes("authichain-wsl"));
  assert.ok(!workflow.includes("secrets.CLOUDFLARE_"));
  assert.ok(!workflow.includes("Fork pull request has no Cloudflare token"));
  assert.ok(workflow.includes("Compile changed workers (no deploy credentials)"));
  assert.ok(script.includes('"deploy",'));
  assert.ok(script.includes('"--dry-run",'));
  assert.ok(script.includes('CLOUDFLARE_API_TOKEN: ""'));
  assert.ok(script.includes('CLOUDFLARE_ACCOUNT_ID: ""'));
});

test("isolated CI uses per-runner temp paths and hosted Hardhat coverage", () => {
  for (const path of [
    ".github/workflows/main.yml",
    ".github/workflows/ci.yml",
    ".github/workflows/lint.yml",
    ".github/workflows/typecheck-ratchet.yml",
    ".github/workflows/build-workers.yml",
  ]) {
    const source = readFileSync(path, "utf8");
    assert.ok(!source.includes("/home/zac"), path);
    assert.ok(source.includes("runner.temp"), path);
  }
  assert.ok(extras.includes("RUNNER_TEMP"));
  assert.ok(extras.includes("AGENTZ_VENV=$VENV_DIR"));
  const lint = readFileSync(".github/workflows/lint.yml", "utf8");
  assert.ok(lint.includes("if: runner.environment != 'self-hosted'"));
  assert.ok(lint.includes("if: runner.environment == 'self-hosted'"));
  assert.ok(!lint.includes("SKIP_HARDHAT_ON_SELF_HOSTED"));
  assert.ok(!main.includes("PLAYWRIGHT_BROWSERS_PATH:"));
  assert.ok(!main.includes("TURBO_CACHE_DIR:"));
});

test("Playwright steps key off the assigned runner, not a stale repository variable", () => {
  assert.ok(!main.includes("SKIP_PLAYWRIGHT_ON_SELF_HOSTED"));
  assert.ok(main.includes("runner.environment == 'self-hosted' && matrix.shard == 2"));
  assert.ok(main.includes("runner.environment != 'self-hosted' && matrix.shard == 2"));
  assert.ok(main.includes("HOME/.cache/ms-playwright"));
});

test("lint and autonomy checks fail closed on an incomplete checkout", () => {
  const lint = readFileSync(".github/workflows/lint.yml", "utf8");
  const autonomy = readFileSync(".github/workflows/autonomy-reconcile.yml", "utf8");
  assert.ok(lint.includes("git sparse-checkout disable"));
  assert.ok(lint.includes("test -f package.json"));
  assert.ok(lint.includes("test -f pnpm-lock.yaml"));
  assert.ok(lint.includes("run: pnpm lint:ci"));
  assert.ok(!lint.includes('pnpm run --dir'));
  assert.ok(autonomy.includes("test -f scripts/autonomy/reconcile.mjs"));
  assert.ok(autonomy.includes("test -f .github/autonomy.json"));
  assert.ok(autonomy.includes("node scripts/autonomy/reconcile.mjs --check"));
});

test("self-hosted PR preflight detects corrupted Git metadata without erasing evidence", () => {
  for (const file of [
    ".github/workflows/main.yml",
    ".github/workflows/ci.yml",
    ".github/workflows/lint.yml",
    ".github/workflows/typecheck-ratchet.yml",
    ".github/workflows/autonomy-reconcile.yml",
    ".github/workflows/contract-tests.yml",
  ]) {
    const source = readFileSync(file, "utf8");
    assert.ok(source.includes("Check stale Git metadata (read-only; fail closed)"), file);
    assert.ok(source.includes("git -C \"$GITHUB_WORKSPACE\" fsck --full --no-reflogs"), file);
    assert.ok(source.includes("rev-parse --verify 'ORIG_HEAD^{commit}'"), file);
    assert.ok(source.includes("GITHUB_WORKSPACE"), file);
    assert.ok(source.includes("RUNNER_WORKSPACE"), file);
    assert.ok(source.includes("test ! -L"), file);
    assert.ok(!source.includes('rm -rf -- "$GITHUB_WORKSPACE/.git"'), file);
    assert.ok(source.includes("github.event_name == 'pull_request'"), file);
  }
  const main = readFileSync(".github/workflows/main.yml", "utf8");
  assert.equal(main.split("Check stale Git metadata (read-only; fail closed)").length - 1, 3);
  const autonomy = readFileSync(".github/workflows/autonomy-reconcile.yml", "utf8");
  assert.equal(autonomy.split("Check stale Git metadata (read-only; fail closed)").length - 1, 1);
  assert.ok(main.slice(main.indexOf("  production-proof:")).includes("authichain-wsl"));
});
