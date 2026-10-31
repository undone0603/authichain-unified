// SPDX-License-Identifier: Apache-2.0
// Tests for verifyAttestationJws and JWKS pinning. The vectors are the
// repository's attestation v0.1 fixtures (fixtures/attestation-v0.1-*), copied
// into examples/ so they ship with the package. python/tests uses the same files.
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { generateKeyPairSync, sign as edSign } from 'node:crypto';
import { verifyAttestationJws, didKeyFromJwk, verifyRecord, publicKeyFromDidKey } from './verifier.mjs';

const ex = (f) => new URL(`./examples/${f}`, import.meta.url);
const VALID = readFileSync(ex('attestation-fixture.jws'), 'utf8').trim();
const TAMPERED = readFileSync(ex('attestation-fixture-tampered.jws'), 'utf8').trim();
const JWKS = JSON.parse(readFileSync(ex('attestation-fixture.jwks.json'), 'utf8'));
const RECORD = JSON.parse(readFileSync(ex('record.json'), 'utf8'));
const NOW = '2026-10-01T00:00:00Z';

const b64u = (o) => Buffer.from(typeof o === 'string' ? o : JSON.stringify(o)).toString('base64url');

function signJws(header, payload) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const jwk = { ...publicKey.export({ format: 'jwk' }), kid: header.kid, alg: 'EdDSA', use: 'sig' };
  const input = `${b64u(header)}.${b64u(payload)}`;
  const sig = edSign(null, Buffer.from(input), privateKey).toString('base64url');
  return { jws: `${input}.${sig}`, jwks: { keys: [jwk] } };
}
const PAYLOAD = JSON.parse(Buffer.from(VALID.split('.')[1], 'base64url').toString());
const HEADER = { alg: 'EdDSA', kid: 'k1', typ: 'AC-ATTESTATION+JWS' };

describe('verifyAttestationJws', () => {
  it('accepts the valid fixture against the fixture JWKS', () => {
    const r = verifyAttestationJws(VALID, JWKS, { now: NOW });
    expect(r.verdict).toBe('valid-offline');
    expect(r.checks).toEqual({ kid: true, signature: true });
    expect(r.payload.subject.serial).toBe('SN-001');
  });

  it('rejects the tampered fixture', () => {
    const r = verifyAttestationJws(TAMPERED, JWKS, { now: NOW });
    expect(r.verdict).toBe('invalid');
    expect(r.reasons).toEqual(['signature_invalid']);
  });

  it('rejects a kid that is not in the JWKS', () => {
    const r = verifyAttestationJws(VALID, { keys: [{ ...JWKS.keys[0], kid: 'other' }] }, { now: NOW });
    expect(r.reasons).toEqual(['kid_not_in_jwks']);
  });

  it('rejects a right kid with the wrong key material', () => {
    const { jwks } = signJws(HEADER, PAYLOAD);
    const swapped = { keys: [{ ...jwks.keys[0], kid: JWKS.keys[0].kid }] };
    expect(verifyAttestationJws(VALID, swapped, { now: NOW }).reasons).toEqual(['signature_invalid']);
  });

  it('rejects an expired payload even with a good signature', () => {
    const r = verifyAttestationJws(VALID, JWKS, { now: '2027-06-01T00:00:00Z' });
    expect(r.checks.signature).toBe(true);
    expect(r.reasons).toEqual(['expired']);
  });

  it('reports non-verified decisions and non-active status as invalid', () => {
    const { jws, jwks } = signJws(HEADER, { ...PAYLOAD, decision: 'warning', status: 'revoked' });
    const r = verifyAttestationJws(jws, jwks, { now: NOW });
    expect(r.checks.signature).toBe(true);
    expect(r.reasons).toEqual(['decision:warning', 'status:revoked']);
  });

  it('rejects a wrong typ and a non-EdDSA alg', () => {
    const a = signJws({ ...HEADER, typ: 'JWT' }, PAYLOAD);
    expect(verifyAttestationJws(a.jws, a.jwks, { now: NOW }).reasons).toContain('typ_unexpected:JWT');
    const b = signJws({ ...HEADER, alg: 'none' }, PAYLOAD);
    expect(verifyAttestationJws(b.jws, b.jwks, { now: NOW }).reasons).toContain('alg_unsupported:none');
  });

  it('rejects malformed input', () => {
    expect(verifyAttestationJws('not-a-jws', JWKS).reasons).toEqual(['jws_malformed']);
    expect(verifyAttestationJws('a.b.c', JWKS).reasons).toEqual(['jws_malformed']);
  });
});

describe('JWKS pinning for records', () => {
  it('didKeyFromJwk round-trips with publicKeyFromDidKey', () => {
    const did = didKeyFromJwk(JWKS.keys[0]);
    expect(publicKeyFromDidKey(did).export({ format: 'jwk' }).x).toBe(JWKS.keys[0].x);
  });

  it('passes when the record signer is in the JWKS', () => {
    const x = publicKeyFromDidKey(RECORD.issuer).export({ format: 'jwk' }).x;
    const r = verifyRecord(RECORD, null, { now: NOW, jwks: { keys: [{ kty: 'OKP', crv: 'Ed25519', x }] } });
    expect(r.verdict).toBe('valid-unanchored');
    expect(r.checks.issuerInJwks).toBe(true);
  });

  it('fails when the record signer is not in the JWKS', () => {
    const r = verifyRecord(RECORD, null, { now: NOW, jwks: JWKS });
    expect(r.verdict).toBe('invalid');
    expect(r.reasons).toEqual(['issuer_not_in_jwks']);
  });
});
