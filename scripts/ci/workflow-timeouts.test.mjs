import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

const WORKFLOWS_DIR = join(process.cwd(), ".github", "workflows");

/**
 * Jobs under a top-level `jobs:` map. A job-level `timeout-minutes` is the
 * key at exactly two spaces deeper than the job id (the same indent as
 * `runs-on` / `steps` / `uses`). A step-level timeout is deeper and does
 * not count. Job-level `uses:` marks a reusable-workflow caller; GitHub
 * does not allow timeout-minutes on those jobs.
 */
export function listWorkflowJobs(source) {
  const lines = source.split(/\r?\n/);
  let inJobs = false;
  let jobsIndent = 0;
  let current = null;
  const jobs = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (/^\s*#/.test(line) || line.trim() === "") continue;
    const indent = line.match(/^ */)[0].length;
    const trimmed = line.trim();
    if (!inJobs) {
      if (/^jobs:\s*$/.test(trimmed) && indent === 0) {
        inJobs = true;
        jobsIndent = indent;
      }
      continue;
    }
    if (indent === jobsIndent + 2 && /^[A-Za-z0-9_.-]+:/.test(trimmed)) {
      current = {
        id: trimmed.split(":")[0],
        timeout: null,
        uses: null,
        line: i + 1,
      };
      jobs.push(current);
      continue;
    }
    if (current && indent === jobsIndent + 4) {
      if (/^timeout-minutes:\s*\S+/.test(trimmed)) {
        current.timeout = trimmed.slice("timeout-minutes:".length).trim();
      } else if (/^uses:\s*\S+/.test(trimmed)) {
        current.uses = trimmed.slice("uses:".length).trim();
      }
    }
  }
  return jobs;
}

export function jobNeedsTimeout(job) {
  return !job.uses;
}

test("scanner ignores step-level timeout-minutes and requires a job-level key", () => {
  const missing = listWorkflowJobs(`
name: example
jobs:
  extras:
    runs-on: ubuntu-24.04
    steps:
      - name: Install
        timeout-minutes: 15
        run: pnpm install
`);
  assert.equal(missing.length, 1);
  assert.equal(missing[0].id, "extras");
  assert.equal(missing[0].timeout, null);

  const present = listWorkflowJobs(`
jobs:
  extras:
    timeout-minutes: 30
    steps:
      - run: echo
  called:
    needs: extras
    uses: ./.github/workflows/other.yml
`);
  assert.deepEqual(
    present.map(job => [job.id, job.timeout, job.uses, jobNeedsTimeout(job)]),
    [
      ["extras", "30", null, true],
      ["called", null, "./.github/workflows/other.yml", false],
    ]
  );
});

test("every runner job in .github/workflows has timeout-minutes", () => {
  const files = readdirSync(WORKFLOWS_DIR).filter(
    name => name.endsWith(".yml") || name.endsWith(".yaml")
  );
  assert.ok(files.length > 0, "expected workflow files");
  const missing = [];
  for (const file of files) {
    const jobs = listWorkflowJobs(
      readFileSync(join(WORKFLOWS_DIR, file), "utf8")
    );
    assert.ok(jobs.length > 0, `${file} has no jobs`);
    for (const job of jobs) {
      if (jobNeedsTimeout(job) && !job.timeout) {
        missing.push(`${file} / ${job.id} (line ${job.line})`);
      }
    }
  }
  assert.deepEqual(missing, [], missing.join("\n"));
});
