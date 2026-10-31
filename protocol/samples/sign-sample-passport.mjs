#!/usr/bin/env node
/**
 * Sign the SAMPLE-ONLY passport with an existing SAMPLE Ed25519 key.
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 * Does not generate a key. Does not print a PEM. Exits if the derived
 * did:key is not the ADM-256 Item 3 SAMPLE issuer.
 *
 *   SAMPLE_PASSPORT_SIGNING_KEY   PKCS#8 PEM, or base64(PEM)
 *   SAMPLE_SIGNING_KEY_PEM_FILE   path to a PKCS#8 PEM file
 */

import { createPrivateKey, createPublicKey, sign as edSign } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { didKeyFromJwk, signingBytes } from '../verifier.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
export const SAMPLE_ISSUER_DID =
  'did:key:z6MknvZLpAxf4Z1rbs2tNiv3pwwygwBEk6ivASSi6FpYt8Mp';

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

function b58encode(buf) {
  let n = BigInt('0x' + (Buffer.from(buf).toString('hex') || '0'));
  let out = '';
  while (n > 0n) {
    out = B58[Number(n % 58n)] + out;
    n /= 58n;
  }
  for (const b of buf) {
    if (b !== 0) break;
    out = '1' + out;
  }
  return out;
}

function fail(message, code = 2) {
  console.error(message);
  process.exit(code);
}

function pemFromEnv(raw) {
  const trimmed = String(raw).trim();
  if (trimmed.includes('BEGIN PRIVATE KEY')) return trimmed;
  try {
    const decoded = Buffer.from(trimmed.replace(/\s+/g, ''), 'base64').toString('utf8');
    if (decoded.includes('BEGIN PRIVATE KEY')) return decoded.trim();
  } catch {
    /* not base64 PEM */
  }
  return null;
}

function loadPrivateKey() {
  const file = process.env.SAMPLE_SIGNING_KEY_PEM_FILE;
  const inline = process.env.SAMPLE_PASSPORT_SIGNING_KEY;
  if (!file && !inline) {
    return {
      error:
        'missing SAMPLE_PASSPORT_SIGNING_KEY or SAMPLE_SIGNING_KEY_PEM_FILE — will not invent a key',
    };
  }
  let pem;
  if (file) {
    try {
      pem = readFileSync(file, 'utf8');
    } catch {
      return { error: 'SAMPLE_SIGNING_KEY_PEM_FILE is unreadable' };
    }
  } else {
    pem = pemFromEnv(inline);
    if (!pem) return { error: 'SAMPLE_PASSPORT_SIGNING_KEY is not a PKCS#8 PEM or base64(PEM)' };
  }
  if (!pem.includes('BEGIN PRIVATE KEY') || pem.includes('BEGIN RSA PRIVATE KEY')) {
    return { error: 'signing material is not a PKCS#8 private key' };
  }
  try {
    const privateKey = createPrivateKey(pem);
    if (privateKey.asymmetricKeyType !== 'ed25519') {
      return { error: 'signing key is not Ed25519' };
    }
    return { privateKey };
  } catch {
    return { error: 'signing key could not be parsed as Ed25519 PKCS#8' };
  }
}

export function derivedDid(privateKey) {
  const publicKey = createPublicKey(privateKey);
  const jwk = publicKey.export({ format: 'jwk' });
  return didKeyFromJwk(jwk);
}

export function signSamplePassport(wrapper, privateKey) {
  const record = structuredClone(wrapper.record);
  if (!record?.proof) throw new Error('sample record is missing proof');
  record.issuer = SAMPLE_ISSUER_DID;
  record.proof.verificationMethod = `${SAMPLE_ISSUER_DID}#${SAMPLE_ISSUER_DID.slice('did:key:'.length)}`;
  const sig = edSign(null, signingBytes(record), privateKey);
  record.proof.proofValue = 'z' + b58encode(sig);
  return {
    ...wrapper,
    signatureStatus: 'signed',
    signatureNote:
      'Signed SAMPLE-ONLY Ed25519. Private key never published. Not a production attestation.', // pragma: allowlist secret
    record,
  };
}

function parseArgs(argv) {
  const out = {
    input: join(HERE, 'passport.sample.json'),
    output: join(HERE, 'passport.signed.json'),
  };
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--in') out.input = argv[++i];
    else if (argv[i] === '--out') out.output = argv[++i];
  }
  return out;
}

function main() {
  const loaded = loadPrivateKey();
  if (loaded.error) fail(loaded.error);
  const did = derivedDid(loaded.privateKey);
  if (did !== SAMPLE_ISSUER_DID) {
    fail(`derived did:key is not the SAMPLE issuer (got a different public key; value not printed)`);
  }
  const { input, output } = parseArgs(process.argv.slice(2));
  const wrapper = JSON.parse(readFileSync(input, 'utf8'));
  const signed = signSamplePassport(wrapper, loaded.privateKey);
  writeFileSync(output, JSON.stringify(signed, null, 2) + '\n');
  console.log(`wrote SAMPLE-ONLY signed passport to ${output}`);
}

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (isMain) main();
