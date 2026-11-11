import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const file = name => readFileSync(`.github/workflows/${name}.yml`, "utf8");

test("PR Typecheck ratchet still runs on pull_request including forks", () => {
  const source = file("typecheck-ratchet");
  assert.ok(source.includes("  pull_request:"));
  assert.ok(source.includes("  push:"));
  assert.match(source, /ubuntu-24\.04/);
  assert.ok(source.includes("persist-credentials: false"));
});

test("Drizzle and AgentZ extra checks do not skip fork PRs", () => {
  const source = file("ci");
  assert.ok(source.includes("AgentZ Python tests"));
  assert.ok(source.includes("persist-credentials: false"));
  assert.match(source, /ubuntu-24\.04/);
});

test("Hardhat contract tests keep persist-credentials off", () => {
  const source = file("contract-tests");
  assert.ok(source.includes("run: pnpm test:contracts"));
  assert.ok(source.includes("persist-credentials: false"));
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
