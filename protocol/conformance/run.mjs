/**
 * Conformance runner for the AuthiChain Verification Specification.
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * Runs every fixture against an implementation and reports pass/fail. Works with
 * an implementation in any language: the only contract is the CLI shape.
 *
 *   node run.mjs -- node ../verifier.mjs
 *   node run.mjs -- python3 verify.py
 *   node run.mjs -- ./target/release/verify
 *
 * ## The contract an implementation must satisfy
 *
 *   <command> <record.json> [anchor.json]
 *
 * - Print a JSON object on stdout containing a "verdict" field, one of
 *   "verified" | "valid-unanchored" | "invalid".
 * - When the fixture sets options.allowTestnet, the environment variable
 *   ALLOW_TESTNET=1 is set for that invocation.
 * - Exit code is ignored. Only stdout is read, so a non-zero exit for "invalid"
 *   is fine.
 *
 * ## What conformance means here
 *
 * The verdict must match exactly. Reason strings are compared only under
 * --strict, because reason vocabularies are implementation detail — but an
 * implementation that reports the right verdict for the wrong reason is still
 * suspect, so --strict is what a published conformance claim should cite.
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const FIXTURES = join(HERE, 'fixtures');

const argv = process.argv.slice(2);
const strict = argv.includes('--strict');
const jsonOut = argv.includes('--json');
const sepIndex = argv.indexOf('--');
if (sepIndex === -1 || sepIndex === argv.length - 1) {
  console.error('usage: node run.mjs [--strict] [--json] -- <command> [args...]');
  console.error('   eg: node run.mjs --strict -- node ../verifier.mjs');
  process.exit(2);
}
const [cmd, ...cmdArgs] = argv.slice(sepIndex + 1);

const tmp = mkdtempSync(join(tmpdir(), 'authichain-conformance-'));
const fixtureFiles = readdirSync(FIXTURES).filter((f) => f.endsWith('.json')).sort();

const results = [];
for (const file of fixtureFiles) {
  const fx = JSON.parse(readFileSync(join(FIXTURES, file), 'utf8'));

  // Write the record verbatim so key order is preserved — the canonicalisation
  // fixtures depend on the implementation seeing non-sorted input.
  const recordPath = join(tmp, `${fx.id}.record.json`);
  writeFileSync(recordPath, JSON.stringify(fx.record, null, 2));
  const args = [...cmdArgs, recordPath];
  if (fx.anchor) {
    const anchorPath = join(tmp, `${fx.id}.anchor.json`);
    writeFileSync(anchorPath, JSON.stringify(fx.anchor, null, 2));
    args.push(anchorPath);
  }

  const env = { ...process.env };
  if (fx.options?.allowTestnet) env.ALLOW_TESTNET = '1';
  else delete env.ALLOW_TESTNET;

  const proc = spawnSync(cmd, args, { encoding: 'utf8', env, timeout: 30_000 });

  let actual = null;
  let parseError = null;
  try {
    const stdout = (proc.stdout ?? '').trim();
    if (!stdout) throw new Error('no stdout');
    actual = JSON.parse(stdout);
  } catch (err) {
    parseError = err.message;
  }

  const failures = [];
  if (parseError) {
    failures.push(`could not parse stdout as JSON (${parseError})`);
  } else if (actual.verdict !== fx.expect.verdict) {
    failures.push(`verdict: expected "${fx.expect.verdict}", got "${actual.verdict}"`);
  }

  if (strict && !parseError && fx.expect.reasonsInclude?.length) {
    const got = Array.isArray(actual.reasons) ? actual.reasons : [];
    for (const needed of fx.expect.reasonsInclude) {
      if (!got.includes(needed)) failures.push(`reasons: missing "${needed}" (got ${JSON.stringify(got)})`);
    }
  }

  results.push({ id: fx.id, description: fx.description, ok: failures.length === 0, failures });
}

const passed = results.filter((r) => r.ok).length;
const total = results.length;

if (jsonOut) {
  console.log(JSON.stringify({
    implementation: [cmd, ...cmdArgs].join(' '),
    strict,
    passed,
    total,
    conformant: passed === total,
    results,
  }, null, 2));
} else {
  for (const r of results) {
    console.log(`${r.ok ? 'PASS' : 'FAIL'}  ${r.id}`);
    for (const f of r.failures) console.log(`        ${f}`);
    if (!r.ok) console.log(`        ${r.description}`);
  }
  console.log(`\n${passed}/${total} passed${strict ? ' (strict)' : ''} — ${[cmd, ...cmdArgs].join(' ')}`);
  if (passed !== total) {
    console.log('\nNot conformant. Every fixture must pass to claim conformance.');
  }
}

process.exit(passed === total ? 0 : 1);
