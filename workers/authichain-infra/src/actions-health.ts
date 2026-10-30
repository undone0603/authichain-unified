// Is GitHub Actions actually running jobs?
//
// The autonomous stack (CI, deploys, ops-pulse, watchdogs, merge autopilot)
// lives on GitHub Actions, and ops-pulse is what raises the alarm. When
// Actions itself stops (2026-10-15: "account is locked due to a billing
// issue"), ops-pulse cannot run, so the outage is silent. This check runs on
// Cloudflare instead and names the cause when GitHub gives one.

export type RunLike = {
  id: number;
  name?: string;
  status?: string;
  conclusion?: string | null;
  created_at: string;
};

export type ActionsHealth = {
  status: "ok" | "down" | "warn" | "skip";
  detail: string;
};

const FAILED = new Set(["failure", "startup_failure", "timed_out"]);

/**
 * Pure. `recent` is the newest runs (any outcome); `lastSuccessAt` the newest
 * successful run; `cause` an annotation message from a failed job, if read.
 * Down when runs keep being created but none has succeeded for `staleMs` and
 * every recent completed run failed.
 */
export function classifyActions(
  recent: RunLike[],
  lastSuccessAt: string | null,
  cause: string | null,
  now: number = Date.now(),
  staleMs: number = 3 * 3600_000
): ActionsHealth {
  const completed = recent.filter(r => r.status === "completed");
  if (completed.length === 0) {
    return { status: "warn", detail: "no completed workflow runs to judge" };
  }
  const sinceSuccess = lastSuccessAt ? now - Date.parse(lastSuccessAt) : Infinity;
  const allFailed = completed.every(r => FAILED.has(String(r.conclusion)));
  if (allFailed && sinceSuccess > staleMs) {
    const last = lastSuccessAt ? `last success ${lastSuccessAt}` : "no recent success";
    const why = cause ? `: ${publicCause(cause)}` : "";
    return {
      status: "down",
      detail: `GitHub Actions is not completing jobs (${completed.length}/${completed.length} recent runs failed, ${last})${why}`,
    };
  }
  return {
    status: "ok",
    detail: lastSuccessAt ? `last successful run ${lastSuccessAt}` : "recent runs are not all failing",
  };
}

/** Keep the cause short and free of anything but GitHub's own wording. */
export function publicCause(message: string): string {
  if (/billing/i.test(message)) return "account locked due to a billing issue";
  if (/spending limit/i.test(message)) return "spending limit reached";
  return message.replace(/\s+/g, " ").slice(0, 120);
}

export async function checkGitHubActions(
  token: string | undefined,
  repo = "undone0603/authichain-unified",
  fetchImpl: typeof fetch = fetch
): Promise<ActionsHealth> {
  if (!token) return { status: "skip", detail: "no GITHUB_TOKEN" };
  const headers = {
    Authorization: `token ${token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "authichain-infra",
  };
  const get = async (path: string) => {
    const res = await fetchImpl(`https://api.github.com/repos/${repo}${path}`, { headers });
    if (!res.ok) throw new Error(`GitHub API ${res.status}`);
    return res.json() as Promise<any>;
  };
  try {
    const [recentBody, successBody] = await Promise.all([
      get("/actions/runs?per_page=20"),
      get("/actions/runs?status=success&per_page=1"),
    ]);
    const recent: RunLike[] = recentBody.workflow_runs ?? [];
    const lastSuccessAt: string | null = successBody.workflow_runs?.[0]?.created_at ?? null;
    let cause: string | null = null;
    const failed = recent.find(r => r.status === "completed" && FAILED.has(String(r.conclusion)));
    if (failed) {
      try {
        const jobs = await get(`/actions/runs/${failed.id}/jobs?per_page=1`);
        const jobId = jobs.jobs?.[0]?.id;
        if (jobId) {
          const notes: any[] = await get(`/check-runs/${jobId}/annotations`);
          const hit = notes.find(n => n.annotation_level === "failure") ?? notes[0];
          cause = typeof hit?.message === "string" ? hit.message : null;
        }
      } catch {
        // The cause is a bonus; classification stands without it.
      }
    }
    return classifyActions(recent, lastSuccessAt, cause);
  } catch (e: any) {
    return { status: "warn", detail: `could not read GitHub Actions: ${e?.message ?? "error"}` };
  }
}
