import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import {
  CANARY_WORKER,
  SKIP_BY_DEFAULT,
  diffRange,
  plan,
  splitDiff,
  workersToBuild,
} from "./build-workers.mjs";

const buildable = [
  "authichain-agentz",
  "authichain-com",
  "first-dollar-desk",
  "govchain-us",
  "gs1-resolver",
  "passport-demo",
  "qron-portfolio",
  "qron-space",
  "strainchain-io",
];

test("a full dispatch skips Containers and the archived workers", () => {
  const names = workersToBuild(buildable, null);
  assert.deepEqual(names, [
    "authichain-com",
    "govchain-us",
    "gs1-resolver",
    "qron-space",
    "strainchain-io",
  ]);
  for (const skipped of SKIP_BY_DEFAULT) {
    assert.equal(names.includes(skipped), false, skipped);
  }
});

test("a diff builds only the worker it touches, including an archived one", () => {
  assert.deepEqual(workersToBuild(buildable, ["passport-demo"]), [
    "passport-demo",
  ]);
});

test("a workers/_shared diff builds the sisters that import it", () => {
  // authichain-com is a protected manual release, not a _shared consumer.
  assert.deepEqual(workersToBuild(buildable, ["_shared"]), [
    "govchain-us",
    "qron-space",
    "strainchain-io",
  ]);
});

test("a tooling-only diff builds the canary", () => {
  const diff = splitDiff(["scripts/ci/build-workers.mjs"]);
  assert.equal(diff.toolingChanged, true);
  assert.deepEqual(diff.workerDirs, []);
  assert.deepEqual(
    workersToBuild(buildable, diff.workerDirs, {
      toolingChanged: diff.toolingChanged,
    }),
    [CANARY_WORKER]
  );
});

test("an empty diff with no tooling change builds nothing", () => {
  assert.deepEqual(workersToBuild(buildable, []), []);
});

test("a named dispatch that is not buildable is empty so the caller can fail", () => {
  assert.deepEqual(
    plan({
      event: "workflow_dispatch",
      dispatchWorker: "not-a-worker",
      paths: [],
      buildable,
    }),
    []
  );
});

test("a blank dispatch builds the default set", () => {
  const names = plan({
    event: "workflow_dispatch",
    dispatchWorker: "  ",
    paths: [],
    buildable,
  });
  assert.equal(names.includes("authichain-agentz"), false);
  assert.equal(names.includes("gs1-resolver"), true);
});

test("a pull request plan follows the diff, not the whole tree", () => {
  assert.deepEqual(
    plan({
      event: "pull_request",
      paths: ["workers/gs1-resolver/src/index.ts", "README.md"],
      buildable,
    }),
    ["gs1-resolver"]
  );
});

test("diff ranges match the event", () => {
  assert.equal(diffRange("workflow_dispatch"), null);
  assert.deepEqual(diffRange("pull_request"), ["FETCH_HEAD", "HEAD"]);
  assert.deepEqual(diffRange("push", { before: "abc123" }), ["abc123", "HEAD"]);
  assert.deepEqual(diffRange("push", { before: "0000000" }), ["HEAD~1", "HEAD"]);
});

test("Worker dry-run uses supported step workdirs and lockfile cache path", () => {
  const workflow = readFileSync(".github/workflows/build-workers.yml", "utf8");
  const checkout = "worker-build-" + "$" + "{{ github.run_id }}-" + "$" + "{{ github.run_attempt }}";
  assert.ok(!workflow.includes("    defaults:\n      run:\n        working-directory:"));
  assert.ok(workflow.includes("path: " + checkout));
  for (const name of ["Verify isolated checkout","Fetch pull request base","Install dependencies","Compile changed workers"]) {
    const expected = "- name: " + name + "\n        working-directory: " +
      "$" + "{{ github.workspace }}/" + checkout;
    assert.ok(workflow.includes(expected), name);
  }
  assert.ok(workflow.includes("cache-dependency-path: " + checkout + "/pnpm-lock.yaml"));
  // Hosted ubuntu-24.04 is billing-locked. This compile job opts into ops via
  // AUTHICHAIN_CI_SELF_HOSTED and falls back to ubuntu-24.04. It does not use
  // a hard-coded self-hosted list. The isolation-attested apply gate lives on
  // autonomy-reconcile, not this dry-run.
  assert.ok(
    workflow.includes(
      "vars.AUTHICHAIN_CI_SELF_HOSTED == 'true' && fromJSON(" +
        `'["self-hosted","Linux","ARM64","authichain-ops"]'` +
        ") || 'ubuntu-24.04'"
    )
  );
  assert.equal(/^\s*runs-on:\s*\[self-hosted/m.test(workflow), false);
  const reconcile = readFileSync(".github/workflows/autonomy-reconcile.yml", "utf8");
  assert.ok(
    reconcile.includes(
      "github.event_name != 'pull_request' && github.ref == 'refs/heads/main' && vars.AUTHICHAIN_OPS_ISOLATION_ATTESTED == 'true'"
    )
  );
  assert.ok(!workflow.includes("/home/zac"));
  assert.ok(!workflow.includes("secrets.CLOUDFLARE_"));
});

test("Worker compilation clears Cloudflare credentials when spawning Wrangler", () => {
  const source = readFileSync("scripts/ci/build-workers.mjs", "utf8");
  assert.ok(source.includes('"--dry-run",'));
  assert.ok(source.includes('CLOUDFLARE_API_TOKEN: ""'));
  assert.ok(source.includes('CLOUDFLARE_ACCOUNT_ID: ""'));
  assert.ok(!source.includes("Refusing a hollow pass."));
});
