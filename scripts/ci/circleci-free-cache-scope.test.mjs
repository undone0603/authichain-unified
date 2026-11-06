import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const source = readFileSync(".circleci/config.yml", "utf8");
const count = needle => source.split(needle).length - 1;

test("CircleCI free candidate selects Docker Large, not X-large", () => {
  assert.match(source, /resource_class: large/);
  assert.doesNotMatch(source, /resource_class: xlarge/);
});

test("all five untrusted checkout jobs gate known secrets first", () => {
  assert.equal(count("      - assert-no-production-secrets\n      - checkout"), 5);
});

test("pnpm cache restore is branch-bound, with no global fallback", () => {
  assert.match(source, /pnpm-store-v2-\{\{ \.Branch \}\}-\{\{ checksum "pnpm-lock.yaml" \}\}/);
  assert.match(source, /pnpm-store-v2-\{\{ \.Branch \}\}-/);
  assert.doesNotMatch(source, /pnpm-store-v1-/);
});

test("the saved pnpm store key matches the branch-bound exact restore key", () => {
  assert.match(source, /save_cache:\n          key: pnpm-store-v2-\{\{ \.Branch \}\}-\{\{ checksum "pnpm-lock.yaml" \}\}/);
});

test("CircleCI jobs do not attach protected contexts or request deploy execution", () => {
  assert.doesNotMatch(source, /\n\s*context:/);
  assert.doesNotMatch(source, /\n\s*(?:machine:|resource_class: self_hosted)/);
});
