#!/usr/bin/env node
/**
 * Fail-closed release guard for the canonical edge-router deployment.
 *
 * Require a completed, successful CI Main workflow run on the *exact* SHA
 * being published and five successful required jobs, with complete pagination.
 * No CI dispatch, cancellation, retry, promotion, or production write occurs.
 */
import { pathToFileURL } from "node:url";

const REQUIRED_JOBS = [
  "Typecheck and lint",
  "Tests (shard 1/2)",
  "Tests (shard 2/2)",
  "Production build",
  "Main quality gate",
];
const ALLOWED_EVENTS = new Set(["push", "workflow_dispatch"]);

export function latestExactHeadRun(runs, sha) {
  const matches = runs.filter(
    run =>
      run.name === "CI Main" &&
      run.head_sha === sha &&
      run.head_branch === "main" &&
      ALLOWED_EVENTS.has(run.event)
  );
  return matches.sort((a, b) => Number(b.id) - Number(a.id))[0] || null;
}

export function mainGateDecision(run, jobs, sha) {
  if (!run) return { state: "pending", reason: "no exact-head CI Main run" };
  if (run.head_sha !== sha || run.head_branch !== "main") {
    return { state: "blocked", reason: "CI Main SHA or branch mismatch" };
  }
  if (run.status !== "completed") {
    return { state: "pending", reason: "CI Main not completed" };
  }
  if (run.conclusion !== "success") {
    return { state: "blocked", reason: `CI Main concluded ${run.conclusion}` };
  }
  const failed = REQUIRED_JOBS.filter(name => {
    const matching = jobs.filter(job => job.name === name);
    return matching.length !== 1 ||
      matching[0].status !== "completed" ||
      matching[0].conclusion !== "success";
  });
  if (failed.length) {
    return { state: "blocked", reason: `missing/non-green jobs: ${failed.join(", ")}` };
  }
  return { state: "ready", reason: `exact-head CI Main run ${run.id} passed` };
}

export async function allPages(apiGet, path, key) {
  const all = [];
  for (let page = 1; page <= 50; page++) {
    const sep = path.includes("?") ? "&" : "?";
    const result = await apiGet(`${path}${sep}per_page=100&page=${page}`);
    if (!Array.isArray(result[key]) || !Number.isInteger(result.total_count)) {
      throw new Error(`invalid paginated GitHub response for ${key}`);
    }
    all.push(...result[key]);
    if (all.length >= result.total_count) return all;
    if (result[key].length === 0) {
      throw new Error(`incomplete pagination for ${key}`);
    }
  }
  throw new Error(`too many pages for ${key}; refusing incomplete gate`);
}

export async function verifyOnce({ repo, sha, apiGet }) {
  const runs = await allPages(
    apiGet,
    `/repos/${repo}/actions/workflows/main.yml/runs?head_sha=${sha}`,
    "workflow_runs"
  );
  const run = latestExactHeadRun(runs, sha);
  if (!run || run.status !== "completed" || run.conclusion !== "success") {
    return mainGateDecision(run, [], sha);
  }
  const jobs = await allPages(
    apiGet,
    `/repos/${repo}/actions/runs/${run.id}/jobs`,
    "jobs"
  );
  return mainGateDecision(run, jobs, sha);
}

async function githubGet(path, token) {
  const res = await fetch(`https://api.github.com${path}`, {
    headers: {
      Authorization: `Bearer ${token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`GitHub API HTTP ${res.status} for gate evidence`);
  return res.json();
}

async function main() {
  const sha = process.env.GITHUB_SHA;
  const repo = process.env.GITHUB_REPOSITORY;
  const token = process.env.GITHUB_TOKEN;
  if (
    process.env.GITHUB_REF !== "refs/heads/main" ||
    !/^[0-9a-f]{40}$/.test(sha || "") ||
    !/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repo || "") ||
    !token
  ) {
    throw new Error("main branch, valid source SHA, repository, and token required");
  }
  // Push and CI run concurrently. Wait at most 10 minutes, never fake green.
  for (let attempt = 0; attempt < 20; attempt++) {
    const result = await verifyOnce({
      repo,
      sha,
      apiGet: path => githubGet(path, token),
    });
    if (result.state === "ready") {
      console.log(result.reason);
      return;
    }
    if (result.state === "blocked") throw new Error(result.reason);
    console.log(`CI Main pending on ${sha.slice(0, 12)}: ${result.reason}`);
    if (attempt < 19) await new Promise(resolve => setTimeout(resolve, 30000));
  }
  throw new Error("exact-head Main quality gate not green within 10 minutes");
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch(error => {
    console.error(`::error::${error.message}`);
    process.exitCode = 1;
  });
}
