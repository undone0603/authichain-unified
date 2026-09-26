#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// CLI wrapper for the reference verifier. Same contract as `node verifier.mjs`:
//   authichain-verify <record.json> [anchor.json]
// Prints { verdict, reasons, checks } as JSON. Exit 0 for verified /
// valid-unanchored, 1 for invalid, 2 for usage errors. ALLOW_TESTNET=1 accepts
// testnet anchors (SPEC §4.1).
import { readFileSync } from 'node:fs';
import { verifyRecord } from '../verifier.mjs';

const [recordPath, anchorPath] = process.argv.slice(2);
if (!recordPath || recordPath === '-h' || recordPath === '--help') {
  console.error('usage: authichain-verify <record.json> [anchor.json]');
  process.exit(2);
}
const record = JSON.parse(readFileSync(recordPath, 'utf8'));
const anchor = anchorPath ? JSON.parse(readFileSync(anchorPath, 'utf8')) : null;
const result = verifyRecord(record, anchor, { allowTestnet: process.env.ALLOW_TESTNET === '1' });
console.log(JSON.stringify(result, null, 2));
process.exit(result.verdict === 'invalid' ? 1 : 0);
