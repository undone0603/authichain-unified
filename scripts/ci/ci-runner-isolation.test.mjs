import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const main = readFileSync(".github/workflows/main.yml", "utf8");
const extras = readFileSync(".github/workflows/ci.yml", "utf8");
const publisher = readFileSync(
  ".github/workflows/deploy-authichain-edge-router.yml", "utf8"
);

test("all five CI Main jobs use isolated authichain-ops, never the production publisher", () => {
  const expressions = [...main.matchAll(/runs-on: \${{([^\n]+)}}/g)].map(m => m[1]);
  assert.equal(expressions.length, 5);
  for (const exp of expressions) {
    assert.match(exp, /authichain-ops/);
    assert.doesNotMatch(exp, /authichain-wsl/);
    assert.match(exp, /github\.event\.pull_request\.head\.repo\.full_name == github\.repository/);
    assert.match(exp, /ubuntu-24\.04/);
  }
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
