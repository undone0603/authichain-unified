import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { test } from "node:test";

// Keep publishing outside ordinary main pushes and workflow maintenance.
// A separately authorized workflow_dispatch remains available.
const paths = [
  ".github/workflows/deploy-qron-space.yml",
  ".github/workflows/deploy-first-dollar-desk.yml",
];

for (const path of paths) {
  test(path + " cannot auto-publish from a push", () => {
    const source = readFileSync(join(process.cwd(), path), "utf8");
    const onBlock = source.match(/^on:\n([\s\S]*?)(?=^(?:permissions|concurrency|jobs):)/m)?.[1];
    assert.ok(onBlock, "expected an explicit workflow trigger block");
    assert.match(onBlock, /^  workflow_dispatch:\s*$/m);
    assert.doesNotMatch(onBlock, /^  (?:push|pull_request|schedule|workflow_run|repository_dispatch):/m);

    const deployJob = source.match(/^jobs:\n  deploy:\n([\s\S]*)$/m)?.[1];
    assert.ok(deployJob, "expected a deploy job");
    assert.match(deployJob, /^    if: github\.event_name == 'workflow_dispatch'\s*$/m);
    assert.match(deployJob, /(?:wrangler(?:@\d[\d.]*)?\s+deploy|wrangler(?:@\d[\d.]*)?\s+versions\s+upload|npx\s+wrangler\s+deploy|npx\s+--yes\s+wrangler@\S+\s+versions\s+upload)/);
  });
}
