#!/usr/bin/env node
// Fails if any .github/workflows/*.yml contains a structural "cannot fail"
// pattern. Two rules so far:
//
// 1. Job-level `continue-on-error`. Makes the whole job — every step in it —
//    conclude success regardless of what happens inside, which is how
//    deploy-workers.yml and gov-mint.yml went silently unable to fail
//    (see the Blocker Register, Class-0 rows).
//
// 2. `|| true` at the end of a shell command (a `run:` line, or a backslash-
//    continued command spanning several lines) outside an allowlisted idiom.
//    Swallows the real exit code of whatever ran before it, which is how
//    repo-maintenance.yml's Drizzle drift check passed green while its own
//    generator was failing (Blocker Register: "Drizzle schema ↔ migrations
//    drift check ... passes green when its generator fails").
//
// Heuristic for rule 1: within a `jobs:` block, a job name is a key at
// 2-space indent; `continue-on-error:` at exactly 4-space indent directly
// under it is job level. Anything indented deeper (under a `steps:` list
// item) is step level and is fine.
//
// Heuristic for rule 2: raw lines are first joined on backslash line
// continuation (`\` at end of line) into one logical command per statement,
// so a `curl ... \` / `-H "..." || true` pair on two lines is checked as one
// command, not two. Only the LAST segment of a `|` pipeline is what actually
// determines the exit code `|| true` is guarding (bash, no pipefail), so the
// allowlist match looks at the text after the final unescaped `|`, with any
// leading `VAR=$(` assignment/substitution wrapper stripped first.
//
// The allowlist is a list of leading commands, not file:line — line numbers
// rot on the next edit:
//   - grep, git diff, git fetch: non-zero means "no match", not failure
//     (content-routine-pr.yml)
//   - getent, dig: host-resolution fallbacks where "not found" is a valid
//     outcome to probe for (verify-scheduled-jobs.yml, pipeline-tick.yml,
//     browser-vision-tasks.yml)
//   - awk, tail: only ever appear here as the tail end of the same
//     getent/dig fallback pipelines (`getent ... | awk '{print $1; exit}'`,
//     `dig ... | tail -1`), extracting a field from output that may
//     legitimately be empty. They inherit the getent/dig idiom rather than
//     being a general-purpose allowlist entry — if awk/tail start appearing
//     in a *different* shape of pipeline, re-examine before trusting this.
//   - cat: dumping a diagnostic file that may legitimately not exist
//     (autonomous-business-cycle.yml)
//   - curl: best-effort pings using `-s -o /dev/null -w '%{http_code}'`,
//     which already never exits non-zero on an HTTP 4xx/5xx — the `|| true`
//     there is decorative, not a real failure-swallow (marketing-autonomous.yml
//     IndexNow ping). Allowlisted rather than removed: removing it changes
//     nothing (curl already returns 0 here), and keeping it documents the
//     intent for the next reader.
// Extend this list only with idioms that are genuinely non-fatal by
// construction — adding a new entry to make CI pass, without checking
// whether the command it guards can actually fail meaningfully, recreates
// exactly the defect this script exists to catch.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const WORKFLOWS_DIR = join(process.cwd(), ".github", "workflows");

const OR_TRUE_ALLOWLIST = [
  "grep",
  "git diff",
  "git fetch",
  "getent",
  "dig",
  "awk",
  "tail",
  "cat",
  "curl",
];

// Splits on shell pipe characters (a single `|`, never `||`), ignoring any
// `|` that appears inside a quoted string — e.g. the alternation pipes in
// `grep -vE '^(content/|docs/)'` are regex syntax, not shell pipes, and must
// not be mistaken for pipeline boundaries. Returns the last real segment,
// which is the one whose exit status `|| true` actually guards (bash, no
// pipefail).
function splitOnShellPipes(text) {
  const segments = [];
  let current = "";
  let quote = null; // null | "'" | '"'
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (quote) {
      current += ch;
      if (ch === quote) quote = null;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === "|") {
      if (text[i + 1] === "|") {
        // `||` — not a pipe boundary; consume both chars as-is.
        current += "||";
        i++;
        continue;
      }
      if (text[i - 1] === "|") {
        // second char of an `||` already consumed above; skip.
        continue;
      }
      segments.push(current);
      current = "";
      continue;
    }
    current += ch;
  }
  segments.push(current);
  return segments;
}

function lastPipelineSegment(text) {
  const parts = splitOnShellPipes(text);
  return parts[parts.length - 1].trim();
}

function isAllowlistedOrTrue(commandText) {
  const segment = lastPipelineSegment(commandText);
  const withoutAssignment = segment.replace(/^[A-Za-z_][A-Za-z0-9_]*=\$?\(?\s*/, "");
  return OR_TRUE_ALLOWLIST.some((cmd) => withoutAssignment.startsWith(cmd));
}

function checkFile(path) {
  const rawLines = readFileSync(path, "utf8").split("\n");
  const violations = [];

  // --- Pass 1: job tracking (rule 1) + a line -> current-job-name map used
  // by rule 2 for attribution. Job-level continue-on-error is always a
  // simple single-line key, so this stays on raw lines. ---
  let inJobs = false;
  let jobsIndent = -1;
  let currentJobIndent = -1;
  let currentJobName = null;
  const lineJobName = new Array(rawLines.length).fill(null);

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i];
    lineJobName[i] = currentJobName;
    if (/^\s*#/.test(line) || line.trim() === "") continue;
    const indent = line.match(/^ */)[0].length;
    const trimmed = line.trim();

    if (/^jobs:\s*$/.test(trimmed) && indent === 0) {
      inJobs = true;
      jobsIndent = indent;
      continue;
    }
    if (!inJobs) continue;

    if (indent === jobsIndent + 2 && /^[A-Za-z0-9_.-]+:/.test(trimmed)) {
      currentJobIndent = indent;
      currentJobName = trimmed.split(":")[0];
      lineJobName[i] = currentJobName;
      continue;
    }

    if (
      currentJobName &&
      indent === currentJobIndent + 2 &&
      /^continue-on-error:\s*(true|\$\{\{)/.test(trimmed)
    ) {
      violations.push({
        line: i + 1,
        job: currentJobName,
        text: trimmed,
        rule: "job-level-continue-on-error",
      });
    }
  }

  // --- Pass 2: rule 2, over backslash-continuation-joined logical lines. ---
  let i = 0;
  while (i < rawLines.length) {
    if (/^\s*#/.test(rawLines[i])) {
      i++;
      continue;
    }
    let joined = rawLines[i].replace(/\s*\\\s*$/, " ");
    let lastIndex = i;
    while (/\\\s*$/.test(rawLines[lastIndex])) {
      lastIndex++;
      if (lastIndex >= rawLines.length) break;
      joined += rawLines[lastIndex].trim().replace(/\s*\\\s*$/, " ");
    }
    const joinedTrimmed = joined.trim();

    if (/\|\|\s*true\s*\)?\s*$/.test(joinedTrimmed)) {
      const withoutOrTrue = joinedTrimmed.replace(/\|\|\s*true\s*\)?\s*$/, "").trim();
      if (!isAllowlistedOrTrue(withoutOrTrue)) {
        violations.push({
          line: lastIndex + 1,
          job: lineJobName[lastIndex] ?? "(top-level)",
          text: rawLines[lastIndex].trim(),
          rule: "or-true",
        });
      }
    }
    i = lastIndex + 1;
  }

  violations.sort((a, b) => a.line - b.line);
  return violations;
}

const files = readdirSync(WORKFLOWS_DIR).filter(
  (f) => f.endsWith(".yml") || f.endsWith(".yaml"),
);

let failed = false;
for (const file of files) {
  const path = join(WORKFLOWS_DIR, file);
  const violations = checkFile(path);
  for (const v of violations) {
    failed = true;
    if (v.rule === "job-level-continue-on-error") {
      console.error(
        `${file}:${v.line}  job-level continue-on-error on job "${v.job}" — ${v.text}\n` +
          `  A job-level continue-on-error makes every step in the job report success` +
          ` unconditionally. Move it to the specific step that is allowed to fail` +
          ` (or a matrix entry via an input flag), never the whole job.`,
      );
    } else {
      console.error(
        `${file}:${v.line}  unallowlisted '|| true' in "${v.job}" — ${v.text}\n` +
          `  This swallows the real exit code of whatever ran before it, so the step` +
          ` (and the job) reports success even when that command failed. If the command` +
          ` is genuinely non-fatal by construction, add its leading word to` +
          ` OR_TRUE_ALLOWLIST in scripts/check-workflow-cannot-fail.mjs with a comment` +
          ` explaining why — otherwise capture and check the real exit code instead.`,
      );
    }
  }
}

if (failed) {
  console.error(
    "\ncheck-workflow-cannot-fail: one or more workflows have a step or job that structurally cannot fail.",
  );
  process.exit(1);
}
console.log(
  `check-workflow-cannot-fail: OK (${files.length} workflow files scanned, no structural cannot-fail patterns found).`,
);
