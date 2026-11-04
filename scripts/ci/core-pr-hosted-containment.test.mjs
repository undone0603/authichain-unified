import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const file = name => readFileSync(`.github/workflows/${name}.yml`, "utf8");
const hostedOnPr = source =>
  source.split("\n").filter(line => line.includes("runs-on:")).every(
    line => !line.includes("authichain-wsl") ||
      (line.includes("github.event_name != 'pull_request'") && line.includes("ubuntu-24.04"))
  );

test("PR Typecheck ratchet runs on hosted runners, including forks", () => {
  const source = file("typecheck-ratchet");
  assert.ok(source.includes("  pull_request:"));
  assert.ok(source.includes("  push:"));
  assert.ok(hostedOnPr(source));
  assert.ok(!source.includes("if: ${{ github.event.pull_request.head.repo.full_name == github.repository }}"));
});

test("Drizzle and AgentZ extra checks do not skip fork PRs", () => {
  const source = file("ci");
  assert.ok(hostedOnPr(source));
  assert.ok(!source.includes("if: github.event.pull_request.head.repo.full_name == github.repository"));
  assert.ok(source.includes("AgentZ Python tests"));
});

test("Hardhat contract tests never checkout PR code on publisher", () => {
  const source = file("contract-tests");
  assert.ok(hostedOnPr(source));
  assert.ok(source.includes("run: pnpm test:contracts"));
});

test("AgentZ and Worker builds require attestation before ops host selection", () => {
  for (const name of ["agentz-ci", "build-workers"]) {
    const source = file(name);
    const route = source.split("\n").find(line => line.includes("runs-on:"));
    assert.ok(route.includes("github.event_name != 'pull_request'"));
    assert.ok(route.includes("vars.AUTHICHAIN_OPS_ISOLATION_ATTESTED == 'true'"));
    assert.ok(route.includes("ubuntu-24.04"));
    assert.ok(!source.includes("secrets.CLOUDFLARE_"), name);
  }
  const agent = file("agentz-ci");
  assert.ok(agent.includes('VENV="${RUNNER_TEMP:?}/agentz-venv"'));
  assert.ok(!agent.includes("/home/zac"));
});
