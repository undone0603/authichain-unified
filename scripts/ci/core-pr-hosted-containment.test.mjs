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
  const agent = file("agentz-ci");
  const worker = file("build-workers");
  const agentOps = agent.split("\n").find(
    line => line.includes("runs-on:") && line.includes("authichain-ops")
  );
  assert.ok(agentOps);
  assert.ok(agentOps.includes("github.event_name == 'push'"));
  assert.ok(agentOps.includes("ubuntu-24.04"));
  const workerRoute = worker.split("\n").find(line => line.includes("runs-on:"));
  assert.ok(workerRoute.includes("ubuntu-24.04"));
  assert.ok(!agent.includes("secrets.CLOUDFLARE_"));
  assert.ok(!worker.includes("secrets.CLOUDFLARE_"));
  assert.ok(agent.includes("tinyfish-offline:"));
});
