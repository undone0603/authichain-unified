import assert from "node:assert/strict";
import { test } from "node:test";
import { decide, loadBaseline, validateBaseline } from "./build-baseline.mjs";

const ROOTS = [".github/", "docs/", "workers/"];

test("workflow, docs, and worker edits skip the Next build", () => {
  const decision = decide(
    [
      ".github/workflows/lint.yml",
      "docs/architecture/ARCHITECTURE_OVERVIEW.md",
      "workers/authichain-com/src/index.ts",
    ],
    ROOTS
  );
  assert.equal(decision.skip, true);
  assert.deepEqual(decision.outside, []);
});

test("a src edit still builds, even next to a worker edit", () => {
  const decision = decide(
    ["workers/authichain-com/src/generation-check.ts", "src/lib/generation-seal.ts"],
    ROOTS
  );
  assert.equal(decision.skip, false);
  assert.deepEqual(decision.outside, ["src/lib/generation-seal.ts"]);
});

test("an empty diff does not skip", () => {
  assert.equal(decide([], ROOTS).skip, false);
});

test("a skip root cannot cover a Next input", () => {
  assert.throws(() => validateBaseline({ skipRoots: ["src/"] }), /Next input/);
  assert.throws(() => validateBaseline({ skipRoots: ["scripts/"] }), /Next input/);
  assert.throws(() => validateBaseline({ skipRoots: [] }), /non-empty/);
});

test("the committed baseline skips a worker-only change and rejects overlap", () => {
  const baseline = loadBaseline();
  validateBaseline(baseline);
  assert.equal(decide(["workers/authichain-com/src/generation-check.ts"], baseline.skipRoots).skip, true);
  assert.equal(decide(["package.json"], baseline.skipRoots).skip, false);
});
