import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, createPublicKey } from 'node:crypto';
import { mkdtempSync, writeFileSync, existsSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { publishedAgentz, signEvidence, verifyEvidence } from './sign-evidence.mjs';

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58(buf) {
  let n = BigInt('0x' + Buffer.from(buf).toString('hex'));
  let o = '';
  while (n > 0n) { o = B58[Number(n % 58n)] + o; n /= 58n; }
  for (const b of buf) { if (b !== 0) break; o = '1' + o; }
  return o;
}

// A throwaway key stands in for the real AgentZ key, which never enters CI.
function fixture() {
  const dir = mkdtempSync(join(tmpdir(), 'agentz-evidence-'));
  const { privateKey } = generateKeyPairSync('ed25519');
  writeFileSync(join(dir, 'agentz.ed25519.pem'), privateKey.export({ format: 'pem', type: 'pkcs8' }), { mode: 0o600 });
  const raw = createPublicKey(privateKey).export({ format: 'der', type: 'spki' }).subarray(-32);
  const didKey = 'did:key:z' + b58(Buffer.concat([Buffer.from([0xed, 0x01]), raw]));
  const evidence = join(dir, 'report.json');
  writeFileSync(evidence, JSON.stringify({ outside: { payers: 9, usdc: '0.450000' } }));
  const expected = { didKey, did: 'did:web:authichain.com:agents:agentz', validUntil: '2027-01-17T18:00:00Z' };
  return { dir, evidence, expected };
}
const NOW = new Date('2026-11-18T23:50:00Z');

test('the published AgentZ identity is readable and is a did:key', () => {
  const id = publishedAgentz();
  assert.match(id.didKey, /^did:key:z6Mk/);
  assert.equal(id.did, 'did:web:authichain.com:agents:agentz');
});

test('signs an evidence file and verifies offline with the protocol verifier', () => {
  const { dir, evidence, expected } = fixture();
  const record = signEvidence({ keyDir: dir, evidencePath: evidence, summary: 'x402 on-chain check', now: NOW, expected });
  assert.equal(record.issuer, expected.didKey);
  assert.deepEqual(record.type, ['VerifiableCredential', 'AgentZEvidenceRecord']);
  assert.equal(record.credentialSubject.id, `urn:sha256:${record.credentialSubject.evidence.sha256}`);
  assert.ok(new Date(record.validUntil) <= new Date(expected.validUntil), 'never outlives the identity');
  assert.deepEqual(verifyEvidence(record, evidence, { expected, now: NOW }), { valid: true, verdict: 'valid-unanchored', reasons: [] });
});

test('a changed evidence file or a changed record no longer verifies', () => {
  const { dir, evidence, expected } = fixture();
  const record = signEvidence({ keyDir: dir, evidencePath: evidence, now: NOW, expected });
  writeFileSync(evidence, JSON.stringify({ outside: { payers: 90, usdc: '45.000000' } }));
  assert.ok(verifyEvidence(record, evidence, { expected, now: NOW }).reasons.includes('evidence_digest_mismatch'));

  const { dir: d2, evidence: e2, expected: x2 } = fixture();
  const r2 = signEvidence({ keyDir: d2, evidencePath: e2, now: NOW, expected: x2 });
  r2.credentialSubject.summary = 'edited after signing';
  const v = verifyEvidence(r2, e2, { expected: x2, now: NOW });
  assert.equal(v.valid, false);
  assert.ok(v.reasons.includes('signature_invalid'));
});

test('refuses a key that is not the published AgentZ key, and never creates one', () => {
  const { dir, evidence } = fixture();
  assert.throws(
    () => signEvidence({ keyDir: dir, evidencePath: evidence, now: NOW, expected: publishedAgentz() }),
    /not the published AgentZ/
  );
  const empty = mkdtempSync(join(tmpdir(), 'agentz-nokey-'));
  assert.throws(() => signEvidence({ keyDir: empty, evidencePath: evidence, now: NOW }), /never creates one/);
  assert.deepEqual(readdirSync(empty), []);
  assert.equal(existsSync(join(empty, 'agentz.ed25519.pem')), false);
});

test('a record signed by someone else is rejected even if the signature is valid', () => {
  const { dir, evidence, expected } = fixture();
  const record = signEvidence({ keyDir: dir, evidencePath: evidence, now: NOW, expected });
  const v = verifyEvidence(record, evidence, { expected: publishedAgentz(), now: NOW });
  assert.equal(v.valid, false);
  assert.ok(v.reasons.includes('issuer_not_agentz'));
});
