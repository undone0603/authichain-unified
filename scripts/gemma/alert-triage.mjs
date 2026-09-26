#!/usr/bin/env node
// scripts/gemma/alert-triage.mjs
//
// Hourly, after ops-pulse: when an `ops-alert` issue is open, Gemma reads the
// log tail of each recently failed main-branch run and comments a plain-English
// diagnosis and suggested fix on that issue, once per run. It changes nothing.

import { loadManifest } from "../autonomy/reconcile.mjs";
import { FOOTER, chat, clip, config, gh, say } from "./lib.mjs";

export const MAX_RUNS = 3;
export const WINDOW_HOURS = 24;

export const SYSTEM = [
  "You triage failed GitHub Actions runs for a small team.",
  "From the log tail, say in plain English what failed and the most likely root cause,",
  "whether it is code, configuration, a missing or expired secret, or an outside service,",
  "and the smallest fix. Never print secrets or tokens even if they appear in the log.",
  "If the log does not show the cause, say so instead of guessing.",
].join(" ");

export function marker(runId) {
  return `<!-- gemma-triage:${runId} -->`;
}

/** Newest failed run per workflow within the window, at most `max`. */
export function pickRuns(
  runs,
  { now = Date.now(), hours = WINDOW_HOURS, max = MAX_RUNS } = {}
) {
  const seen = new Set();
  const picked = [];
  for (const r of runs) {
    if (r.conclusion !== "failure") continue;
    if (now - Date.parse(r.created_at) > hours * 3_600_000) continue;
    if (seen.has(r.workflow_id)) continue;
    seen.add(r.workflow_id);
    picked.push(r);
    if (picked.length >= max) break;
  }
  return picked;
}

export function logTail(log, lines = 150, max = 6000) {
  const tail = String(log ?? "")
    .split("\n")
    .slice(-lines)
    .join("\n");
  return clip(tail, max);
}

export function buildPrompt(run, jobName, tail) {
  return [
    `Workflow: ${run.name}`,
    `Failed job: ${jobName}`,
    `Run: ${run.html_url}`,
    "",
    "Log tail:",
    "```",
    tail,
    "```",
  ].join("\n");
}

async function main() {
  const cfg = config();
  if (!cfg.token || !cfg.repo) {
    say("GITHUB_TOKEN and GITHUB_REPOSITORY are required.");
    return 2;
  }
  const label = loadManifest().alerts?.label ?? "ops-alert";
  const open = await gh(
    `/repos/${cfg.repo}/issues?state=open&labels=${encodeURIComponent(label)}&per_page=5`,
    { token: cfg.token }
  );
  const alert = open[0];
  if (!alert) {
    say("No open ops alert: nothing to triage.");
    return 0;
  }
  const { workflow_runs: runs = [] } = await gh(
    `/repos/${cfg.repo}/actions/runs?branch=main&status=completed&per_page=50`,
    { token: cfg.token }
  );
  const comments = await gh(
    `/repos/${cfg.repo}/issues/${alert.number}/comments?per_page=100`,
    { token: cfg.token }
  );
  const done = new Set(
    comments.map(c => c.body.match(/gemma-triage:(\d+)/)?.[1]).filter(Boolean)
  );
  for (const run of pickRuns(runs)) {
    if (done.has(String(run.id))) continue;
    try {
      const { jobs = [] } = await gh(
        `/repos/${cfg.repo}/actions/runs/${run.id}/jobs?per_page=50`,
        { token: cfg.token }
      );
      const job = jobs.find(j => j.conclusion === "failure") ?? jobs[0];
      if (!job) continue;
      const log = await gh(`/repos/${cfg.repo}/actions/jobs/${job.id}/logs`, {
        token: cfg.token,
        raw: true,
      });
      const answer = await chat({
        url: cfg.url,
        model: cfg.model,
        system: SYSTEM,
        user: buildPrompt(run, job.name, logTail(log)),
      });
      const body = `${marker(run.id)}\n**Gemma triage: ${run.name}** ([run](${run.html_url}))\n\n${answer}${FOOTER}`;
      if (cfg.dry) {
        say(body);
        continue;
      }
      await gh(`/repos/${cfg.repo}/issues/${alert.number}/comments`, {
        method: "POST",
        token: cfg.token,
        body: { body },
      });
      say(`triaged run ${run.id} on #${alert.number}`);
    } catch (e) {
      say(`could not triage run ${run.id}: ${e.message}`);
    }
  }
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(
    c => process.exit(c),
    e => {
      console.error(e);
      process.exit(1);
    }
  );
}
