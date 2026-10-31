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
  checkSealSerial,
  scanPassport,
  productBindingSentence,
  appendPassportEvidence,
  udiEvidence,
  UDI_PRESENT_SENTENCE,
  UDI_ABSENT_SENTENCE,
  buildGeneticsPassportSubject,
  GENETICS_PASSPORT_SENTENCE,
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
const SEAL = 'SEAL-UNIT-0001-ABCD';
const SEAL_SENTENCE =
  'This scan presented the seal serial committed in the signed passport for urn:authichain:item:example-1. The passport signature verified. The chain transaction was not read, so publication of the hash is not confirmed. The seal serial is not in the QR. A copy of the QR alone does not pass this check. The commitment match does not prove the issuer attached that seal to the named object.';

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

  it('does not put productBinding on the passport bit', () => {
    const keys = issuer();
    const record = signPassport({ digitalIdentity: IDENTITY, ...keys, sealSerial: SEAL });
    const result = scanProvesGenuine(record, anchorFor(record), { now: NOW });
    expect(result.genuine).toBe(true);
    expect(Object.hasOwn(result, 'productBinding')).toBe(false);
  });
});

describe('seal serial', () => {
  it('stores the hash and refuses the serial in cleartext', () => {
    const keys = issuer();
    const record = signPassport({ digitalIdentity: IDENTITY, ...keys, sealSerial: SEAL, serial: 'SN-1' });
    const expected = 'sha256:' + createHash('sha256').update(SEAL, 'utf8').digest('hex');
    expect(record.credentialSubject.sealSerialSha256).toBe(expected);
    expect(record.credentialSubject.serial).toBe('SN-1');
    expect(JSON.stringify(record)).not.toContain(SEAL);
    expect(record.credentialSubject.gtin).toBeUndefined();
    expect(() => signPassport({ digitalIdentity: IDENTITY, ...keys, sealSerial: SEAL, serial: SEAL })).toThrow(
      /seal_serial_in_clear/,
    );
    expect(() => signPassport({ digitalIdentity: IDENTITY, ...keys, sealSerial: 'short' })).toThrow(
      /seal_serial_invalid/,
    );
    expect(() => signPassport({ digitalIdentity: IDENTITY, ...keys, sealSerial: 'S'.repeat(129) })).toThrow(
      /seal_serial_invalid/,
    );
    expect(signPassport({
      digitalIdentity: IDENTITY,
      ...keys,
      sealSerial: 'S'.repeat(16),
    }).credentialSubject.sealSerialSha256).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(signPassport({
      digitalIdentity: IDENTITY,
      ...keys,
      sealSerial: 'S'.repeat(128),
    }).credentialSubject.sealSerialSha256).toMatch(/^sha256:[0-9a-f]{64}$/);
    expect(() => signPassport({
      digitalIdentity: IDENTITY,
      ...keys,
      subject: { thcPercent: '25' },
    })).toThrow(/subject_field_rejected/);
    expect(() => signPassport({
      digitalIdentity: IDENTITY,
      ...keys,
      subject: { genuine: true },
    })).toThrow(/subject_field_rejected/);
    expect(() => signPassport({
      digitalIdentity: IDENTITY,
      ...keys,
      subject: { nfcMatch: true },
    })).toThrow(/subject_field_rejected/);
    const named = signPassport({
      digitalIdentity: IDENTITY,
      ...keys,
      subject: { labName: 'Example Lab' },
    });
    expect(named.credentialSubject.labName).toBe('Example Lab');
    expect(named.credentialSubject.gtin).toBeUndefined();
  });

  it('matches the committed serial and keeps a second presentation on the same passport', () => {
    const keys = issuer();
    const record = signPassport({ digitalIdentity: IDENTITY, ...keys, sealSerial: SEAL });
    const anchor = anchorFor(record);
    const once = checkSealSerial(record, SEAL);
    const twice = checkSealSerial(record, SEAL);
    expect(twice).toEqual(once);
    expect(once).toEqual({
      method: 'seal_serial_sha256',
      pass: true,
      reason: null,
      samePassport: true,
    });
    expect(record.credentialSubject.id).toBe(IDENTITY);
    const scan = scanPassport(record, anchor, { sealSerial: SEAL }, { now: NOW });
    expect(scan.genuine).toBe(true);
    expect(scan.digitalIdentity).toBe(IDENTITY);
    expect(scan.productBinding).toEqual(once);
    expect(productBindingSentence(scan)).toBe(SEAL_SENTENCE);
    expect(productBindingSentence({ ...scan, anchorTransactionQueried: true })).toBeNull();
    const open = scanPassport(record, null, { sealSerial: SEAL }, { now: NOW });
    expect(open.genuine).toBe(false);
    expect(open.productBinding.pass).toBe(true);
    expect(productBindingSentence(open)).toBeNull();
  });

  it('a copied QR and a wrong serial do not pass, and the identity stays', () => {
    const keys = issuer();
    const record = signPassport({ digitalIdentity: IDENTITY, ...keys, sealSerial: SEAL });
    const anchor = anchorFor(record);
    const missing = checkSealSerial(record, undefined);
    expect(missing).toEqual({
      method: 'seal_serial_sha256',
      pass: false,
      reason: 'seal_serial_missing',
      samePassport: true,
    });
    expect(missing && record.credentialSubject.id).toBe(IDENTITY);
    const scan = scanPassport(record, anchor, null, { now: NOW });
    expect(scan.genuine).toBe(true);
    expect(scan.productBinding.reason).toBe('seal_serial_missing');
    expect(productBindingSentence(scan)).toBeNull();
    expect(checkSealSerial(record, 'SEAL-UNIT-0001-ZZZZ')).toMatchObject({
      method: 'seal_serial_sha256',
      pass: false,
      reason: 'seal_commitment_mismatch',
      samePassport: true,
    });
    expect(checkSealSerial(record, 'short')).toMatchObject({ method: 'none', reason: 'seal_serial_invalid', pass: false });
    expect(checkSealSerial(record, 'S'.repeat(129)).reason).toBe('seal_serial_invalid');
    const plain = signPassport({ digitalIdentity: IDENTITY, ...keys });
    expect(checkSealSerial(plain, SEAL)).toEqual({
      method: 'none',
      pass: false,
      reason: 'seal_commitment_missing',
      samePassport: true,
    });
    expect(checkSealSerial(plain, undefined).reason).toBe('seal_commitment_missing');
  });

  it('a caller flag cannot pass, and a presented seal wins', () => {
    const keys = issuer();
    const record = signPassport({ digitalIdentity: IDENTITY, ...keys, sealSerial: SEAL });
    const flagged = scanPassport(record, anchorFor(record), { nfcMatch: true, visualMatch: 100 }, { now: NOW });
    expect(flagged.genuine).toBe(true);
    expect(flagged.productBinding).toEqual({
      method: 'none',
      pass: false,
      reason: 'caller_flag_not_a_binding',
      samePassport: true,
    });
    expect(productBindingSentence(flagged)).toBeNull();
    const presented = scanPassport(record, anchorFor(record), { sealSerial: SEAL, nfcMatch: true }, { now: NOW });
    expect(presented.productBinding.pass).toBe(true);
    expect(presented.productBinding.method).toBe('seal_serial_sha256');
    expect(presented.genuine).toBe(true);
  });

  it('evidence stays outside the signature and cannot set genuine', () => {
    const keys = issuer();
    const record = signPassport({ digitalIdentity: IDENTITY, ...keys, sealSerial: SEAL });
    const anchor = anchorFor(record);
    const proof = record.proof.proofValue;
    const metadata = storePassport({ story: 'kept' }, { record, anchor });
    const next = appendPassportEvidence(metadata, { type: 'seal_observation', count: 2 });
    expect(next.story).toBe('kept');
    expect(next.passport.record).toBe(record);
    expect(record.proof.proofValue).toBe(proof);
    expect(metadata.passport.evidence).toBeUndefined();
    expect(next.passport.evidence).toEqual([{ type: 'seal_observation', count: 2 }]);
    expect(scanProvesGenuine(next.passport.record, next.passport.anchor, { now: NOW }).genuine).toBe(true);
    expect(checkSealSerial(next.passport.record, SEAL).pass).toBe(true);
    expect(() => appendPassportEvidence(metadata, { genuine: true })).toThrow(/evidence_genuine_forbidden/);
    expect(() => appendPassportEvidence(metadata, { notes: [{ genuine: false }] })).toThrow(/evidence_genuine_forbidden/);
    expect(() => appendPassportEvidence({}, { type: 'note' })).toThrow(/passport_required/);
    const marker = '{"type":"pad","pad":"';
    const room = 1024 - marker.length - '"}'.length;
    const fitted = { type: 'pad', pad: 'a'.repeat(room) };
    expect(JSON.stringify(fitted).length).toBe(1024);
    expect(appendPassportEvidence(metadata, fitted).passport.evidence).toHaveLength(1);
    expect(() => appendPassportEvidence(metadata, { type: 'pad', pad: 'a'.repeat(room + 1) })).toThrow(
      /evidence_too_large/,
    );
    let bag = metadata;
    for (let i = 0; i < 32; i += 1) bag = appendPassportEvidence(bag, { type: 'note', n: i });
    expect(bag.passport.evidence).toHaveLength(32);
    expect(bag.passport.record.proof.proofValue).toBe(proof);
    expect(() => appendPassportEvidence(bag, { type: 'note', n: 32 })).toThrow(/evidence_cap/);
  });
});

describe('udiEvidence', () => {
  function passport() {
    const record = signPassport({ digitalIdentity: IDENTITY, ...issuer(), sealSerial: SEAL });
    const metadata = storePassport({ story: 'kept' }, { record, anchor: anchorFor(record) });
    return { record, metadata, proof: record.proof.proofValue };
  }

  it('stores a supplied UDI-DI and leaves the signature alone', () => {
    const { record, metadata, proof } = passport();
    const withInspection = appendPassportEvidence(metadata, {
      type: 'inspection',
      digest: 'sha256:' + 'ab'.repeat(32),
    });
    const stored = udiEvidence(withInspection, {
      udiDi: '  udi-supplied-1  ',
      udiPi: '  lot-9  ',
      category: 'medical',
      genuine: true,
    });
    expect(stored.stored).toBe(true);
    expect(stored.entry).toEqual({
      type: 'manufacturer_udi',
      udiDi: 'udi-supplied-1',
      udiPi: 'lot-9',
    });
    expect(stored.message).toBe(
      'The manufacturer supplied UDI-DI udi-supplied-1 as evidence on this passport. The category name did not assign it. It is not a certification.',
    );
    expect(stored.message).toBe(UDI_PRESENT_SENTENCE.replace('{udiDi}', () => 'udi-supplied-1'));
    expect(stored.metadata.passport.evidence).toEqual([
      { type: 'inspection', digest: 'sha256:' + 'ab'.repeat(32) },
      stored.entry,
    ]);
    expect(stored.metadata.passport.record.proof.proofValue).toBe(proof);
    expect(scanProvesGenuine(record, stored.metadata.passport.anchor, { now: NOW }).genuine).toBe(true);
    expect(JSON.stringify(stored.entry)).not.toMatch(/genuine|medical-device-udi/);
    expect(Object.hasOwn(stored, 'genuine')).toBe(false);
  });

  it('does not invent a UDI from a category or an inspection row', () => {
    const { metadata } = passport();
    const withInspection = appendPassportEvidence(metadata, { type: 'inspection', note: 'looked' });
    const fromCategory = udiEvidence(withInspection, { category: 'medical', name: 'Pump', udiPi: 'lot-9' });
    expect(fromCategory).toEqual({
      stored: false,
      entry: null,
      metadata: withInspection,
      message: UDI_ABSENT_SENTENCE,
    });
    expect(fromCategory.metadata.passport.evidence).toEqual([{ type: 'inspection', note: 'looked' }]);
    expect(udiEvidence(metadata, { udiDi: '   ' }).stored).toBe(false);
    expect(udiEvidence(metadata, null).message).toBe(UDI_ABSENT_SENTENCE);
    expect(udiEvidence({}, { udiDi: 'udi-supplied-1' })).toEqual({
      stored: false,
      entry: null,
      metadata: {},
      message: UDI_ABSENT_SENTENCE,
    });
  });

  it('omits an empty production identifier', () => {
    const { metadata } = passport();
    const stored = udiEvidence(metadata, { udiDi: 'udi-supplied-1', udiPi: '  ' });
    expect(stored.entry).toEqual({ type: 'manufacturer_udi', udiDi: 'udi-supplied-1' });
    expect(stored.entry.udiPi).toBeUndefined();
    const dollars = udiEvidence(metadata, { udiDi: 'DI$&1' });
    expect(dollars.message).toBe(
      'The manufacturer supplied UDI-DI DI$&1 as evidence on this passport. The category name did not assign it. It is not a certification.',
    );
  });

  it('rethrows when the evidence list is full', () => {
    const { metadata } = passport();
    let bag = metadata;
    for (let i = 0; i < 32; i += 1) bag = appendPassportEvidence(bag, { type: 'note', n: i });
    expect(() => udiEvidence(bag, { udiDi: 'udi-supplied-1' })).toThrow(/evidence_cap/);
  });
});

describe('genetics passport subject', () => {
  const coaSha256 = 'sha256:' + createHash('sha256').update('pdf-bytes').digest('hex');

  it('signs a cultivar id and a customer CoA hash without minting an identity', () => {
    const built = buildGeneticsPassportSubject({
      digitalIdentity: IDENTITY,
      cultivarId: 'Blue Dream',
      coaSha256,
      labName: 'Example Lab',
    });
    expect(built.digitalIdentity).toBe(IDENTITY);
    expect(built.digitalIdentity.includes('Blue')).toBe(false);
    expect(built.subject.gtin).toBeUndefined();
    const record = signPassport({ digitalIdentity: built.digitalIdentity, ...issuer(), subject: built.subject });
    expect(record.credentialSubject.id).toBe(IDENTITY);
    expect(record.credentialSubject.cultivarId).toBe('Blue Dream');
    expect(record.credentialSubject.coaSha256).toBe(coaSha256);
    expect(record.credentialSubject.labName).toBe('Example Lab');
    expect(record.credentialSubject.thcPercent).toBeUndefined();
    expect(record.credentialSubject.cbdPercent).toBeUndefined();
    expect(GENETICS_PASSPORT_SENTENCE).toBe(
      'A genetics passport can be signed from a cultivar id and the SHA-256 of a certificate of analysis the customer supplied. Issue #1553 is open. This is not a delivered service.',
    );
    const bare = buildGeneticsPassportSubject({
      digitalIdentity: IDENTITY,
      cultivarId: 'Cultivar',
      coaSha256,
    });
    expect(bare.subject.labName).toBeUndefined();
  });

  it('rejects cannabinoid fields, a file, and a missing hash', () => {
    expect(() => buildGeneticsPassportSubject({
      digitalIdentity: IDENTITY,
      cultivarId: 'Blue Dream',
      coaSha256,
      thcPercent: '18',
    })).toThrow(/subject_field_rejected/);
    expect(() => buildGeneticsPassportSubject({
      digitalIdentity: IDENTITY,
      cultivarId: 'Blue Dream',
      coaSha256,
      cbdPercent: '1',
    })).toThrow(/subject_field_rejected/);
    expect(() => buildGeneticsPassportSubject({
      digitalIdentity: IDENTITY,
      cultivarId: 'Blue Dream',
      coaSha256: Buffer.from('pdf-bytes'),
    })).toThrow(/subject_field_rejected/);
    expect(() => buildGeneticsPassportSubject({
      digitalIdentity: 'Blue Dream',
      cultivarId: 'Blue Dream',
      coaSha256,
    })).toThrow(/digital_identity_not_uri/);
    expect(() => buildGeneticsPassportSubject({
      digitalIdentity: IDENTITY,
      cultivarId: '   ',
      coaSha256,
    })).toThrow(/subject_field_rejected/);
  });
});
