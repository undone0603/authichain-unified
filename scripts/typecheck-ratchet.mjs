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
// The baseline also records a per-file, per-code census under `errors`, so a
// failure can name the pairs that actually regressed. Without it the count is
// all you get: "+2" among 355 errors, with no way to tell which 2, since the
// printed sample is just the first 20 errors in file order.
//
// tsconfig.worker.json needs roughly 5 GB; on a memory-tight machine run with
//   NODE_OPTIONS=--max-old-space-size=6144
// or tsc aborts (exit 134) and the ratchet fails closed rather than passing.
//
//   node scripts/typecheck-ratchet.mjs            check every program
//   node scripts/typecheck-ratchet.mjs --update   write counts + census

import { spawnSync } from "node:child_process";
import { appendFileSync, readFileSync, writeFileSync } from "node:fs";

export const BASELINE_FILE = ".github/typecheck-baseline.json";

/**
 * TS2589 ("type instantiation is excessively deep") depends on the order tsc
 * checks files in, so it comes and goes between otherwise identical runs.
 * Counting it would make the ratchet flaky, so it is left out.
 */
const ORDER_DEPENDENT = / error TS2589:/;

/** `path/to/file.ts(12,34): error TS2345: message` */
const ERROR_LINE = /^(?<file>[^(]+)\(\d+,\d+\): error (?<code>TS\d+):/;

/**
 * Pure. A per-file, per-code census of the errors in tsc output.
 *
 * The fingerprint deliberately omits line/column and the message text. Line
 * numbers shift whenever anything above them is edited, so including them
 * would report a whole file as "new" after an unrelated insertion; messages
 * carry type names that change with unrelated signature edits.
 *
 * @param {string} output
 * @returns {Record<string, number>} fingerprint -> how many times it occurs
 */
export function census(output) {
  /** @type {Record<string, number>} */
  const counts = {};
  for (const line of String(output ?? "").split("\n")) {
    if (ORDER_DEPENDENT.test(line)) continue;
    const m = ERROR_LINE.exec(line);
    if (!m) continue;
    const key = `${m.groups.file}|${m.groups.code}`;
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/**
 * Pure. Which fingerprints got worse, given a recorded census.
 *
 * This is what the count alone cannot tell you: a +2 could be two new errors,
 * or five new and three fixed. Only a census diff names them.
 *
 * @param {Record<string, number> | undefined} before
 * @param {Record<string, number>} after
 */
export function regressions(before, after) {
  const added = [];
  for (const [key, now] of Object.entries(after)) {
    const was = before?.[key] ?? 0;
    if (now > was) added.push({ key, was, now });
  }
  return added.sort((a, b) => a.key.localeCompare(b.key));
}

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
    if (update) {
      // A crashed or syntax-aborted run sees almost nothing; recording it
      // would bake a falsely-clean baseline in and blind the ratchet.
      if (status === null || result.syntax.length || (status !== 0 && result.count === 0)) {
        summary(`- REFUSED \`${project}\`: ${result.reason} - baseline left alone`);
        failed++;
        continue;
      }
      baseline.projects[project] = result.count;
      baseline.errors = baseline.errors ?? {};
      baseline.errors[project] = census(output);
      const pairs = Object.keys(baseline.errors[project]).length;
      summary(
        `- recorded \`${project}\`: ${result.count} errors across ${pairs} file/code pair(s)`
      );
      continue;
    }
    const mark = result.ok ? "ok" : "FAIL";
    summary(`- ${mark} \`${project}\`: ${result.reason}`);
    for (const l of result.syntax.slice(0, 10)) summary(`  - ${l}`);
    if (!result.ok) {
      failed++;
      const recorded = baseline.errors?.[project];
      const worse = regressions(recorded, census(output));
      if (recorded && worse.length) {
        // The errors that actually got worse, not the first 20 of hundreds.
        summary(`  ${worse.length} file/code pair(s) regressed:`);
        for (const { key, was, now } of worse.slice(0, 20)) {
          const [file, code] = key.split("|");
          summary(`  - ${file}: ${code} ${was} -> ${now}`);
          for (const l of output
            .split("\n")
            .filter(x => x.startsWith(`${file}(`) && x.includes(` error ${code}:`))
            .slice(0, 3))
            console.log(`      ${l}`);
        }
      } else {
        // No census recorded for this project yet (or a syntax error collapsed
        // the output): fall back to a sample, and say so rather than implying
        // these are the new ones.
        summary(
          recorded
            ? "  no file/code pair regressed - the count moved within recorded pairs"
            : `  no census recorded for this project; run --update on a green main. Sample of all errors:`
        );
        for (const l of output
          .split("\n")
          .filter(x => / error TS\d+:/.test(x))
          .slice(0, 20))
          console.log(`    ${l}`);
      }
    }
  }
  if (update) {
    writeFileSync(BASELINE_FILE, `${JSON.stringify(baseline, null, 2)}\n`);
    console.log(`wrote ${BASELINE_FILE}`);
    // Non-zero if any project was refused above, so a half-written baseline
    // cannot be committed from a green-looking run.
    return failed ? 1 : 0;
  }
  return failed ? 1 : 0;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  process.exit(main(process.argv.slice(2)));
}
