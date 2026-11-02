import assert from "node:assert/strict";
import { test } from "node:test";
import {
  allPages,
  latestExactHeadRun,
  mainGateDecision,
  verifyOnce,
} from "./require-exact-head-main-gate.mjs";

const SHA = "a".repeat(40);
const goodRun = {
  id: 91,
  name: "CI Main",
  head_branch: "main",
  head_sha: SHA,
  event: "push",
  status: "completed",
  conclusion: "success",
};
const names = [
  "Typecheck and lint",
  "Tests (shard 1/2)",
  "Tests (shard 2/2)",
  "Production build",
  "Main quality gate",
];
const jobs = names.map((name, index) => ({
  id: index + 1,
  name,
  status: "completed",
  conclusion: "success",
}));

test("ignores stale, PR, and unrelated runs; chooses latest exact main SHA", () => {
  const chosen = latestExactHeadRun([
    { ...goodRun, id: 92, head_sha: "b".repeat(40) },
    { ...goodRun, id: 95, event: "pull_request" },
    { ...goodRun, id: 94, head_branch: "feature" },
    { ...goodRun, id: 93, status: "in_progress", conclusion: null },
    goodRun,
  ], SHA);
  assert.equal(chosen.id, 93);
  assert.equal(latestExactHeadRun([{ ...goodRun, head_sha: "b".repeat(40) }], SHA), null);
});

test("only completed exact-head green CI and all five jobs permit release", () => {
  assert.equal(mainGateDecision(goodRun, jobs, SHA).state, "ready");
  assert.equal(mainGateDecision(null, [], SHA).state, "pending");
  assert.equal(
    mainGateDecision({ ...goodRun, status: "in_progress" }, jobs, SHA).state,
    "pending"
  );
  assert.equal(
    mainGateDecision({ ...goodRun, conclusion: "failure" }, jobs, SHA).state,
    "blocked"
  );
  assert.equal(
    mainGateDecision({ ...goodRun, head_sha: "b".repeat(40) }, jobs, SHA).state,
    "blocked"
  );
});

test("skipped, missing, duplicate, or failed jobs cannot pass", () => {
  assert.equal(mainGateDecision(goodRun, jobs.slice(0, 4), SHA).state, "blocked");
  assert.equal(mainGateDecision(goodRun, [...jobs, jobs[4]], SHA).state, "blocked");
  assert.equal(mainGateDecision(
    goodRun,
    jobs.map(j => j.name === "Main quality gate" ? { ...j, conclusion: "skipped" } : j),
    SHA
  ).state, "blocked");
  assert.equal(mainGateDecision(
    goodRun,
    jobs.map(j => j.name === "Production build" ? { ...j, conclusion: "failure" } : j),
    SHA
  ).state, "blocked");
});

test("complete pagination retrieves all jobs beyond 100 records", async () => {
  const list = Array.from({ length: 105 }, (_, i) => ({ id: i }));
  const calls = [];
  const got = await allPages(async path => {
    calls.push(path);
    const page = Number(new URL(path, "https://api.github.com").searchParams.get("page"));
    return { total_count: list.length, jobs: list.slice((page - 1) * 100, page * 100) };
  }, "/repos/example/repo/actions/runs/91/jobs", "jobs");
  assert.equal(got.length, 105);
  assert.equal(calls.length, 2);
});

test("malformed or truncated pagination fails closed", async () => {
  await assert.rejects(
    allPages(async () => ({ jobs: [], total_count: 3 }), "/test", "jobs"),
    /incomplete pagination/
  );
  await assert.rejects(
    allPages(async () => ({ jobs: [], total_count: "3" }), "/test", "jobs"),
    /invalid paginated/
  );
});

test("latest exact-head failed run cannot reuse earlier green result", async () => {
  const decision = await verifyOnce({
    repo: "example/repo",
    sha: SHA,
    apiGet: async () => ({
      total_count: 2,
      workflow_runs: [
        { ...goodRun, id: 92, conclusion: "failure" },
        goodRun,
      ],
    }),
  });
  assert.equal(decision.state, "blocked");
});

test("full exact-head check is ready only with all terminal jobs", async () => {
  const calls = [];
  const decision = await verifyOnce({
    repo: "example/repo",
    sha: SHA,
    apiGet: async path => {
      calls.push(path);
      return path.includes("/jobs")
        ? { total_count: jobs.length, jobs }
        : { total_count: 1, workflow_runs: [goodRun] };
    },
  });
  assert.equal(decision.state, "ready");
  assert.equal(calls.length, 2);
  assert.match(calls[0], /head_sha=a{40}/);
  assert.match(calls[1], /actions\/runs\/91\/jobs/);
});
