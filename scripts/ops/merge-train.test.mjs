import assert from "node:assert/strict";
import { test } from "node:test";
import { decide, gateOf, trainBranch } from "./merge-train.mjs";

const pr = (over = {}) => ({ number: 1, head: "a".repeat(40), gate: "success", mergeable: true, draft: false, ...over });

test("ready only when the train and every PR gate are green", () => {
  const d = decide("success", [pr(), pr({ number: 2, head: "b".repeat(40) })]);
  assert.equal(d.ok, true);
  assert.equal(d.commands.length, 2);
  assert.match(d.commands[0], /--match-head-commit a{40}$/);
});

test("refuses a red or pending train", () => {
  assert.equal(decide("pending", [pr()]).ok, false);
  assert.equal(decide("failure", [pr()]).ok, false);
});

test("refuses a PR whose own gate, mergeability or draft state is wrong", () => {
  for (const bad of [{ gate: "pending" }, { mergeable: false }, { draft: true }]) {
    const d = decide("success", [pr(bad)]);
    assert.equal(d.ok, false, JSON.stringify(bad));
  }
});

test("never emits a deploy or an unpinned merge", () => {
  const d = decide("success", [pr()]);
  for (const c of d.commands) {
    assert.match(c, /^gh pr merge \d+ /);
    assert.match(c, /--match-head-commit [0-9a-f]{40}$/);
    assert.doesNotMatch(c, /workflow run|deploy/);
  }
});

test("reads the required gate and names the branch by date", () => {
  assert.equal(gateOf([{ context: "ci/circleci: main-quality-gate", state: "success" }]), "success");
  assert.equal(gateOf([]), "none");
  assert.equal(trainBranch(new Date("2026-11-19T22:00:00Z")), "ci/merge-train-20261119");
});
