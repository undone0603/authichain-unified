#!/usr/bin/env node
// scripts/typecheck-ratchet.mjs
//
// CI Main's `pnpm check` runs `turbo run check --filter=!.`, which skips the
// root package, so the root program (scripts/, server/, src/), the Workers and
// the edge router were never typechecked in CI. That is how
// scripts/b2b-cold-outreach.ts stopped parsing on main (#1208) without a red
// check, and why hundreds of type errors built up unseen.
//
// This is a ratchet, not a cleanup: each program may not get worse than the
// count in .github/typecheck-baseline.json, and a syntax error (TS1xxx)
// always fails, because tsc stops at one and reports nothing else.
// When a count drops, lower the baseline in the same PR.
//
//   node scripts/typecheck-ratchet.mjs            check every program
//   node scripts/typecheck-ratchet.mjs --update   write current counts

import { spawnSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

export const BASELINE_FILE = ".github/typecheck-baseline.json";

/**
 * TS2589 ("type instantiation is excessively deep") depends on the order tsc
 * checks files in, so it comes and goes between otherwise identical runs.
 * Counting it would make the ratchet flaky, so it is left out.
 */
const ORDER_DEPENDENT = / error TS2589:/;

/**
 * Pure. Count errors in tsc --pretty false output and judge them.
 * `status` is tsc's exit code (null when it was killed). A run that didn't
 * finish, or exited non-zero without reporting a single error (a crash, or
 * running out of memory), fails: a check that can't see must not pass.
 *
 * @param {string} output
 * @param {number} max
 * @param {number | null} [status]
 */
export function evaluate(output, max, status = 0) {
  const lines = String(output ?? "").split("\n");
  const errors = lines.filter(
    l => / error TS\d+:/.test(l) && !ORDER_DEPENDENT.test(l)
  );
  const syntax = errors.filter(l => / error TS1\d{3}:/.test(l));
  const count = errors.length;
  if (status === null) {
    return {
      ok: false,
      count,
      syntax,
      reason: "tsc was killed before it finished",
    };
  }
  if (
    status !== 0 &&
    count === 0 &&
    !lines.some(l => / error TS2589:/.test(l))
  ) {
    return {
      ok: false,
      count,
      syntax,
      reason: `tsc exited ${status} without reporting errors (crash or out of memory)`,
    };
  }
  if (syntax.length) {
    return {
      ok: false,
      count,
      syntax,
      reason: "syntax error: tsc stops here and checks nothing else",
    };
  }
  if (count > max) {
    return {
      ok: false,
      count,
      syntax,
      reason: `${count} errors, baseline ${max} (+${count - max})`,
    };
  }
  return {
    ok: true,
    count,
    syntax,
    reason:
      count < max
        ? `${count} errors, baseline ${max}: lower the baseline to ${count}`
        : `${count} errors, at baseline`,
  };
}

function runTsc(project) {
  const r = spawnSync(
    "npx",
    ["tsc", "-p", project, "--noEmit", "--pretty", "false"],
    {
      encoding: "utf8",
      maxBuffer: 64 * 1024 * 1024,
    }
  );
  return { output: `${r.stdout ?? ""}${r.stderr ?? ""}`, status: r.status };
}

function summary(line) {
  console.log(line);
  if (process.env.GITHUB_STEP_SUMMARY)
    appendFileSync(process.env.GITHUB_STEP_SUMMARY, `${line}\n`);
}

function main(argv) {
  const baseline = JSON.parse(readFileSync(BASELINE_FILE, "utf8"));
  const update = argv.includes("--update");
  let failed = 0;
  for (const [project, max] of Object.entries(baseline.projects)) {
    const { output, status } = runTsc(project);
    const result = evaluate(output, max, status);
    if (update) baseline.projects[project] = result.count;
    if (update) {
      summary(`- recorded \`${project}\`: ${result.count} errors`);
      continue;
    }
    const mark = result.ok ? "ok" : "FAIL";
    summary(`- ${mark} \`${project}\`: ${result.reason}`);
    for (const l of result.syntax.slice(0, 10)) summary(`  - ${l}`);
    if (!result.ok) {
      failed++;
      // New errors are the ones to look at; print the first few.
      for (const l of output
        .split("\n")
        .filter(x => / error TS\d+:/.test(x))
        .slice(0, 20))
        console.log(`    ${l}`);
    }
  }
  if (update) {
    writeFileSync(BASELINE_FILE, `${JSON.stringify(baseline, null, 2)}\n`);
    console.log(`wrote ${BASELINE_FILE}`);
    return 0;
  }
  return failed ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
