#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// CLI wrapper for the reference verifier.
//
//   authichain-verify <record.json> [anchor.json]
// A DigitalProductPassport prints { genuine, digitalIdentity, verdict, reasons }
// and exits 0 only when genuine. Any other record prints the reference
// verifier result and exits 0 for verified / valid-unanchored, 1 for invalid.
// Exit 2 is a usage error. ALLOW_TESTNET=1 accepts testnet anchors (SPEC §4.1).
import { readFileSync } from 'node:fs';
import { verifyScan } from '../passport.mjs';

const USAGE = 'usage: authichain-verify [--jwks <jwks.json>] <record.json> [anchor.json]\n       authichain-verify --jwks <jwks.json> <seal.jws>';
const args = process.argv.slice(2);

let jwks = null;
let rest = args;
if (args[0] === '--jwks') {
  if (!args[1] || !args[2]) {
    console.error(USAGE);
    process.exit(2);
  }
  jwks = JSON.parse(readFileSync(args[1], 'utf8'));
  rest = args.slice(2);
  const text = readFileSync(rest[0], 'utf8').trim();
  if (!text.startsWith('{')) {
    // A compact JWS seal rather than a JSON record.
    const result = verifyAttestationJws(text, jwks);
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.verdict === 'invalid' ? 1 : 0);
  }
}

const [recordPath, anchorPath] = rest;
if (!recordPath || recordPath === '-h' || recordPath === '--help') {
  console.error(USAGE);
  process.exit(2);
}
const record = JSON.parse(readFileSync(recordPath, 'utf8'));
const anchor = anchorPath ? JSON.parse(readFileSync(anchorPath, 'utf8')) : null;
const result = verifyScan(record, anchor, { allowTestnet: process.env.ALLOW_TESTNET === '1' });
console.log(JSON.stringify(result.body, null, 2));
process.exit(result.exitCode);
