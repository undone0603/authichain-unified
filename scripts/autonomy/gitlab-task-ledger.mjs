#!/usr/bin/env node
// scripts/autonomy/gitlab-task-ledger.mjs
//
// Turns failed GitLab pipeline jobs into durable, deduplicated, bounded tasks.
//
//   failed job -> fingerprint -> one GitLab issue per fingerprint
//
// The issue is the task record: it survives a session ending, names the commit
// and pipeline, counts attempts, and says what to do next. State lives in a
// machine-readable marker inside the issue description, so a second run reads
// what the first run wrote and does not start over.
//
// Bounds, all enforced here and covered by tests:
//   - One issue per fingerprint. A rerun on the same pipeline changes nothing.
//   - A new failing pipeline adds one attempt. At maxAttempts the task is
//     labelled needs-founder, commented once, and then left alone.
//   - At most maxNewPerRun new issues per run, maxPipelines pipelines looked at.
//   - The client can only read pipelines, jobs, traces and issues, create
//     issues and notes, and add labels or edit the description. It cannot
//     close, delete or reopen anything, and it cannot touch repository files.
//   - The ledger ignores its own job, so it cannot file a task about itself.
//   - allow_failure jobs are not tasks.
//
// This script only records and escalates. It does not edit code, merge, deploy
// or send anything. Fixing is done by an agent or the founder from the issue.
//
// Env: GITLAB_AGENT_TOKEN (project access token, scopes api), CI_PROJECT_ID,
//      GITLAB_API_URL or CI_API_V4_URL, AGENT_LOOP_OFF=1 to stop the loop.
// Flag: --dry-run reads and plans but writes nothing.

import { createHash } from "node:crypto";

export const LABEL = "agent-task";
export const ESCALATE_LABEL = "needs-founder";
export const DEFAULTS = Object.freeze({
  maxAttempts: 3,
  maxNewPerRun: 3,
  maxPipelines: 10,
  maxJobsPerPipeline: 10,
  closedCooldownHours: 6,
  lookbackHours: 24,
  logTailChars: 4000,
  ignoreJobs: ["agent_task_ledger"],
});

// ---------------------------------------------------------------- fingerprint

const ANSI = /\u001b\[[0-9;]*[A-Za-z]/g;
const ERROR_LINE =
  /(error|failed|\bfail\b|✗|×|exit code|exited with|cannot find|not found)/i;

export function stripAnsi(text) {
  return String(text ?? "").replace(ANSI, "");
}

/** The first line that reads like an error, else the last line, else "". */
export function extractFirstError(log) {
  const lines = stripAnsi(log)
    .split(/\r?\n/)
    .map(l =>
      l.replace(/^\d{4}-\d{2}-\d{2}T[\d:.]+Z\s+\d+[A-Z]*\s?/, "").trim()
    )
    .filter(Boolean);
  const hit = lines.find(l => ERROR_LINE.test(l) && !l.startsWith("$ "));
  return hit ?? lines.at(-1) ?? "";
}

/** Removes what changes between runs of the same failure. */
export function normalizeLine(line) {
  return stripAnsi(line)
    .replace(/\d{4}-\d{2}-\d{2}T[\d:.]+Z?/g, "<ts>")
    .replace(/\/builds\/\S*?\/authichain-unified\//g, "")
    .replace(/\b[0-9a-f]{7,40}\b/gi, "<hex>")
    .replace(/\d+(?:\.\d+)?/g, "<n>")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase()
    .slice(0, 200);
}

export function fingerprint({ jobName, failureReason, logTail }) {
  const basis = [
    String(jobName ?? "").trim(),
    String(failureReason ?? ""),
    normalizeLine(extractFirstError(logTail)),
  ].join("\n");
  return createHash("sha256").update(basis).digest("hex").slice(0, 12);
}

// ----------------------------------------------------------------- task state

const MARKER = /<!--\s*agent-task:(\{[\s\S]*?\})\s*-->/;

export function readState(description) {
  const m = MARKER.exec(description ?? "");
  if (!m) return null;
  try {
    return JSON.parse(m[1]);
  } catch {
    return null;
  }
}

export function writeState(description, state) {
  const marker = `<!-- agent-task:${JSON.stringify(state)} -->`;
  const body = description ?? "";
  return MARKER.test(body)
    ? body.replace(MARKER, marker)
    : `${body.trimEnd()}\n\n${marker}\n`;
}

export function titleFor(fp, jobName) {
  return `[agent-task ${fp}] ${jobName} failing in CI`;
}

export function priorityFor(failure, defaultBranch = "main") {
  if (/secret|security|gitleaks/i.test(failure.jobName)) return "P0";
  if (failure.ref === defaultBranch) return "P1";
  return "P3";
}

function describeTask(f, state, priority, regressionOf) {
  const rows = [
    ["Task", `agent-task:${state.fp}`],
    ["Priority", priority],
    ["Owner", "AgentZ (unclaimed)"],
    ["Status", state.escalated ? "escalated to founder" : "open"],
    ["Branch", f.ref],
    ["Commit", f.sha],
    ["Pipeline", f.webUrl],
    ["Failing job", f.jobName],
    ["First error", f.firstError || "(none captured)"],
    ["Attempts", `${state.attempts} of ${DEFAULTS.maxAttempts}`],
  ];
  if (regressionOf) rows.push(["Regression of", `#${regressionOf}`]);
  const table = rows.map(([k, v]) => `| ${k} | ${v} |`).join("\n");
  return [
    "| Field | Value |",
    "| ----- | ----- |",
    table,
    "",
    "Next action: reproduce locally, fix the root cause, add a regression test, push a branch and open a merge request that links this issue.",
    "Do not skip, weaken or delete the failing check to make the pipeline green.",
    "Result: not yet recorded.",
  ].join("\n");
}

// -------------------------------------------------------------------- planner

/**
 * Pure. Decides what to do with each failure fingerprint.
 *
 * failures: [{ fp, jobName, pipelineId, sha, ref, jobId, webUrl, firstError }]
 * issues:   GitLab issues carrying the agent-task label (any state).
 * Returns a list of actions: create | comment | escalate | skip.
 */
export function planActions({ failures, issues, now = new Date(), opts = {} }) {
  const o = { ...DEFAULTS, ...opts };
  const byFp = new Map();
  for (const f of failures) {
    if (o.ignoreJobs.includes(f.jobName)) continue;
    if (!byFp.has(f.fp)) byFp.set(f.fp, []);
    byFp.get(f.fp).push(f);
  }

  const stateOf = issue => readState(issue.description);
  const actions = [];
  let created = 0;

  for (const [fp, group] of byFp) {
    group.sort((a, b) => a.pipelineId - b.pipelineId);
    const latest = group.at(-1);
    const forFp = issues.filter(i => stateOf(i)?.fp === fp);
    const open = forFp.find(i => i.state === "opened");

    if (open) {
      const state = stateOf(open);
      if (state.escalated) {
        actions.push({
          type: "skip",
          fp,
          issue: open.iid,
          reason: "escalated; no further automation",
        });
        continue;
      }
      const seen = new Set(state.pipelines ?? []);
      const fresh = group.filter(f => !seen.has(f.pipelineId));
      if (fresh.length === 0) {
        actions.push({
          type: "skip",
          fp,
          issue: open.iid,
          reason: "pipeline already recorded",
        });
        continue;
      }
      const next = {
        ...state,
        attempts: state.attempts + fresh.length,
        pipelines: [
          ...(state.pipelines ?? []),
          ...fresh.map(f => f.pipelineId),
        ].slice(-10),
        lastCommit: latest.sha,
      };
      if (next.attempts >= o.maxAttempts) {
        next.escalated = true;
        actions.push({
          type: "escalate",
          fp,
          issue: open.iid,
          state: next,
          failure: latest,
        });
      } else {
        actions.push({
          type: "comment",
          fp,
          issue: open.iid,
          state: next,
          failure: latest,
        });
      }
      continue;
    }

    const closed = forFp
      .filter(i => i.state === "closed")
      .sort((a, b) =>
        String(b.closed_at).localeCompare(String(a.closed_at))
      )[0];
    if (closed) {
      const hours = (now - new Date(closed.closed_at)) / 3_600_000;
      if (hours < o.closedCooldownHours) {
        actions.push({
          type: "skip",
          fp,
          issue: closed.iid,
          reason: "closed recently; waiting for a clean run",
        });
        continue;
      }
    }

    if (created >= o.maxNewPerRun) {
      actions.push({ type: "skip", fp, reason: "new-task cap for this run" });
      continue;
    }
    created += 1;
    const attempts = group.length;
    const state = {
      v: 1,
      fp,
      attempts,
      pipelines: group.map(f => f.pipelineId).slice(-10),
      lastCommit: latest.sha,
      escalated: attempts >= o.maxAttempts,
    };
    actions.push({
      type: "create",
      fp,
      state,
      failure: latest,
      regressionOf: closed?.iid,
    });
  }
  return actions;
}

// --------------------------------------------------------------------- client

const ALLOWED = [
  ["GET", /^\/projects\/[^/]+\/pipelines(\?.*)?$/],
  ["GET", /^\/projects\/[^/]+\/pipelines\/\d+\/jobs(\?.*)?$/],
  ["GET", /^\/projects\/[^/]+\/jobs\/\d+\/trace$/],
  ["GET", /^\/projects\/[^/]+\/issues(\?.*)?$/],
  ["POST", /^\/projects\/[^/]+\/issues$/],
  ["POST", /^\/projects\/[^/]+\/issues\/\d+\/notes$/],
  ["PUT", /^\/projects\/[^/]+\/issues\/\d+$/],
];
const PUT_FIELDS = new Set(["description", "add_labels"]);

/** Throws for anything outside the ledger's narrow permissions. */
export function assertAllowed(method, path, body) {
  const ok = ALLOWED.some(([m, re]) => m === method && re.test(path));
  if (!ok) throw new Error(`ledger may not ${method} ${path}`);
  if (method === "PUT") {
    for (const k of Object.keys(body ?? {}))
      if (!PUT_FIELDS.has(k))
        throw new Error(`ledger may not set ${k} on an issue`);
  }
}

export function makeClient({ baseUrl, token, fetchImpl = fetch }) {
  async function call(method, path, body) {
    assertAllowed(method, path, body);
    const res = await fetchImpl(`${baseUrl}${path}`, {
      method,
      headers: {
        "PRIVATE-TOKEN": token,
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`${method} ${path} -> ${res.status}`);
    return path.endsWith("/trace") ? res.text() : res.json();
  }
  return {
    get: p => call("GET", p),
    post: (p, b) => call("POST", p, b),
    put: (p, b) => call("PUT", p, b),
  };
}

// ------------------------------------------------------------------------ run

export async function collectFailures({ client, projectId, now, opts }) {
  const o = { ...DEFAULTS, ...opts };
  const since = new Date(now - o.lookbackHours * 3_600_000).toISOString();
  const pipelines = await client.get(
    `/projects/${projectId}/pipelines?status=failed&updated_after=${encodeURIComponent(since)}&order_by=id&sort=desc&per_page=${o.maxPipelines}`
  );
  const failures = [];
  for (const p of pipelines.slice(0, o.maxPipelines)) {
    const jobs = await client.get(
      `/projects/${projectId}/pipelines/${p.id}/jobs?scope[]=failed&per_page=${o.maxJobsPerPipeline}`
    );
    for (const j of jobs.slice(0, o.maxJobsPerPipeline)) {
      if (j.allow_failure || o.ignoreJobs.includes(j.name)) continue;
      const trace = await client.get(
        `/projects/${projectId}/jobs/${j.id}/trace`
      );
      const logTail = String(trace).slice(-o.logTailChars);
      failures.push({
        fp: fingerprint({
          jobName: j.name,
          failureReason: j.failure_reason,
          logTail,
        }),
        jobName: j.name,
        pipelineId: p.id,
        sha: p.sha,
        ref: p.ref,
        jobId: j.id,
        webUrl: p.web_url,
        firstError: extractFirstError(logTail),
      });
    }
  }
  return failures;
}

export async function runLedger({
  client,
  projectId,
  now = new Date(),
  dryRun = false,
  opts = {},
  defaultBranch = "main",
}) {
  const failures = await collectFailures({ client, projectId, now, opts });
  const issues = await client.get(
    `/projects/${projectId}/issues?labels=${LABEL}&state=all&per_page=100`
  );
  const actions = planActions({ failures, issues, now, opts });
  if (dryRun) return { dryRun, failures: failures.length, actions };

  for (const a of actions) {
    if (a.type === "create") {
      const priority = priorityFor(a.failure, defaultBranch);
      const labels = [LABEL, `priority::${priority}`];
      if (a.state.escalated) labels.push(ESCALATE_LABEL);
      const description = writeState(
        describeTask(a.failure, a.state, priority, a.regressionOf),
        a.state
      );
      const made = await client.post(`/projects/${projectId}/issues`, {
        title: titleFor(a.fp, a.failure.jobName),
        description,
        labels: labels.join(","),
      });
      a.issue = made.iid;
    } else if (a.type === "comment" || a.type === "escalate") {
      const priority = priorityFor(a.failure, defaultBranch);
      const description = writeState(
        describeTask(a.failure, a.state, priority),
        a.state
      );
      const body = { description };
      if (a.type === "escalate") body.add_labels = ESCALATE_LABEL;
      await client.put(`/projects/${projectId}/issues/${a.issue}`, body);
      await client.post(`/projects/${projectId}/issues/${a.issue}/notes`, {
        body:
          a.type === "escalate"
            ? `Attempt cap reached (${a.state.attempts} of ${DEFAULTS.maxAttempts}). Pipeline ${a.failure.webUrl} failed again on ${a.failure.sha}. Labelled ${ESCALATE_LABEL}; the ledger will not touch this task again.`
            : `Failed again: pipeline ${a.failure.webUrl} on ${a.failure.sha}. Attempt ${a.state.attempts} of ${DEFAULTS.maxAttempts}. First error: ${a.failure.firstError}`,
      });
    }
  }
  return { dryRun, failures: failures.length, actions };
}

export function summarize(report) {
  const counts = {};
  for (const a of report.actions) counts[a.type] = (counts[a.type] ?? 0) + 1;
  const head = `agent task ledger${report.dryRun ? " (dry run)" : ""}: ${report.failures} failed job(s), ${report.actions.length} action(s)`;
  const lines = report.actions.map(
    a =>
      `- ${a.type} ${a.fp}${a.issue ? ` #${a.issue}` : ""}${a.reason ? ` (${a.reason})` : ""}`
  );
  return [head, JSON.stringify(counts), ...lines].join("\n");
}

async function main(argv) {
  if (process.env.AGENT_LOOP_OFF === "1") {
    console.log("agent task ledger: AGENT_LOOP_OFF=1, stopped.");
    return 0;
  }
  const token = process.env.GITLAB_AGENT_TOKEN;
  const projectId = process.env.CI_PROJECT_ID;
  if (!token || !projectId) {
    console.log(
      "agent task ledger: GITLAB_AGENT_TOKEN or CI_PROJECT_ID is not set; nothing to do."
    );
    return 0;
  }
  const baseUrl =
    process.env.GITLAB_API_URL ||
    process.env.CI_API_V4_URL ||
    "https://gitlab.com/api/v4";
  const client = makeClient({ baseUrl, token });
  const report = await runLedger({
    client,
    projectId,
    dryRun: argv.includes("--dry-run"),
    defaultBranch: process.env.CI_DEFAULT_BRANCH || "main",
  });
  console.log(summarize(report));
  return 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main(process.argv.slice(2)).then(
    c => process.exit(c),
    e => {
      console.error(e);
      process.exit(1);
    }
  );
}
