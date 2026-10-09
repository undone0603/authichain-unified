// SPDX-License-Identifier: Apache-2.0
// GB-15: the fictional sample passport. Signature tests skip, with a reason,
// until Zac's public did:key is committed to ISSUER.json and the signed file exists.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateKeyPairSync } from 'node:crypto';
import { verifyRecord } from '../verifier.mjs';
import { signRecord } from './sign-sample.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const read = (f) => JSON.parse(readFileSync(join(HERE, f), 'utf8'));
const LABEL = 'Sample, fictional pack, not an issued passport';
const unsigned = read('ebike-pack.unsigned.json');
const pinned = read('ISSUER.json').issuer;
const signedPath = join(HERE, 'ebike-pack.passport.json');
const SKIP = pinned === null
  ? 'ISSUER.json issuer is null: waiting for Zac\'s public did:key (KEY-SETUP step 2)'
  : !existsSync(signedPath) ? 'ebike-pack.passport.json not signed yet (KEY-SETUP step 4)' : false;

// Wording guard. Banned anywhere in sample data: claims of compliance or
// certification, "issued" except inside the exact label, live GS1 IDs, GTIN paths.
const BANNED = [
  /\bcompli(?:ant|ance)\b/i,
  /\bcertif(?:ied|icate|ication)\b/i,
  /\bissued\b/i,
  /\bid\.gs1\.org\b/i,
  /\/01\/\d{8,14}\b/,
  /\bgtin\b/i,
];
function wordingViolations(text) {
  const stripped = text.split(LABEL).join('');
  return BANNED.filter((re) => re.test(stripped)).map(String);
}

test('wording guard catches what it should and spares the label', () => {
  assert.deepEqual(wordingViolations(`"${LABEL}"`), []);
  assert.ok(wordingViolations('an issued passport').length);
  assert.ok(wordingViolations('EU compliant battery').length);
  assert.ok(wordingViolations('https://id.gs1.org/01/09506000134352').length);
});

test('sample data files pass the wording guard', () => {
  for (const f of readdirSync(HERE).filter((f) => f.endsWith('.json'))) {
    assert.deepEqual(wordingViolations(readFileSync(join(HERE, f), 'utf8')), [], f);
  }
});

test('unsigned sample carries the exact label and a non-live id', () => {
  assert.equal(unsigned.credentialSubject.label, LABEL);
  assert.match(unsigned.credentialSubject.id, /^urn:authichain:sample:fictional-pack:/);
  assert.equal(unsigned.issuer, undefined);
  assert.equal(unsigned.proof, undefined);
});

test('signer round-trips through the reference verifier (throwaway key)', () => {
  const { privateKey } = generateKeyPairSync('ed25519');
  const rec = signRecord(unsigned, privateKey);
  assert.equal(verifyRecord(rec).verdict, 'valid-unanchored');
  const tampered = structuredClone(rec);
  tampered.credentialSubject.statedWh = 672;
  assert.equal(verifyRecord(tampered).verdict, 'invalid');
});

test('signed sample verifies', { skip: SKIP }, () => {
  assert.equal(verifyRecord(read('ebike-pack.passport.json')).verdict, 'valid-unanchored');
});

test('signed sample is pinned to ISSUER.json', { skip: SKIP }, () => {
  const rec = read('ebike-pack.passport.json');
  assert.equal(rec.issuer, pinned);
  assert.equal(rec.proof.verificationMethod.split('#')[0], pinned);
});

test('signed sample equals unsigned apart from issuer and proof', { skip: SKIP }, () => {
  const { issuer, proof, ...rest } = read('ebike-pack.passport.json');
  assert.deepEqual(rest, unsigned);
});

test('a different key fails the pin', { skip: SKIP }, () => {
  const { privateKey } = generateKeyPairSync('ed25519');
  assert.notEqual(signRecord(unsigned, privateKey).issuer, pinned);
});
