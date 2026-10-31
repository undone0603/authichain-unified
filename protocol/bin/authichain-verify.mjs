#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// CLI wrapper for the reference verifier.
//
//   authichain-verify <record.json> [anchor.json]
//     Same contract as `node verifier.mjs`. Prints { verdict, reasons, checks }
//     as JSON. Exit 0 for verified / valid-unanchored, 1 for invalid, 2 for
//     usage errors. ALLOW_TESTNET=1 accepts testnet anchors (SPEC §4.1).
//
//   authichain-verify --jwks <jwks.json> <record.json> [anchor.json]
//     As above, and also requires the record's signer (did:key) to be a key
//     in that JWKS (checks.issuerInJwks).
//
//   authichain-verify --jwks <jwks.json> <seal.jws>
//     Verifies a compact-JWS attestation seal against a JWKS file you saved
//     (e.g. https://authichain.com/protocol/jwks.json). Offline. Exit 0 for
//     valid-offline, 1 for invalid, 2 for usage errors.
import { readFileSync } from 'node:fs';
import { verifyRecord, verifyAttestationJws } from '../verifier.mjs';

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
const result = verifyRecord(record, anchor, { allowTestnet: process.env.ALLOW_TESTNET === '1', jwks });
console.log(JSON.stringify(result, null, 2));
process.exit(result.verdict === 'invalid' ? 1 : 0);
