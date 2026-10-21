#!/usr/bin/env node
// scripts/autonomy/launch-gates.mjs
//
// Launch gates as code (tracking issue #1987).
// Reads config/launch-gates.json, collects evidence, and decides every gate
// without a human approval. The founder is the override (kill_switch), not
// the approver.
//
// Platforms: runs on GitLab CI (primary while GitHub Actions is billing
// locked) and on GitHub Actions. Platform is detected from $GITLAB_CI.
//
// FAIL CLOSED: a gate passes only with positive evidence. Missing, empty or
// malformed evidence, a skipped job, a job with no executed steps or zero
// duration, a stale run, a collector error, or an unimplemented (`pending`)
// gate all FAIL.
//
// CLI: node scripts/autonomy/launch-gates.mjs
//   env (GitLab): CI_PROJECT_ID, CI_JOB_TOKEN (read pipelines),
//        GITLAB_API_TOKEN (project access token, scope api; needed only to
//        open/close issues. Without it the report is still produced.)
//   env (GitHub): GITHUB_TOKEN, GITHUB_REPOSITORY
//        LAUNCH_GATES_DRY_RUN=true   print only; do not open/close issues
//        LAUNCH_GATES_STRICT=true    exit 1 if any gate fails
//   writes launch-gates-report.json and a Markdown digest (stdout and, on
//   GitHub, $GITHUB_STEP_SUMMARY). Opens ONE issue per failing gate (label
//   `launch-gate`) and closes it when the gate passes again.

import { appendFileSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import {
  evaluateConformanceEvidence,
  evaluateRoundtripEvidence,
  runConformance,
  runRoundtrip,
} from "./protocol-gates.mjs";

const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
export const MANIFEST_PATH = join(ROOT, "config", "launch-gates.json");
export const ISSUE_LABEL = "launch-gate";
export const GATE_TYPES = [
  "ci",
  "http_probe",
  "verify_roundtrip",
  "protocol_conformance",
  "pending",
];
const DAY = 86_400_000;

const PASS = "pass";
const FAIL = "fail";
const failed = (reasons, evidence = {}) => ({
  status: FAIL,
  reasons: Array.isArray(reasons) ? reasons : [reasons],
  evidence,
});
const passed = (evidence = {}) => ({ status: PASS, reasons: [], evidence });

export const platformOf = (env) =>
  env.GITLAB_CI === "true" ? "gitlab" : "github";

/** Pure. Manifest errors (empty array when valid). */
export function validateManifest(m) {
  const errors = [];
  if (!m || typeof m !== "object") return ["manifest must be an object"];
  if (m.version !== 1) errors.push("version must be 1");
  if (typeof m.kill_switch !== "boolean")
    errors.push("kill_switch must be true or false");
  if (!Array.isArray(m.gates) || m.gates.length === 0) {
    errors.push("gates must be a non-empty array");
    return errors;
  }
  const seen = new Set();
  for (const g of m.gates) {
    const id = g?.id;
    if (typeof id !== "string" || id === "") {
      errors.push("every gate needs a string id");
      continue;
    }
    if (seen.has(id)) errors.push(`duplicate gate id: ${id}`);
    seen.add(id);
    if (typeof g.title !== "string" || g.title === "")
      errors.push(`${id}: title required`);
    if (!GATE_TYPES.includes(g.type))
      errors.push(`${id}: unknown type ${String(g.type)}`);
    if (g.type === "ci") {
      if (!Array.isArray(g.jobs) || g.jobs.length === 0)
        errors.push(`${id}: jobs must be a non-empty array (GitLab job names)`);
      if (!Array.isArray(g.workflows) || g.workflows.length === 0)
        errors.push(`${id}: workflows must be a non-empty array (GitHub files)`);
      if (
        g.max_age_days !== undefined &&
        !(Number.isInteger(g.max_age_days) && g.max_age_days > 0)
      )
        errors.push(`${id}: max_age_days must be a positive integer`);
    }
    if (g.type === "http_probe") {
      if (!Array.isArray(g.probes) || g.probes.length === 0)
        errors.push(`${id}: probes must be a non-empty array`);
      for (const p of g.probes ?? []) {
        if (typeof p?.url !== "string" || !p.url.startsWith("https://"))
          errors.push(`${id}: probe url must start with https://`);
        if (!Number.isInteger(p?.expect_status))
          errors.push(`${id}: probe expect_status must be an integer`);
        if (!(p?.max_ms > 0)) errors.push(`${id}: probe max_ms must be > 0`);
      }
    }
  }
  return errors;
}

/**
 * Pure (GitHub). `entries` = [{ workflow, run, jobs }] where run is the latest
 * completed run (or null) and jobs the GitHub jobs payload entries.
 */
export function evaluateGithubCiEvidence(entries, { allowSkippedJobs = false } = {}) {
  if (!Array.isArray(entries) || entries.length === 0)
    return failed("no CI evidence collected");
  const reasons = [];
  const summary = [];
  for (const e of entries) {
    const wf = e?.workflow ?? "(unknown workflow)";
    const run = e?.run;
    if (!run) {
      reasons.push(`${wf}: no completed run found`);
      continue;
    }
    if (run.conclusion !== "success")
      reasons.push(`${wf}: latest run concluded ${String(run.conclusion)}`);
    const jobs = Array.isArray(e.jobs) ? e.jobs : [];
    if (jobs.length === 0) reasons.push(`${wf}: run has no jobs`);
    for (const job of jobs) {
      const name = `${wf} / ${job?.name ?? "(job)"}`;
      const steps = Array.isArray(job?.steps) ? job.steps : [];
      if (steps.length === 0) {
        reasons.push(`${name}: empty steps (job never executed)`);
        continue;
      }
      const executed = steps.filter(
        (s) => s?.conclusion === "success" || s?.conclusion === "failure"
      );
      if (executed.length === 0) {
        reasons.push(`${name}: no step executed`);
        continue;
      }
      if (job.conclusion === "skipped" && allowSkippedJobs) continue;
      if (job.conclusion !== "success")
        reasons.push(`${name}: job concluded ${String(job.conclusion)}`);
    }
    summary.push({ workflow: wf, run_id: run.id ?? null, sha: run.head_sha ?? null });
  }
  return reasons.length ? failed(reasons, { runs: summary }) : passed({ runs: summary });
}

/**
 * Pure (GitLab). `entries` = [{ job, found }] where found is the latest real
 * run of that job on the default branch (status success/failed/canceled) or
 * null when none exists (never run, or only manual/skipped).
 */
export function evaluateGitlabCiEvidence(
  entries,
  { now = new Date(), maxAgeDays = 7 } = {}
) {
  if (!Array.isArray(entries) || entries.length === 0)
    return failed("no CI evidence collected");
  const reasons = [];
  const summary = [];
  for (const e of entries) {
    const name = e?.job ?? "(unknown job)";
    const f = e?.found;
    if (!f) {
      reasons.push(`${name}: no run found on the default branch (never run or only manual/skipped)`);
      continue;
    }
    if (f.status !== "success")
      reasons.push(`${name}: latest run is ${String(f.status)}`);
    if (!(f.duration > 0))
      reasons.push(`${name}: no recorded duration (job never executed)`);
    const finished = Date.parse(f.finished_at ?? "");
    if (!Number.isFinite(finished))
      reasons.push(`${name}: no finish time recorded`);
    else if (now.getTime() - finished > maxAgeDays * DAY)
      reasons.push(`${name}: latest run is older than ${maxAgeDays} days`);
    summary.push({
      job: name,
      job_id: f.id ?? null,
      pipeline_id: f.pipeline_id ?? null,
      sha: f.sha ?? null,
      finished_at: f.finished_at ?? null,
    });
  }
  return reasons.length ? failed(reasons, { jobs: summary }) : passed({ jobs: summary });
}

/** Pure. `results` = [{ url, status, location, ms, error }] aligned to `probes`. */
export function evaluateProbes(results, probes, forbidRedirectHost) {
  if (!Array.isArray(results) || results.length === 0)
    return failed("no probe evidence collected");
  const reasons = [];
  for (const p of probes) {
    const r = results.find((x) => x?.url === p.url);
    if (!r) {
      reasons.push(`${p.url}: no result`);
      continue;
    }
    if (r.error) {
      reasons.push(`${p.url}: ${r.error}`);
      continue;
    }
    if (
      forbidRedirectHost &&
      typeof r.location === "string" &&
      r.location.toLowerCase().includes(forbidRedirectHost)
    ) {
      reasons.push(`${p.url}: redirects to ${forbidRedirectHost}`);
      continue;
    }
    if (r.status !== p.expect_status)
      reasons.push(`${p.url}: got ${r.status}, expected ${p.expect_status}`);
    if (!(r.ms <= p.max_ms))
      reasons.push(`${p.url}: ${r.ms}ms over ${p.max_ms}ms budget`);
  }
  return reasons.length ? failed(reasons, { results }) : passed({ results });
}

/** Pure. Decide one gate from its evidence. Anything unexpected FAILS. */
export function evaluateGate(gate, evidence, now = new Date()) {
  try {
    if (gate.type === "pending")
      return failed(`not implemented yet (${gate.ref ?? "no ref"})`);
    if (evidence === undefined || evidence === null)
      return failed("no evidence collected");
    if (evidence.error) return failed(`collector error: ${evidence.error}`);
    if (gate.type === "ci") {
      if (evidence.platform === "gitlab")
        return evaluateGitlabCiEvidence(evidence.entries, {
          now,
          maxAgeDays: gate.max_age_days ?? 7,
        });
      if (evidence.platform === "github")
        return evaluateGithubCiEvidence(evidence.entries, {
          allowSkippedJobs: gate.allow_skipped_jobs === true,
        });
      return failed("unknown CI platform in evidence");
    }
    if (gate.type === "verify_roundtrip")
      return evaluateRoundtripEvidence(evidence);
    if (gate.type === "protocol_conformance")
      return evaluateConformanceEvidence(evidence);
    if (gate.type === "http_probe")
      return evaluateProbes(
        evidence.results,
        gate.probes,
        gate.forbid_redirect_host
      );
    return failed(`unknown gate type ${String(gate.type)}`);
  } catch (err) {
    return failed(`evaluator error: ${err?.message ?? err}`);
  }
}

/** Pure. Evaluate the whole manifest. kill_switch stands everything down. */
export function evaluateAll(manifest, evidenceById = {}, now = new Date()) {
  const errors = validateManifest(manifest);
  if (errors.length)
    return { state: "invalid_manifest", errors, gates: [], checked_at: now.toISOString() };
  if (manifest.kill_switch === true)
    return { state: "stood_down", gates: [], checked_at: now.toISOString() };
  const gates = manifest.gates.map((g) => ({
    id: g.id,
    title: g.title,
    ref: g.ref ?? null,
    ...evaluateGate(g, evidenceById[g.id], now),
  }));
  const allPass = gates.every((g) => g.status === PASS);
  return {
    state: allPass ? "pass" : "fail",
    gates,
    checked_at: now.toISOString(),
  };
}

/** Pure. Markdown digest. */
export function renderSummary(report) {
  const lines = [`### Launch gates: ${report.state}`, ""];
  if (report.state === "stood_down") {
    lines.push("kill_switch is on. No probes were run and no issues were changed.");
    return lines.join("\n");
  }
  if (report.state === "invalid_manifest") {
    lines.push(...report.errors.map((e) => `- ${e}`));
    return lines.join("\n");
  }
  const ok = report.gates.filter((g) => g.status === PASS).length;
  lines.push(`${ok}/${report.gates.length} gates passing at ${report.checked_at}`, "");
  for (const g of report.gates) {
    lines.push(`- ${g.status === PASS ? "PASS" : "FAIL"} ${g.id}: ${g.title}`);
    for (const r of g.reasons) lines.push(`  - ${r}`);
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------- API clients

async function gh(path, env, init = {}) {
  const res = await fetch(`https://api.github.com${path}`, {
    ...init,
    headers: {
      authorization: `Bearer ${env.GITHUB_TOKEN}`,
      accept: "application/vnd.github+json",
      "x-github-api-version": "2022-11-28",
      "user-agent": "authichain-launch-gates",
      ...(init.headers ?? {}),
    },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitHub ${res.status} for ${path}`);
  return res.status === 204 ? {} : res.json();
}

async function gl(path, env, init = {}) {
  const base = env.CI_API_V4_URL || "https://gitlab.com/api/v4";
  const headers = { "user-agent": "authichain-launch-gates", ...(init.headers ?? {}) };
  if (env.GITLAB_API_TOKEN) headers["PRIVATE-TOKEN"] = env.GITLAB_API_TOKEN;
  else if (env.CI_JOB_TOKEN) headers["JOB-TOKEN"] = env.CI_JOB_TOKEN;
  if (init.body) headers["content-type"] = "application/json";
  const res = await fetch(`${base}${path}`, { ...init, headers });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`GitLab ${res.status} for ${path}`);
  return res.status === 204 ? {} : res.json();
}

// ---------------------------------------------------------------- collectors

async function collectGithubCi(gate, manifest, env) {
  const repo = env.GITHUB_REPOSITORY || manifest.repo;
  const branch = manifest.default_branch || "main";
  const entries = [];
  for (const wf of gate.workflows) {
    const runs = await gh(
      `/repos/${repo}/actions/workflows/${encodeURIComponent(wf)}/runs?branch=${encodeURIComponent(branch)}&status=completed&per_page=1`,
      env
    );
    const run = runs?.workflow_runs?.[0] ?? null;
    const jobs = run
      ? ((await gh(`/repos/${repo}/actions/runs/${run.id}/jobs?per_page=100`, env))?.jobs ?? [])
      : [];
    entries.push({ workflow: wf, run, jobs });
  }
  return { platform: "github", entries };
}

const REAL_RUN = new Set(["success", "failed", "canceled"]);

async function collectGitlabCi(gate, manifest, env) {
  const pid = env.CI_PROJECT_ID;
  if (!pid) throw new Error("CI_PROJECT_ID is not set");
  const ref = manifest.default_branch || "main";
  const pipelines =
    (await gl(
      `/projects/${pid}/pipelines?ref=${encodeURIComponent(ref)}&per_page=20&order_by=id&sort=desc`,
      env
    )) ?? [];
  const found = new Map();
  for (const p of pipelines) {
    if (found.size === gate.jobs.length) break;
    const jobs = (await gl(`/projects/${pid}/pipelines/${p.id}/jobs?per_page=100`, env)) ?? [];
    for (const job of jobs) {
      if (!gate.jobs.includes(job.name) || found.has(job.name)) continue;
      if (!REAL_RUN.has(job.status)) continue; // manual, skipped, created: not a run
      found.set(job.name, {
        id: job.id,
        status: job.status,
        duration: job.duration,
        finished_at: job.finished_at,
        pipeline_id: p.id,
        sha: p.sha,
      });
    }
  }
  return {
    platform: "gitlab",
    entries: gate.jobs.map((name) => ({ job: name, found: found.get(name) ?? null })),
  };
}

async function probeOne(p) {
  const t0 = Date.now();
  try {
    const res = await fetch(p.url, {
      method: "GET",
      redirect: "manual",
      signal: AbortSignal.timeout(10_000),
      headers: { "user-agent": "authichain-launch-gates/1.0" },
    });
    return {
      url: p.url,
      status: res.status,
      location: res.headers.get("location"),
      ms: Date.now() - t0,
    };
  } catch (err) {
    return { url: p.url, error: err?.message ?? String(err), ms: Date.now() - t0 };
  }
}

async function collect(gate, manifest, env) {
  if (gate.type === "ci")
    return platformOf(env) === "gitlab"
      ? collectGitlabCi(gate, manifest, env)
      : collectGithubCi(gate, manifest, env);
  if (gate.type === "verify_roundtrip") {
    const verifier = await import(
      pathToFileURL(join(ROOT, "protocol", "verifier.mjs")).href
    );
    return runRoundtrip({ verifier });
  }
  if (gate.type === "protocol_conformance") return runConformance();
  if (gate.type === "http_probe")
    return { results: await Promise.all(gate.probes.map(probeOne)) };
  return undefined;
}

// --------------------------------------------------------------- issue sync

const issueTitle = (id) => `Launch gate failing: ${id}`;
const CLOSE_NOTE = "Gate passing again. Closing.";

function issueClient(manifest, env) {
  if (platformOf(env) === "gitlab") {
    const pid = env.CI_PROJECT_ID;
    return {
      enabled: Boolean(env.GITLAB_API_TOKEN && pid),
      missing: "GITLAB_API_TOKEN (project access token, scope api) not set",
      async listOpen() {
        const items =
          (await gl(`/projects/${pid}/issues?labels=${ISSUE_LABEL}&state=opened&per_page=100`, env)) ?? [];
        return items.map((i) => ({ title: i.title, id: i.iid }));
      },
      async create(title, body) {
        await gl(`/projects/${pid}/issues`, env, {
          method: "POST",
          body: JSON.stringify({ title, description: body, labels: ISSUE_LABEL }),
        });
      },
      async close(id) {
        await gl(`/projects/${pid}/issues/${id}/notes`, env, {
          method: "POST",
          body: JSON.stringify({ body: CLOSE_NOTE }),
        });
        await gl(`/projects/${pid}/issues/${id}`, env, {
          method: "PUT",
          body: JSON.stringify({ state_event: "close" }),
        });
      },
    };
  }
  const repo = env.GITHUB_REPOSITORY || manifest.repo;
  return {
    enabled: Boolean(env.GITHUB_TOKEN),
    missing: "GITHUB_TOKEN not set",
    async listOpen() {
      const items =
        (await gh(`/repos/${repo}/issues?labels=${ISSUE_LABEL}&state=open&per_page=100`, env)) ?? [];
      return items.map((i) => ({ title: i.title, id: i.number }));
    },
    async create(title, body) {
      await gh(`/repos/${repo}/issues`, env, {
        method: "POST",
        body: JSON.stringify({ title, body, labels: [ISSUE_LABEL] }),
      });
    },
    async close(id) {
      await gh(`/repos/${repo}/issues/${id}/comments`, env, {
        method: "POST",
        body: JSON.stringify({ body: CLOSE_NOTE }),
      });
      await gh(`/repos/${repo}/issues/${id}`, env, {
        method: "PATCH",
        body: JSON.stringify({ state: "closed", state_reason: "completed" }),
      });
    },
  };
}

async function syncIssues(report, manifest, env, dryRun) {
  const client = issueClient(manifest, env);
  if (!client.enabled) {
    console.log(`issue sync skipped: ${client.missing}`);
    return;
  }
  const byTitle = new Map((await client.listOpen()).map((i) => [i.title, i]));
  for (const g of report.gates) {
    const existing = byTitle.get(issueTitle(g.id));
    if (g.status === FAIL && !existing) {
      const body = [
        `Gate **${g.id}** is failing: ${g.title}`,
        "",
        ...g.reasons.map((r) => `- ${r}`),
        "",
        g.ref ? `Tracking: ${g.ref}` : "",
        "",
        "This issue closes itself when the gate passes. Stop all gates with `kill_switch` in config/launch-gates.json.",
      ].join("\n");
      console.log(`open issue: ${issueTitle(g.id)}`);
      if (!dryRun) await client.create(issueTitle(g.id), body);
    } else if (g.status === PASS && existing) {
      console.log(`close issue: ${issueTitle(g.id)}`);
      if (!dryRun) await client.close(existing.id);
    }
  }
}

// ---------------------------------------------------------------------- CLI

export async function main(env = process.env) {
  const manifest = JSON.parse(readFileSync(MANIFEST_PATH, "utf8"));
  const dryRun = env.LAUNCH_GATES_DRY_RUN === "true";
  const strict = env.LAUNCH_GATES_STRICT === "true";
  const errors = validateManifest(manifest);
  let report;
  if (errors.length || manifest.kill_switch === true) {
    report = evaluateAll(manifest);
  } else {
    const evidence = {};
    for (const g of manifest.gates) {
      try {
        evidence[g.id] = await collect(g, manifest, env);
      } catch (err) {
        evidence[g.id] = { error: err?.message ?? String(err) };
      }
    }
    report = evaluateAll(manifest, evidence);
  }
  const summary = renderSummary(report);
  console.log(summary);
  writeFileSync("launch-gates-report.json", JSON.stringify(report, null, 2));
  if (env.GITHUB_STEP_SUMMARY) appendFileSync(env.GITHUB_STEP_SUMMARY, `${summary}\n`);
  if (report.state !== "stood_down" && report.state !== "invalid_manifest")
    await syncIssues(report, manifest, env, dryRun);
  if (report.state === "invalid_manifest") return 1;
  return strict && report.state === "fail" ? 1 : 0;
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? "").href) {
  main().then(
    (code) => process.exit(code),
    (err) => {
      // Fail closed on any unexpected error.
      console.error(err);
      process.exit(1);
    }
  );
}
