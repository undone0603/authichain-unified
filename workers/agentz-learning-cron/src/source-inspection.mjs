/**
 * Bounded, public-only, non-executing code-pattern inspections.
 * Static heuristics are NOT vulnerability findings or formal verification.
 */
export const SOURCE_TARGETS = Object.freeze([
  Object.freeze({
    id: "dpp-payment-activation",
    path: "src/lib/dpp-activate.ts",
    url: "https://raw.githubusercontent.com/undone0603/authichain-unified/main/src/lib/dpp-activate.ts",
    checks: Object.freeze(["paid_and_complete_guard", "exact_dpp_price_guard"]),
  }),
  Object.freeze({
    id: "a2a-task-isolation",
    path: "src/lib/a2a-jsonrpc.ts",
    url: "https://raw.githubusercontent.com/undone0603/authichain-unified/main/src/lib/a2a-jsonrpc.ts",
    checks: Object.freeze(["no_implicit_global_task_store", "ephemeral_default_task_store"]),
  }),
]);
export const SOURCE_MAX_BYTES = 96 * 1024;
const SAFE_SOURCE_HOST = "raw.githubusercontent.com";
const PUBLIC_SOURCE_PREFIX =
  "https://raw.githubusercontent.com/undone0603/authichain-unified/main/";
const EVIDENCE_STATES = new Set(["check_present", "review_candidate"]);

/** Never follow an arbitrary URL or scan a file outside the allowlist. */
export function validateSourceTarget(target) {
  if (!SOURCE_TARGETS.some(t =>
    t.id === target?.id && t.path === target.path && t.url === target.url &&
    Array.isArray(target.checks) && target.checks.length === t.checks.length &&
    target.checks.every((id, i) => id === t.checks[i])
  )) return false;
  try {
    const u = new URL(target.url);
    return u.protocol === "https:" && u.hostname === SAFE_SOURCE_HOST &&
      !u.username && !u.password && !u.search && !u.hash &&
      (u.port === "" || u.port === "443") && target.url.startsWith(PUBLIC_SOURCE_PREFIX);
  } catch {
    return false;
  }
}

/**
 * Detect the presence of deliberately narrow controls. Findings always
 * require code-owner review and real tests. Never return source text.
 */
export function inspectSourceText(target, text) {
  if (!validateSourceTarget(target) || typeof text !== "string" ||
      new TextEncoder().encode(text).length > SOURCE_MAX_BYTES)
    throw new Error("Source inspection input rejected");
  const rules = {
    paid_and_complete_guard:
      /session\.payment_status\s*!==\s*["']paid["']\s*\|\|\s*session\.status\s*!==\s*["']complete["']/,
    exact_dpp_price_guard:
      /lineItems\[0\]\?\.price\?\.id\s*!==\s*DPP_PRICE_ID/,
    no_implicit_global_task_store:
      /const\s+defaultStore\s*=\s*memoryA2aStore\s*\(/,
    ephemeral_default_task_store:
      /const\s+store\s*=\s*opts\.store\s*\?\?\s*memoryA2aStore\s*\(/,
  };
  const checks = target.checks.map(id => {
    const matched = rules[id].test(text);
    // This is an absence rule, unlike the other controls.
    const present = id === "no_implicit_global_task_store" ? !matched : matched;
    return { id, state: present ? "check_present" : "review_candidate" };
  });
  if (checks.some(x => !EVIDENCE_STATES.has(x.state)))
    throw new Error("Invalid fixed inspection result");
  return {
    source: target.id,
    reference: "public_main_not_revision_pinned",
    evidence_state: checks.some(x => x.state === "review_candidate") ?
      "review_candidate" : "patterns_present_unverified",
    checks,
    independent_validation_proven: false,
    executable_code_run: false,
    automated_remediation: false,
  };
}

async function readBoundedSource(response) {
  if (!response.ok) throw new Error("Public source unavailable");
  if (response.url && new URL(response.url).hostname !== SAFE_SOURCE_HOST)
    throw new Error("Unexpected source redirect");
  const reader = response.body?.getReader();
  if (!reader) throw new Error("Source body missing");
  const chunks = [];
  let count = 0;
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      count += value.byteLength;
      if (count > SOURCE_MAX_BYTES) {
        await reader.cancel();
        throw new Error("Source size limit");
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(count);
  let offset = 0;
  for (const part of chunks) {
    bytes.set(part, offset);
    offset += part.byteLength;
  }
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

/** No tokens, no repo writes, no arbitrary URLs, no raw source in output. */
export async function inspectPublicSources(fetcher = fetch) {
  const results = [];
  for (const target of SOURCE_TARGETS) {
    try {
      if (!validateSourceTarget(target)) throw new Error("Disallowed target");
      const response = await fetcher(target.url, {
        method: "GET",
        headers: { Accept: "text/plain", "User-Agent": "AuthiChain-AgentZ-Edge-ReadOnly/0.2" },
      });
      const text = await readBoundedSource(response);
      results.push(inspectSourceText(target, text));
    } catch {
      results.push({
        source: target.id, evidence_state: "coverage_unknown",
        checks: target.checks.map(id => ({ id, state: "not_evaluated" })),
        independent_validation_proven: false, executable_code_run: false,
        automated_remediation: false,
      });
    }
  }
  return results;
}
