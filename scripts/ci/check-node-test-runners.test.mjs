import { test } from "node:test";
import assert from "node:assert/strict";
import {
  commandPatterns,
  expandScriptRefs,
  globToRegExp,
  isNodeTestSource,
  stripYamlComments,
  uncoveredFiles,
} from "./check-node-test-runners.mjs";

test("isNodeTestSource matches node:test imports and requires only", () => {
  assert.equal(isNodeTestSource('import { test } from "node:test";'), true);
  assert.equal(
    isNodeTestSource("const { test } = require('node:test');"),
    true
  );
  assert.equal(isNodeTestSource('import { test } from "vitest";'), false);
});

test("globToRegExp keeps * inside one directory and lets ** cross them", () => {
  const one = globToRegExp("scripts/ci/*.test.mjs");
  assert.equal(one.test("scripts/ci/a.test.mjs"), true);
  assert.equal(one.test("scripts/ci/sub/a.test.mjs"), false);

  const deep = globToRegExp("test/**");
  assert.equal(deep.test("test/a.test.ts"), true);
  assert.equal(deep.test("test/x/y.test.ts"), true);
  assert.equal(deep.test("tests/a.test.ts"), false);

  const anyDir = globToRegExp("**/a.test.ts");
  assert.equal(anyDir.test("a.test.ts"), true);
  assert.equal(anyDir.test("x/y/a.test.ts"), true);
});

test("globToRegExp treats dots literally", () => {
  assert.equal(globToRegExp("a.test.ts").test("aXtestXts"), false);
});

test("commandPatterns resolves chained package-relative paths, ../ included", () => {
  const patterns = commandPatterns(
    "node --experimental-strip-types src/gs1.test.ts && npx tsx --test src/a.test.ts ../_shared/b.test.ts",
    "workers/x"
  );
  assert.deepEqual(patterns, [
    "workers/x/src/gs1.test.ts",
    "workers/x/src/a.test.ts",
    "workers/_shared/b.test.ts",
  ]);
});

test("commandPatterns ignores globs that do not name test files", () => {
  // A deploy workflow's `paths:` filter must not count as a runner.
  assert.deepEqual(
    commandPatterns("paths:\n  - workers/**\n  - api/**", ""),
    []
  );
});

test("commandPatterns does not read a folded run: >- as a bare --test", () => {
  // lint.yml's node:test step puts `node --test` and its files on separate
  // lines. Read as a bare --test, it would cover the whole repository.
  const patterns = commandPatterns(
    "node --experimental-strip-types --test\nscripts/ci/*.test.mjs",
    ""
  );
  assert.deepEqual(patterns, ["scripts/ci/*.test.mjs"]);
});

test("commandPatterns: a bare --test in a package script covers the package", () => {
  assert.deepEqual(
    commandPatterns("node --test", "workers/x", { bareTest: true }),
    ["workers/x/**"]
  );
  assert.deepEqual(commandPatterns("node --test", "workers/x"), []);
});

test("commandPatterns: hardhat test covers its tests dir unless given files", () => {
  const options = { hardhatTestsDir: "./test" };
  assert.deepEqual(commandPatterns("hardhat test", "", options), ["test/**"]);
  assert.deepEqual(
    commandPatterns("hardhat test test/a.test.ts", "", options),
    ["test/a.test.ts"]
  );
});

test("expandScriptRefs inlines delegated scripts and stops on cycles", () => {
  const scripts = {
    test: "pnpm run test:unit",
    "test:unit": "node --test src/a.test.mjs && npm run test",
  };
  const expanded = expandScriptRefs(scripts.test, scripts);
  assert.match(expanded, /src\/a\.test\.mjs/);
});

test("stripYamlComments drops comment lines that mention commands", () => {
  const text =
    "      # suites, which node --test cannot run.\n      run: echo ok";
  assert.equal(stripYamlComments(text), "      run: echo ok");
});

test("uncoveredFiles returns the files no pattern matches, in order", () => {
  const files = ["a/x.test.ts", "b/y.test.ts", "c/z.test.mjs"];
  assert.deepEqual(uncoveredFiles(files, ["a/*.test.ts", "c/**"]), [
    "b/y.test.ts",
  ]);
});
