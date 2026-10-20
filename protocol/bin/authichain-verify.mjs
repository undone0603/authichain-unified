#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// CLI wrapper for the reference verifier. Same contract as `node verifier.mjs`:
//   authichain-verify <record.json> [anchor.json]
// A DigitalProductPassport prints { genuine, digitalIdentity, verdict, reasons }
// and exits 0 only when genuine. Any other record prints the reference
// verifier result and exits 0 for verified / valid-unanchored, 1 for invalid.
// Exit 2 is a usage error. ALLOW_TESTNET=1 accepts testnet anchors (SPEC §4.1).
import { readFileSync } from 'node:fs';
import { verifyScan } from '../passport.mjs';

const [recordPath, anchorPath] = process.argv.slice(2);
if (!recordPath || recordPath === '-h' || recordPath === '--help') {
  console.error('usage: authichain-verify <record.json> [anchor.json]');
  process.exit(2);
}
const record = JSON.parse(readFileSync(recordPath, 'utf8'));
const anchor = anchorPath ? JSON.parse(readFileSync(anchorPath, 'utf8')) : null;
const result = verifyScan(record, anchor, { allowTestnet: process.env.ALLOW_TESTNET === '1' });
console.log(JSON.stringify(result.body, null, 2));
process.exit(result.exitCode);
