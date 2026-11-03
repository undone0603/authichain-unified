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
