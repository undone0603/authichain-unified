import { test } from "node:test";
import assert from "node:assert/strict";
import { selectAutoDeployWorkers, AUTO_DEPLOY_ALLOWLIST } from "./select-autodeploy-workers.mjs";

// This is the Review Focus case from
// docs/superpowers/plans/2026-09-30-gs1-resolver-autonomous-ops.md: a push
// that touches an allow-listed worker's dir alongside another worker's dir
// in the same commit must deploy only the allow-listed one.
test("selectAutoDeployWorkers narrows to only the allow-listed worker on a mixed-path push", () => {
  const result = selectAutoDeployWorkers(
    ["gs1-resolver", "authichain-com"],
    ["gs1-resolver"]
  );
  assert.deepEqual(result, ["gs1-resolver"]);
});

test("selectAutoDeployWorkers returns empty when only unrelated workers changed", () => {
  const result = selectAutoDeployWorkers(
    ["authichain-com", "qron-space"],
    ["gs1-resolver"]
  );
  assert.deepEqual(result, []);
});

test("selectAutoDeployWorkers returns the worker when it's the only thing changed", () => {
  const result = selectAutoDeployWorkers(["gs1-resolver"], ["gs1-resolver"]);
  assert.deepEqual(result, ["gs1-resolver"]);
});

test("selectAutoDeployWorkers returns empty on an empty changed-dirs list", () => {
  assert.deepEqual(selectAutoDeployWorkers([], ["gs1-resolver"]), []);
});

test("selectAutoDeployWorkers never returns a worker not on the allowlist, even if it changed", () => {
  // Guards against a future edit accidentally widening this to "anything
  // that changed" instead of "anything that changed AND is allow-listed".
  const result = selectAutoDeployWorkers(
    ["authichain-com", "gs1-resolver", "qron-space"],
    ["gs1-resolver"]
  );
  assert.deepEqual(result, ["gs1-resolver"]);
  assert.equal(result.includes("authichain-com"), false);
  assert.equal(result.includes("qron-space"), false);
});

test("selectAutoDeployWorkers preserves allowlist order, not changed-dirs order", () => {
  const result = selectAutoDeployWorkers(
    ["worker-b", "worker-a"],
    ["worker-a", "worker-b"]
  );
  assert.deepEqual(result, ["worker-a", "worker-b"]);
});

test("the production allowlist ships the public workers and not paid or archived ones", () => {
  for (const worker of [
    "authichain-com",
    "authichain-api",
    "authichain-api-gateway",
    "qron-space",
    "strainchain-io",
    "govchain-us",
    "gs1-resolver",
    "dpp-fulfillment",
    "authichain-verify-worker",
  ]) {
    assert.equal(AUTO_DEPLOY_ALLOWLIST.includes(worker), true, worker);
  }
  assert.equal(AUTO_DEPLOY_ALLOWLIST.includes("authichain-agentz"), false);
  assert.equal(AUTO_DEPLOY_ALLOWLIST.includes("passport-demo"), false);
  const shipped = selectAutoDeployWorkers(
    ["authichain-com", "passport-demo", "gs1-resolver"],
    AUTO_DEPLOY_ALLOWLIST
  );
  assert.deepEqual(shipped, ["authichain-com", "gs1-resolver"]);
});
