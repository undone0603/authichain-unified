#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { buildPackageEvidenceReport } from './report.mjs';

if (process.argv.length !== 3) {
  console.error('Usage: node tools/package-evidence/cli.mjs path/to/private-input.json');
  process.exitCode = 2;
} else {
  try {
    const file = resolve(process.argv[2]);
    const input = JSON.parse(await readFile(file, 'utf8'));
    const report = await buildPackageEvidenceReport(input, { root: dirname(file) });
    process.stdout.write(JSON.stringify(report, null, 2) + '\n');
  } catch (err) {
    console.error(err instanceof Error ? err.message : 'Unknown error');
    process.exitCode = 1;
  }
}
