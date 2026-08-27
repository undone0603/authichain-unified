#!/usr/bin/env node
// Fails if any .github/workflows/*.yml sets `continue-on-error` at JOB level
// (as opposed to on an individual step). A job-level continue-on-error makes
// the whole job — every step in it — conclude success regardless of what
// happens inside, which is how deploy-workers.yml and gov-mint.yml went
// silently unable to fail (see the Blocker Register, Class-0 rows).
//
// Heuristic: within a `jobs:` block, a job name is a key at 2-space indent;
// `continue-on-error:` at exactly 4-space indent directly under it is job
// level. Anything indented deeper (under a `steps:` list item) is step
// level and is fine.

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";

const WORKFLOWS_DIR = join(process.cwd(), ".github", "workflows");

function checkFile(path) {
  const lines = readFileSync(path, "utf8").split("\n");
  const violations = [];
  let inJobs = false;
  let jobsIndent = -1;
  let currentJobIndent = -1;
  let currentJobName = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*#/.test(line) || line.trim() === "") continue;
    const indent = line.match(/^ */)[0].length;
    const trimmed = line.trim();

    if (/^jobs:\s*$/.test(trimmed) && indent === 0) {
      inJobs = true;
      jobsIndent = indent;
      continue;
    }
    if (!inJobs) continue;

    // A job name key sits one level under `jobs:`.
    if (indent === jobsIndent + 2 && /^[A-Za-z0-9_.-]+:/.test(trimmed)) {
      currentJobIndent = indent;
      currentJobName = trimmed.split(":")[0];
      continue;
    }

    // Job-level continue-on-error: exactly one level under the job name.
    if (
      currentJobName &&
      indent === currentJobIndent + 2 &&
      /^continue-on-error:\s*(true|\$\{\{)/.test(trimmed)
    ) {
      violations.push({ line: i + 1, job: currentJobName, text: trimmed });
    }
  }

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
    console.error(
      `${file}:${v.line}  job-level continue-on-error on job "${v.job}" — ${v.text}\n` +
        `  A job-level continue-on-error makes every step in the job report success` +
        ` unconditionally. Move it to the specific step that is allowed to fail` +
        ` (or a matrix entry via an input flag), never the whole job.`,
    );
  }
}

if (failed) {
  console.error(
    "\ncheck-workflow-continue-on-error: one or more workflows have a job that structurally cannot fail.",
  );
  process.exit(1);
}
console.log(
  `check-workflow-continue-on-error: OK (${files.length} workflow files scanned, no job-level continue-on-error found).`,
);
