#!/usr/bin/env node
/**
 * Deploy drift: how far each production Worker is behind main.
 *
 * Every production publish now goes through a protected, manual-only workflow
 * pinned to an exact main commit, so the last successful run's head_sha is the
 * deployed source. (When deploy-authichain-com releases an allowlisted
 * ancestor instead, the commits in between touch no Worker source by
 * construction, so head_sha still gives the right drift.) A hand upload with
 * wrangler bypasses this and is not seen here.
 *
 * Drift = commits on main after that SHA that touch the Worker's source
 * paths, tests excluded. The path lists come from each Worker's relative
 * imports and are approximate: a change reached only transitively from
 * another directory is not counted.
 *
 * Read-only: `gh api` for workflow runs, `git log` for history.
 *
 *   node scripts/ops/deploy-drift.mjs [--json] [--fail-over <commits>]
 */
import { execFileSync } from "node:child_process";
import { pathToFileURL } from "node:url";

export const TARGETS = [
  {
    worker: "authichain-com",
    workflow: "deploy-authichain-com.yml",
    paths: [
      "workers/authichain-com/",
      "workers/authichain-verify-worker/",
      "workers/_shared/",
      "protocol/",
      "src/lib/",
      "worker-app/growth-record",
      "worker-app/route-manifest",
      "server.json",
    ],
  },
  {
    worker: "authichain-edge-router",
    workflow: "deploy-authichain-edge-router.yml",
    paths: [
      "worker-app/",
      "server/",
      "src/lib/",
      "src/app/",
      "shared/",
      "packages/verifier/",
      "workers/authichain-verify-worker/",
      "drizzle/",
    ],
  },
];

const TEST_FILE = /(^|\/)(__tests__|tests?)\/|\.(test|spec)\.[cm]?[jt]sx?$/;

/** Pure. True when a changed file is Worker source for this target. */
export function isWorkerSource(file, paths) {
  if (TEST_FILE.test(file)) return false;
  return paths.some(p => {
    if (p.endsWith("/")) return file.startsWith(p);
    if (file === p || file.startsWith(p + "/")) return true;
    // An extensionless import (worker-app/growth-record) names one file.
    if (!file.startsWith(p + ".")) return false;
    return !file.slice(p.length).includes("/");
  });
}

/**
 * Pure. commits: [{ sha, date, subject, files: string[] }] newest first, all
 * on main after the deployed SHA. Returns the ones that touch Worker source.
 */
export function driftCommits(commits, paths) {
  return commits
    .map(c => ({ ...c, files: c.files.filter(f => isWorkerSource(f, paths)) }))
    .filter(c => c.files.length > 0);
}

function sh(cmd, args) {
  return execFileSync(cmd, args, { encoding: "utf8", maxBuffer: 64 << 20 });
}

function lastSuccessfulDeploy(repo, workflow) {
  const out = sh("gh", [
    "api",
    `repos/${repo}/actions/workflows/${workflow}/runs?status=success&per_page=1`,
    "--jq",
    ".workflow_runs[0] | [.head_sha, .created_at, .html_url] | @tsv",
  ]).trim();
  if (!out) return null;
  const [sha, at, url] = out.split("\t");
  return { sha, at, url };
}

const SEP = "\u001e";

function commitsSince(sha, ref) {
  const out = sh("git", [
    "log",
    "--no-merges",
    `--format=${SEP}%h%x09%cs%x09%s`,
    "--name-only",
    `${sha}..${ref}`,
  ]);
  return out
    .split(SEP)
    .filter(Boolean)
    .map(block => {
      const [head, ...rest] = block.split("\n");
      const [short, date, subject] = head.split("\t");
      return {
        sha: short,
        date,
        subject,
        files: rest.map(s => s.trim()).filter(Boolean),
      };
    });
}

export function report({ repo, ref = "origin/main" } = {}) {
  return TARGETS.map(t => {
    const deployed = lastSuccessfulDeploy(repo, t.workflow);
    if (!deployed) return { ...t, deployed: null, behind: null, commits: [] };
    const commits = driftCommits(commitsSince(deployed.sha, ref), t.paths);
    return {
      worker: t.worker,
      workflow: t.workflow,
      deployed,
      behind: commits.length,
      commits,
    };
  });
}

function main(argv) {
  const repo = process.env.GITHUB_REPOSITORY || "undone0603/authichain-unified";
  const i = argv.indexOf("--fail-over");
  const failOver = i === -1 ? Infinity : Number(argv[i + 1]);
  const rows = report({ repo });
  if (argv.includes("--json")) {
    console.log(JSON.stringify(rows, null, 2));
  } else {
    for (const r of rows) {
      if (!r.deployed) {
        console.log(`${r.worker}: no successful run of ${r.workflow}`);
        continue;
      }
      console.log(
        `${r.worker}: deployed ${r.deployed.sha.slice(0, 8)} at ${r.deployed.at}, ${r.behind} source commit(s) behind main`
      );
      for (const c of r.commits)
        console.log(`  ${c.sha} ${c.date} ${c.subject}`);
    }
  }
  if (rows.some(r => r.deployed === null || r.behind > failOver))
    process.exitCode = 1;
}

if (
  process.argv[1] &&
  import.meta.url === pathToFileURL(process.argv[1]).href
) {
  main(process.argv.slice(2));
}
