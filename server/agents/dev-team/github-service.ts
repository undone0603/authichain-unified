/**
 * GitHub REST API Service
 *
 * Used by all dev-team agents to interact with the authichain-unified repo.
 *
 * Required secret:
 *   GITHUB_TOKEN  — Personal Access Token with `repo` + `actions` + `pull_requests` scopes
 *   GITHUB_OWNER  — e.g. "undone0603"
 *   GITHUB_REPO   — e.g. "authichain-unified"
 */

const GH_API = "https://api.github.com";

function headers(): Record<string, string> {
  const token = process.env.GITHUB_TOKEN;
  if (!token) throw new Error("GITHUB_TOKEN not set");
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "Content-Type": "application/json",
  };
}

function repo(): string {
  const owner = process.env.GITHUB_OWNER ?? "undone0603";
  const name  = process.env.GITHUB_REPO  ?? "authichain-unified";
  return `${owner}/${name}`;
}

async function gh(method: string, path: string, body?: unknown): Promise<any> {
  const res = await fetch(`${GH_API}${path}`, {
    method,
    headers: headers(),
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GitHub API ${method} ${path} → ${res.status}: ${text}`);
  }
  if (res.status === 204) return null;
  return res.json();
}

// ─── Branch operations ────────────────────────────────────────────────────

export async function getDefaultBranch(): Promise<string> {
  const data = await gh("GET", `/repos/${repo()}`);
  return data.default_branch ?? "main";
}

export async function getBranchSha(branch: string): Promise<string> {
  const data = await gh("GET", `/repos/${repo()}/git/ref/heads/${encodeURIComponent(branch)}`);
  return data.object.sha;
}

/** Create a new feature branch off the default branch. */
export async function createBranch(branchName: string): Promise<void> {
  const base = await getDefaultBranch();
  const sha  = await getBranchSha(base);
  await gh("POST", `/repos/${repo()}/git/refs`, {
    ref: `refs/heads/${branchName}`,
    sha,
  });
}

export async function deleteBranch(branchName: string): Promise<void> {
  await gh("DELETE", `/repos/${repo()}/git/refs/heads/${encodeURIComponent(branchName)}`);
}

// ─── File operations ──────────────────────────────────────────────────────

export interface FileContent {
  path: string;
  content: string;   // decoded UTF-8
  sha: string;       // needed for updates
  encoding: string;
}

export async function getFile(path: string, branch?: string): Promise<FileContent | null> {
  try {
    const qs = branch ? `?ref=${encodeURIComponent(branch)}` : "";
    const data = await gh("GET", `/repos/${repo()}/contents/${path}${qs}`);
    return {
      path,
      content: Buffer.from(data.content, "base64").toString("utf-8"),
      sha: data.sha,
      encoding: data.encoding,
    };
  } catch {
    return null;
  }
}

export async function listFiles(dirPath: string, branch?: string): Promise<string[]> {
  try {
    const qs = branch ? `?ref=${encodeURIComponent(branch)}` : "";
    const data = await gh("GET", `/repos/${repo()}/contents/${dirPath}${qs}`);
    if (!Array.isArray(data)) return [];
    return data
      .filter((f: any) => f.type === "file")
      .map((f: any) => f.path as string);
  } catch {
    return [];
  }
}

/** Create or update a file on a branch with a single commit. */
export async function writeFile(opts: {
  path: string;
  content: string;
  message: string;
  branch: string;
  sha?: string;   // required for updates, omit for creates
}): Promise<{ sha: string }> {
  const body: Record<string, unknown> = {
    message: opts.message,
    content: Buffer.from(opts.content, "utf-8").toString("base64"),
    branch:  opts.branch,
  };
  if (opts.sha) body.sha = opts.sha;
  const data = await gh("PUT", `/repos/${repo()}/contents/${opts.path}`, body);
  return { sha: data.content.sha };
}

// ─── Pull Requests ────────────────────────────────────────────────────────

export interface PullRequest {
  number: number;
  html_url: string;
  head: { sha: string; ref: string };
  base: { ref: string };
  title: string;
  body: string;
  state: string;
  mergeable: boolean | null;
  mergeable_state: string;
}

export async function createPR(opts: {
  title: string;
  body: string;
  head: string;   // feature branch
  base?: string;  // target branch (default: main)
}): Promise<PullRequest> {
  const base = opts.base ?? await getDefaultBranch();
  return gh("POST", `/repos/${repo()}/pulls`, {
    title: opts.title,
    body:  opts.body,
    head:  opts.head,
    base,
    draft: false,
  });
}

export async function getPR(number: number): Promise<PullRequest> {
  return gh("GET", `/repos/${repo()}/pulls/${number}`);
}

export async function getPRFiles(number: number): Promise<{ filename: string; status: string; patch?: string }[]> {
  return gh("GET", `/repos/${repo()}/pulls/${number}/files`);
}

export async function addPRReview(opts: {
  prNumber: number;
  body: string;
  event: "APPROVE" | "REQUEST_CHANGES" | "COMMENT";
  comments?: { path: string; line: number; body: string }[];
}): Promise<void> {
  await gh("POST", `/repos/${repo()}/pulls/${opts.prNumber}/reviews`, {
    body:     opts.body,
    event:    opts.event,
    comments: opts.comments ?? [],
  });
}

export async function mergePR(number: number, mergeMethod: "merge" | "squash" | "rebase" = "squash"): Promise<void> {
  await gh("PUT", `/repos/${repo()}/pulls/${number}/merge`, {
    merge_method: mergeMethod,
  });
}

export async function addPRComment(number: number, body: string): Promise<void> {
  await gh("POST", `/repos/${repo()}/issues/${number}/comments`, { body });
}

// ─── GitHub Actions / CI ──────────────────────────────────────────────────

export interface WorkflowRun {
  id: number;
  status: "queued" | "in_progress" | "completed";
  conclusion: "success" | "failure" | "cancelled" | "skipped" | "timed_out" | null;
  html_url: string;
  head_sha: string;
  created_at: string;
}

/** Get the latest CI run for a given commit SHA on a branch. */
export async function getLatestRunForSha(sha: string): Promise<WorkflowRun | null> {
  const data = await gh("GET", `/repos/${repo()}/actions/runs?head_sha=${sha}&per_page=10`);
  const runs: WorkflowRun[] = data.workflow_runs ?? [];
  // Return the most recently created run
  return runs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] ?? null;
}

/** Poll until a CI run completes or times out. Returns final status. */
export async function waitForCIRun(sha: string, opts?: {
  timeoutMs?: number;
  pollIntervalMs?: number;
}): Promise<WorkflowRun | null> {
  const timeout = opts?.timeoutMs ?? 10 * 60 * 1000;  // 10 min default
  const interval = opts?.pollIntervalMs ?? 20_000;      // 20s poll
  const deadline = Date.now() + timeout;

  // Wait for a run to appear (up to 60s)
  let run: WorkflowRun | null = null;
  for (let i = 0; i < 6 && !run; i++) {
    await new Promise(r => setTimeout(r, 10_000));
    run = await getLatestRunForSha(sha);
  }
  if (!run) return null;

  // Poll until completed
  while (Date.now() < deadline) {
    run = await getLatestRunForSha(sha);
    if (run?.status === "completed") return run;
    await new Promise(r => setTimeout(r, interval));
  }
  return run;
}

// ─── Issues ───────────────────────────────────────────────────────────────

export async function createIssue(opts: {
  title: string;
  body: string;
  labels?: string[];
}): Promise<{ number: number; html_url: string }> {
  return gh("POST", `/repos/${repo()}/issues`, opts);
}

// ─── Search code ──────────────────────────────────────────────────────────

/** Search the repo for a symbol/pattern to help the code-writer locate relevant files. */
export async function searchCode(query: string): Promise<{ path: string; url: string }[]> {
  const q = encodeURIComponent(`${query} repo:${repo()}`);
  const data = await gh("GET", `/search/code?q=${q}&per_page=10`);
  return (data.items ?? []).map((i: any) => ({ path: i.path, url: i.html_url }));
}

// ─── Deployments ──────────────────────────────────────────────────────────

export async function listDeployments(environment?: string): Promise<any[]> {
  const qs = environment ? `?environment=${encodeURIComponent(environment)}` : "";
  const data = await gh("GET", `/repos/${repo()}/deployments${qs}`);
  return Array.isArray(data) ? data : [];
}
