// scripts/gemma/lib.mjs
//
// Shared client for the Gemma improvement loops. Gemma runs in LM Studio on
// the owner's network, so these scripts only work on the self-hosted runner
// labelled `lan-gemma` (see .github/workflows/gemma-loops.yml).
//
// Gemma only ever writes suggestions into GitHub issues. It never merges,
// sends, charges or edits code; a person decides what ships.

export const DEFAULTS = {
  url: "http://192.168.254.10:1234",
  model: "google/gemma-4-e4b",
};

export const LABEL = "gemma";

export const FOOTER =
  "\n\n---\n_Drafted by Gemma (local model). Suggestions only: nothing here ships without a reviewed merge._";

/** Truth rules every prompt carries (docs/OPERATING_CHARTER.md, cold outreach rule 5). */
export const TRUTH_RULES = [
  "Never invent customers, testimonials, results, statistics, certifications, partnerships or urgency.",
  "Never change a price, plan name or what a plan includes; those come from src/lib/plans.ts.",
  "If you are unsure whether something is true, leave it out.",
].join(" ");

export function config(env = process.env) {
  return {
    url: (env.LOCAL_LLM_URL || DEFAULTS.url).replace(/\/+$/, ""),
    model: env.LOCAL_LLM_MODEL || DEFAULTS.model,
    dry: env.GEMMA_DRY_RUN === "true",
    repo: env.GITHUB_REPOSITORY,
    token: env.GITHUB_TOKEN,
  };
}

export function clip(text, max) {
  const s = String(text ?? "");
  return s.length > max ? `${s.slice(0, max)}\n[truncated]` : s;
}

/** Drop reasoning blocks some local models emit before the answer. */
export function stripThinking(text) {
  return String(text ?? "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .trim();
}

/** Visible text of a page, for a prompt. Not a sanitizer: the output is never rendered as HTML. */
export function htmlToText(html, max = 6000) {
  const text = String(html ?? "")
    .replace(/<script[\s\S]*?<\/script\s*>/gi, " ")
    .replace(/<style[\s\S]*?<\/style\s*>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/[<>]/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
  return clip(text, max);
}

/** One chat completion against LM Studio's OpenAI-compatible API. */
export async function chat({
  url,
  model,
  system,
  user,
  fetchImpl = fetch,
  timeoutMs = 180_000,
  maxTokens = 1400,
}) {
  const res = await fetchImpl(`${url}/v1/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model,
      temperature: 0.3,
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    throw new Error(`Gemma ${res.status}: ${body.slice(0, 200)}`);
  }
  const data = await res.json();
  const text = stripThinking(data?.choices?.[0]?.message?.content);
  if (!text) throw new Error("Gemma returned an empty answer");
  return text;
}

export async function gh(
  path,
  { method = "GET", token, body, raw = false } = {}
) {
  const res = await fetch(`https://api.github.com${path}`, {
    method,
    headers: {
      Accept: "application/vnd.github+json",
      Authorization: `Bearer ${token}`,
      "X-GitHub-Api-Version": "2022-11-28",
      "User-Agent": "authichain-gemma-loops",
      ...(body ? { "Content-Type": "application/json" } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok)
    throw new Error(
      `${method} ${path} -> ${res.status} ${(await res.text()).slice(0, 200)}`
    );
  if (raw) return res.text();
  return res.status === 204 ? null : res.json();
}

/** Keep exactly one open issue per loop: create it, or replace its body. */
export async function upsertIssue({ repo, token, title, body, label = LABEL }) {
  await gh(`/repos/${repo}/labels`, {
    method: "POST",
    token,
    body: { name: label, color: "5319e7" },
  }).catch(() => {});
  const open = await gh(
    `/repos/${repo}/issues?state=open&labels=${encodeURIComponent(label)}&per_page=50`,
    { token }
  );
  const existing = open.find(i => i.title === title);
  if (existing) {
    await gh(`/repos/${repo}/issues/${existing.number}`, {
      method: "PATCH",
      token,
      body: { body },
    });
    return { action: "updated", number: existing.number };
  }
  const created = await gh(`/repos/${repo}/issues`, {
    method: "POST",
    token,
    body: { title, body, labels: [label] },
  });
  return { action: "created", number: created.number };
}

export function say(md) {
  console.log(md);
}
