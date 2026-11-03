#!/usr/bin/env node
// Evidence is read only from stdin; never logged, persisted, sent, or uploaded.
import {assessFirstPassportSale} from './gate.mjs';
let raw = '';
try {
  for await (const part of process.stdin) {
    raw += part.toString('utf8');
    if (Buffer.byteLength(raw,'utf8') > 1024 * 1024) throw new Error('evidence input exceeds 1 MiB');
  }
  const payload = raw.trim() ? JSON.parse(raw) : {};
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('input must be an object');
  process.stdout.write(JSON.stringify(assessFirstPassportSale(payload),null,2)+'\n');
} catch (error) {
  console.error(error instanceof Error ? error.message : 'invalid input');
  process.exitCode = 1;
}
