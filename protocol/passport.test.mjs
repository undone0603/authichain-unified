import { describe, it, expect } from 'vitest';
import { generateKeyPairSync, createHash } from 'node:crypto';
import { signingBytes } from './verifier.mjs';
import {
  assertDigitalIdentity,
  signPassport,
  scanProvesGenuine,
  storePassport,
  productPassportMetadata,
  digitalIdentityOf,
  verifyScan,
} from './passport.mjs';

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function base58Encode(buf) {
  let num = BigInt('0x' + (buf.toString('hex') || '0'));
  let out = '';
  while (num > 0n) {
    out = B58[Number(num % 58n)] + out;
    num /= 58n;
  }
  for (const b of buf) {
    if (b !== 0) break;
    out = '1' + out;
  }
  return out;
}

const NOW = '2026-06-01T00:00:00Z';
const IDENTITY = 'urn:authichain:item:example-1';

function issuer() {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
  const did = 'did:key:z' + base58Encode(Buffer.concat([Buffer.from([0xed, 0x01]), raw]));
  return { privateKey, issuer: did };
}

function anchorFor(record) {
  return {
    recordHash: 'sha256:' + createHash('sha256').update(signingBytes(record)).digest('hex'),
    chain: 'polygon:137',
    txHash: '0x' + 'ab'.repeat(32),
    anchoredAt: '2026-01-01T00:05:00Z',
  };
}

describe('digital identity', () => {
  it('requires a URI', () => {
    expect(assertDigitalIdentity(IDENTITY)).toBe(IDENTITY);
    expect(() => assertDigitalIdentity('')).toThrow(/digital_identity_required/);
    expect(() => assertDigitalIdentity('not a uri')).toThrow(/digital_identity_not_uri/);
  });

  it('does not invent a GTIN', () => {
    const keys = issuer();
    const record = signPassport({ digitalIdentity: IDENTITY, ...keys });
    expect(record.credentialSubject.gtin).toBeUndefined();
    expect(record.credentialSubject.id).toBe(IDENTITY);
    expect(record.type).toContain('DigitalProductPassport');
  });
});

describe('scanProvesGenuine', () => {
  it('a scan of a signed anchored passport proves that digital identity genuine', () => {
    const keys = issuer();
    const record = signPassport({ digitalIdentity: IDENTITY, ...keys });
    const result = scanProvesGenuine(record, anchorFor(record), { now: NOW });
    expect(result.genuine).toBe(true);
    expect(result.verdict).toBe('verified');
    expect(result.digitalIdentity).toBe(IDENTITY);
    expect(result.reasons).toEqual([]);
  });

  it('an unanchored passport is not that proof', () => {
    const keys = issuer();
    const record = signPassport({ digitalIdentity: IDENTITY, ...keys });
    const result = scanProvesGenuine(record, null, { now: NOW });
    expect(result.genuine).toBe(false);
    expect(result.verdict).toBe('valid-unanchored');
  });

  it('a tampered passport is not genuine', () => {
    const keys = issuer();
    const record = signPassport({ digitalIdentity: IDENTITY, ...keys });
    record.credentialSubject.id = 'urn:authichain:item:swapped';
    const result = scanProvesGenuine(record, anchorFor(record), { now: NOW });
    expect(result.genuine).toBe(false);
    expect(result.verdict).toBe('invalid');
  });

  it('the scan command accepts only a genuine passport', () => {
    const keys = issuer();
    const record = signPassport({ digitalIdentity: IDENTITY, ...keys });
    const anchored = verifyScan(record, anchorFor(record), { now: NOW });
    expect(anchored.exitCode).toBe(0);
    expect(anchored.body.genuine).toBe(true);
    const open = verifyScan(record, null, { now: NOW });
    expect(open.exitCode).toBe(1);
    expect(open.body.genuine).toBe(false);
  });

  it('a provenance record is not a product passport', () => {
    const keys = issuer();
    const record = signPassport({ digitalIdentity: IDENTITY, ...keys });
    record.type = ['VerifiableCredential', 'ProvenanceRecord'];
    const result = scanProvesGenuine(record, anchorFor(record), { now: NOW });
    expect(result.genuine).toBe(false);
    expect(result.reasons).toContain('not_a_product_passport');
  });

  it('stores an already-signed passport under its digital identity', () => {
    const keys = issuer();
    const record = signPassport({ digitalIdentity: IDENTITY, ...keys, serial: 'SN-1' });
    const anchor = anchorFor(record);
    const metadata = storePassport({ story: 'kept' }, { record, anchor });
    expect(metadata.story).toBe('kept');
    expect(metadata.passport.record).toBe(record);
    expect(metadata.passport.anchor).toBe(anchor);
    expect(metadata.passport.record.credentialSubject.gtin).toBeUndefined();
    expect(digitalIdentityOf(metadata)).toBe(IDENTITY);
    const saved = productPassportMetadata({ metadata: { story: 'kept' }, passport: { record, anchor } });
    expect(saved.passport.record.credentialSubject.id).toBe(IDENTITY);
    expect(scanProvesGenuine(saved.passport.record, saved.passport.anchor, { now: NOW }).genuine).toBe(true);
    const open = productPassportMetadata({ passport: record });
    expect(open.passport.anchor).toBeUndefined();
    expect(scanProvesGenuine(open.passport.record, null, { now: NOW }).genuine).toBe(false);
    expect(productPassportMetadata({ name: 'Widget' })).toBeNull();
    expect(() => storePassport({}, { type: ['VerifiableCredential', 'ProvenanceRecord'] })).toThrow(/not_a_product_passport/);
    const badGtin = signPassport({ digitalIdentity: IDENTITY, ...keys });
    badGtin.credentialSubject.gtin = '123';
    expect(() => storePassport({}, badGtin)).toThrow(/gtin_not_14_digits/);
    badGtin.credentialSubject.gtin = undefined;
    badGtin.credentialSubject.id = 'not a uri';
    expect(() => storePassport({}, badGtin)).toThrow(/digital_identity_not_uri/);
  });

  it('does not treat a short gtin as genuine and does not assign one', () => {
    const keys = issuer();
    const record = signPassport({ digitalIdentity: IDENTITY, ...keys });
    expect(record.credentialSubject.gtin).toBeUndefined();
    record.credentialSubject.gtin = '123';
    const result = scanProvesGenuine(record, anchorFor(record), { now: NOW });
    expect(result.genuine).toBe(false);
    expect(result.reasons).toEqual(['gtin_not_14_digits']);
    expect(result.digitalIdentity).toBe(IDENTITY);
  });
});
