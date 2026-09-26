#!/usr/bin/env node
/**
 * Adversarial lab runner. Zero deps. Additive to protocol/conformance (28 crypto fixtures).
 *   node protocol/adversarial/run.mjs --strict
 *   node protocol/adversarial/run.mjs --strict -- node protocol/trust-kernel/evaluate.mjs
 */
import { readdirSync, readFileSync, writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const here = dirname(fileURLToPath(import.meta.url));
const fixturesDir = join(here, "fixtures");
const strict = process.argv.includes("--strict");
const jsonMode = process.argv.includes("--json");
const sep = process.argv.indexOf("--");
const impl =
  sep >= 0
    ? process.argv.slice(sep + 1)
    : ["node", join(here, "../trust-kernel/evaluate.mjs")];

const files = readdirSync(fixturesDir)
  .filter((f) => f.endsWith(".json"))
  .sort();
const tmp = join(here, ".tmp");
mkdirSync(tmp, { recursive: true });

const results = [];
for (const file of files) {
  const fx = JSON.parse(readFileSync(join(fixturesDir, file), "utf8"));
  const inputPath = join(tmp, `${fx.id || file}.json`);
  writeFileSync(inputPath, JSON.stringify(fx.input ?? fx, null, 2));
  const ran = spawnSync(impl[0], [...impl.slice(1), inputPath], { encoding: "utf8" });
  let out;
  try {
    out = JSON.parse(ran.stdout || "null");
  } catch {
    out = null;
  }
  const expect = fx.expect || {};
  const failures = [];
  if (!out || typeof out.decision !== "string") {
    failures.push(`no_decision_json stdout=${JSON.stringify(ran.stdout)} err=${ran.stderr}`);
  } else if (out.decision !== expect.decision) {
    failures.push(`decision ${out.decision} != ${expect.decision}`);
  }
  if (strict && Array.isArray(expect.reasonsInclude) && out) {
    const blob = (out.reasons || []).join(" ");
    for (const needle of expect.reasonsInclude) {
      if (!blob.includes(needle)) failures.push(`missing_reason:${needle}`);
    }
  }
  results.push({ id: fx.id || file, ok: failures.length === 0, failures, decision: out?.decision });
}
rmSync(tmp, { recursive: true, force: true });

const passed = results.filter((r) => r.ok).length;
if (jsonMode) {
  process.stdout.write(JSON.stringify({ passed, total: results.length, results }) + "\n");
} else {
  for (const r of results) {
    process.stdout.write(
      `${r.ok ? "PASS" : "FAIL"} ${r.id} ${r.decision || "-"} ${r.failures.join(";")}\n`,
    );
  }
  process.stdout.write(`${passed}/${results.length} passed\n`);
}
process.exit(passed === results.length ? 0 : 1);
