/**
 * Decide whether a failed CI run may be auto-repaired.
 * Green-after-repair is not enough to merge. This only classifies.
 */

const DENY_PATHS = [
  /^supabase\/migrations\//,
  /^drizzle\/migrations\//,
  /^\.github\/workflows\/.+\.yml$/,
  /CODEOWNERS$/,
  /vercel\.json$/,
];

const DENY_PATCH = [
  /permissions:\s*\n(?:[^\n]*\n)*?\s+(contents|id-token|actions):\s+write/i,
  /continue-on-error:\s*true/,
  /if:\s*false/,
];

const TEST_DELETE = /^diff --git a\/(.+\.test\.(?:ts|tsx|js|mjs)) b\/\/dev\/null/m;

/**
 * @param {{ files?: string[], patch?: string, jobName?: string, logExcerpt?: string }} input
 */
export function classifyRepair(input) {
  const files = input.files ?? [];
  const patch = input.patch ?? "";

  if (TEST_DELETE.test(patch) || files.some((f) => f.includes(".test.") && patch.includes("deleted file"))) {
    return { safe: false, reason: "refuses to delete tests" };
  }
  if (files.some((f) => DENY_PATHS.some((re) => re.test(f)))) {
    return { safe: false, reason: "touches migrations, workflows, CODEOWNERS, or vercel.json" };
  }
  if (DENY_PATCH.some((re) => re.test(patch))) {
    return { safe: false, reason: "would weaken permissions or disable a check" };
  }
  if (/vercel\s+deploy|wrangler deploy/i.test(patch)) {
    return { safe: false, reason: "deploy commands are out of bounds" };
  }

  const lintish =
    /prettier|eslint|lint/i.test(input.jobName ?? "") ||
    /prettier|eslint/i.test(input.logExcerpt ?? "") ||
    files.every((f) => /\.(ts|tsx|js|mjs|md|css)$/.test(f));

  if (lintish && files.length > 0 && files.length <= 20) {
    return {
      safe: true,
      kind: "format_lint",
      reason: "deterministic lint/format autofix only; still requires human merge",
    };
  }

  return { safe: false, reason: "ambiguous failure — escalate" };
}
