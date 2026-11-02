/**
 * AgentZ Edge Learning Watch — isolated zero-credential Cloudflare Cron Worker.
 *
 * This is NOT the Python AgentZ daemon, identity verifier, customer-agent,
 * payment processor or authority to outreach. Public metadata is untrusted.
 */
export const VERSION = "0.1.0";
export const ALARM_INTERVAL_MS = 6 * 60 * 60 * 1000;
export const SOURCES = Object.freeze([
  { label: "authichain-alliance", owner: "undone0603", repo: "authichain-unified", issue: 2263 },
  { label: "cedr-guard", owner: "Sheernox", repo: "cedr", issue: 7 },
]);
const OWNER_ALIASES = new Set(["undone0603", "authichain", "agentz"]);
const MAX_BYTES = 128 * 1024;
const MAX_ITEMS = 30;

function normalizeAuthor(value) {
  if (typeof value !== "string" || value.length > 70) return null;
  const author = value.toLowerCase();
  const base = author.endsWith("[bot]") ? author.slice(0, -5) : author;
  return /^[a-z0-9_-]{1,64}$/.test(base) ? author : null;
}

/** All external feedback remains unverified; never promote a claimed pass. */
export function classifyComments(comments, source) {
  if (!Array.isArray(comments) || comments.length > MAX_ITEMS) {
    throw new Error("Unbounded comment payload");
  }
  let self = 0, bot = 0, external = 0, skipped = 0;
  const ids = new Set();
  for (const entry of comments) {
    const author = normalizeAuthor(entry?.user?.login);
    const id = entry?.id;
    if (!Number.isSafeInteger(id) || id < 1 || ids.has(id) || !author) {
      skipped++;
      continue;
    }
    ids.add(id);
    if (OWNER_ALIASES.has(author) || author === source.owner.toLowerCase()) self++;
    else if (author.endsWith("[bot]") || author.endsWith("-bot") ||
             entry?.user?.type === "Bot") bot++;
    else external++;
  }
  return {
    source: source.label, scanned: comments.length, unique: ids.size,
    external_feedback_candidates: external, self_comments: self,
    automated_comments: bot, skipped,
    independent_test_passes: 0, partnerships: 0,
    evidence_state: "public_feedback_unverified",
    next_action: external ? "request_or_reproduce_version_pinned_test"
                         : "await_independent_feedback",
  };
}

async function readBoundedJson(response) {
  if (!response.ok) throw new Error("GitHub public read unavailable");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Empty GitHub response");
  const chunks = [];
  let size = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > MAX_BYTES) {
        await reader.cancel();
        throw new Error("Public data exceeds read cap");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let off = 0;
  for (const chunk of chunks) { bytes.set(chunk, off); off += chunk.byteLength; }
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function observe(fetcher = fetch) {
  const results = [];
  for (const source of SOURCES) {
    const url = `https://api.github.com/repos/${source.owner}/${source.repo}/issues/${source.issue}/comments?per_page=${MAX_ITEMS}`;
    let failureCategory = "transport_failure";
    try {
      // Minimal native Worker fetch options; avoid runtime-specific
      // AbortSignal.timeout or redirect rejection on public GitHub requests.
      const res = await fetcher(url, {
        method: "GET",
        headers: { "Accept": "application/vnd.github+json",
                   "User-Agent": "AuthiChain-AgentZ-Edge-ReadOnly/0.1" },
      });
      if (!res.ok) {
        failureCategory = res.status === 403 || res.status === 429
          ? "upstream_rate_limit_or_denied"
          : res.status === 404 ? "upstream_not_found"
          : "upstream_http_failure";
        throw new Error("Upstream refused public metadata read");
      }
      failureCategory = "body_read_or_json_failure";
      const rows = await readBoundedJson(res);
      failureCategory = "invalid_comment_schema";
      results.push(classifyComments(rows, source));
    } catch (error) {
      // Report only fixed category names, never exception contents, URLs,
      // headers, request metadata, or untrusted text.
      results.push({
        source: source.label, evidence_state: "coverage_unknown",
        failure_category: failureCategory,
        error_class: ["TypeError", "AbortError", "TimeoutError", "NetworkError"]
          .includes(error?.name) ? error.name : "other",
        external_feedback_candidates: null, independent_test_passes: 0,
        next_action: "retry_later_without_outbound",
      });
    }
  }
  return {
    schema: "agentz.edge-learning.v1", version: VERSION,
    observed_at_utc: new Date().toISOString(), sources: results,
    independent_validation_proven: false, outbound_enabled: false,
    payment_enabled: false, deployment_enabled: false,
  };
}

export function selfTest() {
  const s = { label: "synthetic", owner: "undone0603" };
  const result = classifyComments([
    { id: 1, user: { login: "undone0603" } },
    { id: 2, user: { login: "vSkilled", type: "User" } },
    { id: 3, user: { login: "automated-bot", type: "Bot" } },
    { id: 3, user: { login: "automated-bot", type: "Bot" } },
  ], s);
  return result.self_comments === 1 &&
         result.external_feedback_candidates === 1 &&
         result.automated_comments === 1 &&
         result.independent_test_passes === 0 &&
         result.partnerships === 0;
}

/**
 * SQLite-backed Durable Object Alarm. Exactly one named instance is used.
 * No Cron Trigger or long-running container required.
 */
export class AgentZLearningAlarm {
  constructor(ctx, env) { this.ctx = ctx; this.env = env; }

  async fetch(request) {
    if (request.method !== "GET") return new Response("Not allowed", { status: 405 });
    const prior = await this.ctx.storage.getAlarm();
    if (prior === null) {
      // Repeated health checks do not multiply or reschedule existing alarms.
      await this.ctx.storage.setAlarm(Date.now() + 15_000);
    }
    const last = await this.ctx.storage.get("last_report") ?? null;
    // One bounded retry per UTC day after an entirely unknown observation.
    // Health never triggers an immediate network request and cannot create
    // an unbounded polling loop or bypass the six-hour schedule.
    if (last?.sources?.length &&
        last.sources.every(x => x.evidence_state === "coverage_unknown")) {
      const retryKey = "unknown_retry_diagnostic_v3_" + new Date().toISOString().slice(0, 10);
      if (!(await this.ctx.storage.get(retryKey))) {
        await this.ctx.storage.put(retryKey, true);
        await this.ctx.storage.setAlarm(Date.now() + 15_000);
      }
    }
    return Response.json({
      alarm_armed: (await this.ctx.storage.getAlarm()) !== null,
      next_alarm_utc: new Date(await this.ctx.storage.getAlarm()).toISOString(),
      last_report: last,
    }, { headers: { "Cache-Control": "no-store" } });
  }

  async alarm() {
    let report;
    try {
      report = await observe();
    } catch {
      report = {
        schema: "agentz.edge-learning.v1",
        observed_at_utc: new Date().toISOString(),
        sources: [],
        evidence_state: "coverage_unknown",
        independent_validation_proven: false,
      };
    }
    const status = {
      observed_at_utc: report.observed_at_utc,
      sources: report.sources.map(x => ({
        source: x.source, evidence_state: x.evidence_state,
        failure_category: x.failure_category ?? null,
        error_class: x.error_class ?? null,
        external_feedback_candidates: x.external_feedback_candidates,
        independent_test_passes: 0,
      })),
      independent_validation_proven: false,
      outbound_enabled: false,
      payment_enabled: false,
    };
    await this.ctx.storage.put("last_report", status);
    await this.ctx.storage.setAlarm(Date.now() + ALARM_INTERVAL_MS);
    console.log(JSON.stringify({ event: "agentz_edge_alarm", ...status }));
  }
}

export default {
  async fetch(request, env) {
    const path = new URL(request.url).pathname;
    if (request.method !== "GET") return new Response("Method not allowed", { status: 405 });
    if (path === "/health" || path === "/status") {
      try {
        const id = env.AGENTZ_LEARNING_ALARM.idFromName("singleton");
        const stub = env.AGENTZ_LEARNING_ALARM.get(id);
        const state = await (await stub.fetch("https://internal/health")).json();
        return Response.json({
          service: "agentz-edge-learning", version: VERSION,
          scheduler: "durable_object_alarm_6h", ...state,
          read_only: true, requires_secrets: false, underlying_python_daemon: false,
        }, { headers: { "Cache-Control": "no-store" } });
      } catch {
        return Response.json({ service: "agentz-edge-learning",
          scheduler: "unavailable", alarm_armed: false }, { status: 503 });
      }
    }
    if (path === "/self-test") {
      return Response.json({
        service: "agentz-edge-learning", passed: selfTest(),
        type: "synthetic_classifier_only", network_called: false,
      }, { headers: { "Cache-Control": "no-store" } });
    }
    return new Response("Not found", { status: 404 });
  },
};
