#!/usr/bin/env node
// SPDX-License-Identifier: Apache-2.0
// Sign the fictional sample passport with a local Ed25519 key.
//   SAMPLE_SIGNING_KEY_PEM_FILE=key.pem node protocol/samples/sign-sample.mjs <unsigned.json> > <signed.json>
// The key file is read locally and never written anywhere. See README.md.
import { readFileSync } from 'node:fs';
import { createPrivateKey, createPublicKey, sign } from 'node:crypto';
import { signingBytes } from '../verifier.mjs';

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
export function base58Encode(bytes) {
  let n = BigInt('0x' + (Buffer.from(bytes).toString('hex') || '0'));
  let s = '';
  while (n > 0n) { s = B58[Number(n % 58n)] + s; n /= 58n; }
  for (const b of bytes) { if (b) break; s = '1' + s; }
  return s;
}

export function didKeyFor(privateKey) {
  const raw = createPublicKey(privateKey).export({ format: 'der', type: 'spki' }).subarray(-32);
  return 'did:key:z' + base58Encode(Buffer.concat([Buffer.from([0xed, 0x01]), raw]));
}

export function signRecord(unsigned, privateKey) {
  const did = didKeyFor(privateKey);
  const rec = structuredClone(unsigned);
  rec.issuer = did;
  rec.proof = {
    type: 'Ed25519Signature2020',
    created: rec.validFrom,
    verificationMethod: `${did}#key-1`,
    proofPurpose: 'assertionMethod',
  };
  rec.proof.proofValue = 'z' + base58Encode(sign(null, signingBytes(rec), privateKey));
  return rec;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const keyFile = process.env.SAMPLE_SIGNING_KEY_PEM_FILE;
  const input = process.argv[2];
  if (!keyFile || !input) {
    console.error('usage: SAMPLE_SIGNING_KEY_PEM_FILE=key.pem node sign-sample.mjs <unsigned.json>');
    process.exit(2);
  }
  const key = createPrivateKey(readFileSync(keyFile));
  console.log(JSON.stringify(signRecord(JSON.parse(readFileSync(input, 'utf8')), key), null, 2));
}
