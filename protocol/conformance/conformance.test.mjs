import { describe, it, expect } from 'vitest';
import { spawnSync } from 'node:child_process';
import { readFileSync, readdirSync, writeFileSync, rmSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));

/**
 * Keeps the reference verifier honest in CI: if someone changes verifier.mjs
 * in a way that breaks conformance, this fails rather than the spec quietly
 * drifting from its own implementation.
 */
describe('conformance suite', () => {
  it('the reference verifier passes all fixtures in strict mode', () => {
    const proc = spawnSync(
      'node',
      [join(HERE, 'run.mjs'), '--strict', '--json', '--', 'node', join(HERE, '..', 'verifier.mjs')],
      { encoding: 'utf8', timeout: 120_000 },
    );
    const report = JSON.parse(proc.stdout);
    const failed = report.results.filter((r) => !r.ok);
    expect(failed.map((r) => `${r.id}: ${r.failures.join('; ')}`)).toEqual([]);
    expect(report.conformant).toBe(true);
    expect(report.passed).toBe(report.total);
  }, 120_000);

  it('the fixture set matches the manifest', () => {
    const manifest = JSON.parse(readFileSync(join(HERE, 'manifest.json'), 'utf8'));
    const onDisk = readdirSync(join(HERE, 'fixtures'))
      .filter((f) => f.endsWith('.json'))
      .map((f) => f.replace(/\.json$/, ''))
      .sort();
    expect(onDisk).toEqual([...manifest.fixtures].sort());
    expect(manifest.count).toBe(onDisk.length);
  });

  it('every fixture declares an expected verdict from the specified set', () => {
    const dir = join(HERE, 'fixtures');
    for (const file of readdirSync(dir).filter((f) => f.endsWith('.json'))) {
      const fx = JSON.parse(readFileSync(join(dir, file), 'utf8'));
      expect(['verified', 'valid-unanchored', 'invalid']).toContain(fx.expect.verdict);
      expect(fx.description, `${fx.id} needs a description`).toBeTruthy();
    }
  });

  it('rejects an implementation that always returns verified', () => {
    // A suite that cannot fail is worthless. This asserts it can.
    const dir = mkdtempSync(join(tmpdir(), 'conformance-stub-'));
    const stub = join(dir, 'always-verified.mjs');
    writeFileSync(stub, "console.log(JSON.stringify({ verdict: 'verified', reasons: [] }));\n");
    try {
      const proc = spawnSync('node', [join(HERE, 'run.mjs'), '--json', '--', 'node', stub], {
        encoding: 'utf8', timeout: 120_000,
      });
      const report = JSON.parse(proc.stdout);
      expect(report.conformant).toBe(false);
      expect(report.passed).toBeLessThan(report.total);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }, 120_000);
});
