/**
 * Classify a git branch / PR against main.
 * Green checks are ignored here — classification never treats "passing CI"
 * as mergeable by itself.
 */

export const CLASSES = [
  "already_merged",
  "duplicate_superseded",
  "vercel_excluded",
  "mergeable",
  "needs_human",
];

const VERCEL_DEPLOY_RE =
  /vercel\s+deploy|vercel\s+--prod|amondnet\/vercel-action|vercel\/action/i;

const HUMAN_PATHS = [
  /^supabase\/migrations\//,
  /^\.github\/workflows\//,
  /^src\/lib\/plans\.ts$/,
  /^src\/lib\/dpp-verify\.ts$/,
  /^packages\/verifier\//,
  /^src\/app\/api\/stripe\//,
  /^src\/app\/api\/checkout\//,
];

/**
 * @param {{
 *   merged?: boolean
 *   commitsOnMain?: boolean
 *   files?: string[]
 *   patch?: string
 *   title?: string
 *   draft?: boolean
 *   requiredChecksGreen?: boolean
 * }} input
 */
export function classifyBranch(input) {
  const files = input.files ?? [];
  const patch = input.patch ?? "";
  const title = (input.title ?? "").toLowerCase();

  if (input.merged) {
    return { class: "already_merged", action: "close_delete", reason: "already merged into main" };
  }
  if (input.commitsOnMain) {
    return {
      class: "duplicate_superseded",
      action: "close_delete",
      reason: "all commits already on main",
    };
  }

  const vercelHit =
    files.some((f) => /vercel\.json$/.test(f) && /deploy/i.test(patch)) ||
    VERCEL_DEPLOY_RE.test(patch) ||
    /deploy to vercel/.test(title);
  if (vercelHit) {
    return {
      class: "vercel_excluded",
      action: "exclude",
      reason: "Vercel deploy path — Cloudflare is the deploy authority",
    };
  }

  const needsHuman = files.some((f) => HUMAN_PATHS.some((re) => re.test(f)));
  if (needsHuman) {
    return {
      class: "needs_human",
      action: "stop_request_decision",
      reason: "touches security, revenue, schema, or workflow files",
    };
  }

  const small = files.length > 0 && files.length <= 8;
  if (small && !input.draft) {
    return {
      class: "mergeable",
      action: "pr_human_merge",
      reason: "small independent change; green checks are not sufficient to auto-merge",
    };
  }

  return {
    class: "needs_human",
    action: "stop_request_decision",
    reason: "ambiguous scope or draft — escalate",
  };
}
