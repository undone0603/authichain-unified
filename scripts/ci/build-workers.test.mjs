import { test } from "node:test";
import assert from "node:assert/strict";
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
  assert.deepEqual(workersToBuild(buildable, ["_shared"]), [
    "authichain-com",
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
