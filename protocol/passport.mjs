/**
 * Product passport and digital identity.
 *
 * SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2026 Zachary Kietzman (AuthiChain)
 *
 * A product's digital identity is credentialSubject.id. A scan proves that
 * passport genuine only when the reference verifier returns `verified`.
 * A seal serial is a separate productBinding. It does not change genuine.
 * verifier.mjs is unchanged. This module does not assign a GTIN.
 */

import { createHash, timingSafeEqual, sign as edSign } from 'node:crypto';
import { verifyRecord, signingBytes } from './verifier.mjs';

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
const SHA256_FIELD = /^sha256:[0-9a-f]{64}$/;
const FORBIDDEN_SUBJECT_KEYS = new Set([
  'thcPercent',
  'cbdPercent',
  'nfcMatch',
  'visualMatch',
  'genuine',
]);
const OPTIONAL_SUBJECT_KEYS = new Set([
  'serial',
  'gtin',
  'sealSerialSha256',
  'resolverHost',
  'cultivarId',
  'coaSha256',
  'labName',
  'batteryCategory',
  'packageId',
]);
const SEAL_SENTENCE =
  'This scan presented the seal serial committed in the signed passport for {digitalIdentity}. The passport signature verified. The chain transaction was not read, so publication of the hash is not confirmed. The seal serial is not in the QR. A copy of the QR alone does not pass this check. The commitment match does not prove the issuer attached that seal to the named object.';

function plainObject(value) {
  return !!value && typeof value === 'object' && !Array.isArray(value);
}

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

/** The product's digital identity. It must be a URI. This does not mint a GTIN. */
export function assertDigitalIdentity(id) {
  if (typeof id !== 'string' || id.length < 1 || id.length > 512) {
    throw new Error('digital_identity_required');
  }
  if (!/^[a-z][a-z0-9+.-]*:/i.test(id)) {
    throw new Error('digital_identity_not_uri');
  }
  return id;
}

function hashSealSerial(sealSerial) {
  if (typeof sealSerial !== 'string' || sealSerial.length < 16 || sealSerial.length > 128) {
    throw new Error('seal_serial_invalid');
  }
  return 'sha256:' + createHash('sha256').update(sealSerial, 'utf8').digest('hex');
}

function rejectCleartextSeal(value, sealSerial) {
  if (typeof sealSerial !== 'string' || sealSerial.length === 0) return;
  if (typeof value === 'string') {
    if (value === sealSerial) throw new Error('seal_serial_in_clear');
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) rejectCleartextSeal(item, sealSerial);
    return;
  }
  if (plainObject(value)) {
    for (const key of Object.keys(value)) rejectCleartextSeal(value[key], sealSerial);
  }
}

function rejectGenuineKey(value) {
  if (Array.isArray(value)) {
    for (const item of value) rejectGenuineKey(item);
    return;
  }
  if (!plainObject(value)) return;
  for (const key of Object.keys(value)) {
    if (key === 'genuine') throw new Error('evidence_genuine_forbidden');
    rejectGenuineKey(value[key]);
  }
}

/**
 * Sign a DigitalProductPassport for one digital identity.
 * privateKey is an Ed25519 key from node:crypto. issuer is its did:key.
 * sealSerial is hashed into credentialSubject.sealSerialSha256. The serial
 * itself is not stored.
 */
export function signPassport({
  digitalIdentity,
  privateKey,
  issuer,
  validFrom,
  serial,
  gtin,
  sealSerial,
  subject,
}) {
  const id = assertDigitalIdentity(digitalIdentity);
  if (!privateKey) throw new Error('private_key_required');
  if (typeof issuer !== 'string' || !issuer.startsWith('did:key:')) {
    throw new Error('issuer_did_key_required');
  }
  const extra = subject === undefined || subject === null ? {} : subject;
  if (!plainObject(extra)) throw new Error('subject_field_rejected');
  const built = { id };
  if (serial) built.serial = String(serial);
  if (gtin !== undefined && gtin !== null) built.gtin = String(gtin);
  for (const key of Object.keys(extra)) {
    if (FORBIDDEN_SUBJECT_KEYS.has(key) || !OPTIONAL_SUBJECT_KEYS.has(key)) {
      throw new Error('subject_field_rejected');
    }
    if (key === 'serial' || key === 'gtin' || key === 'sealSerialSha256') continue;
    const value = extra[key];
    if (typeof value !== 'string' || value.length < 1 || value.length > 512) {
      throw new Error('subject_field_rejected');
    }
    if (key === 'coaSha256' && !SHA256_FIELD.test(value)) throw new Error('subject_field_rejected');
    built[key] = value;
  }
  if (extra.serial !== undefined && extra.serial !== null) {
    if (typeof extra.serial !== 'string' || extra.serial.length < 1) {
      throw new Error('subject_field_rejected');
    }
    if (built.serial !== undefined && built.serial !== extra.serial) {
      throw new Error('subject_field_rejected');
    }
    built.serial = extra.serial;
  }
  if (extra.gtin !== undefined && extra.gtin !== null) {
    if (built.gtin !== undefined && built.gtin !== String(extra.gtin)) {
      throw new Error('subject_field_rejected');
    }
    built.gtin = String(extra.gtin);
  }
  if (built.gtin !== undefined && !/^\d{14}$/.test(built.gtin)) throw new Error('gtin_not_14_digits');
  let commitment = null;
  if (sealSerial !== undefined && sealSerial !== null) commitment = hashSealSerial(sealSerial);
  if (extra.sealSerialSha256 !== undefined && extra.sealSerialSha256 !== null) {
    if (typeof extra.sealSerialSha256 !== 'string' || !SHA256_FIELD.test(extra.sealSerialSha256)) {
      throw new Error('subject_field_rejected');
    }
    if (commitment && commitment !== extra.sealSerialSha256) throw new Error('subject_field_rejected');
    commitment = extra.sealSerialSha256;
  }
  if (commitment) built.sealSerialSha256 = commitment;
  rejectCleartextSeal(built, sealSerial);
  const subjectOut = built;
  const issuedAt = validFrom ?? '2026-01-01T00:00:00Z';
  const record = {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://authichain.com/protocol/v1',
    ],
    type: ['VerifiableCredential', 'DigitalProductPassport'],
    issuer,
    validFrom: issuedAt,
    credentialSubject: subjectOut,
    proof: {
      type: 'Ed25519Signature2020',
      created: issuedAt,
      verificationMethod: `${issuer}#${issuer.slice('did:key:'.length)}`,
      proofPurpose: 'assertionMethod',
    },
  };
  const signature = edSign(null, signingBytes(record), privateKey);
  record.proof.proofValue = 'z' + base58Encode(signature);
  return record;
}

/**
 * A scan proves the product passport genuine when the digital identity is
 * present and verifyRecord returns verified. An unanchored signature is not
 * that proof. A ProvenanceRecord is not a product passport.
 */
export function scanProvesGenuine(record, anchor = null, opts = {}) {
  const types = Array.isArray(record?.type) ? record.type : [];
  const digitalIdentity = record?.credentialSubject?.id ?? null;
  if (!types.includes('VerifiableCredential') || !types.includes('DigitalProductPassport')) {
    return {
      genuine: false,
      digitalIdentity: typeof digitalIdentity === 'string' ? digitalIdentity : null,
      verdict: 'invalid',
      reasons: ['not_a_product_passport'],
    };
  }
  try {
    assertDigitalIdentity(digitalIdentity);
  } catch (err) {
    return {
      genuine: false,
      digitalIdentity: null,
      verdict: 'invalid',
      reasons: [err.message],
    };
  }
  const gtin = record?.credentialSubject?.gtin;
  if (gtin !== undefined && gtin !== null && (typeof gtin !== 'string' || !/^\d{14}$/.test(gtin))) {
    return {
      genuine: false,
      digitalIdentity,
      verdict: 'invalid',
      reasons: ['gtin_not_14_digits'],
    };
  }
  const result = verifyRecord(record, anchor, opts);
  return {
    genuine: result.verdict === 'verified',
    digitalIdentity,
    verdict: result.verdict,
    reasons: result.reasons,
  };
}

/**
 * Place an already-signed passport on a metadata object.
 * `passport` is the record, or `{ record, anchor }`. This does not assign a
 * GTIN and does not write a database. The digital identity stays
 * `credentialSubject.id`.
 */
export function storePassport(metadata, passport, anchor) {
  if (!plainObject(passport)) throw new Error('passport_required');
  const types = Array.isArray(passport.type) ? passport.type : [];
  let record = passport;
  let resolved = anchor;
  if (!types.includes('DigitalProductPassport')) {
    if (types.length > 0) throw new Error('not_a_product_passport');
    if (!plainObject(passport.record)) throw new Error('passport_record_required');
    record = passport.record;
    if (resolved === undefined) resolved = passport.anchor ?? null;
  }
  const recordTypes = Array.isArray(record.type) ? record.type : [];
  if (!recordTypes.includes('VerifiableCredential') || !recordTypes.includes('DigitalProductPassport')) {
    throw new Error('not_a_product_passport');
  }
  assertDigitalIdentity(record?.credentialSubject?.id);
  const gtin = record?.credentialSubject?.gtin;
  if (gtin !== undefined && gtin !== null && (typeof gtin !== 'string' || !/^\d{14}$/.test(gtin))) {
    throw new Error('gtin_not_14_digits');
  }
  if (resolved != null && !plainObject(resolved)) throw new Error('passport_anchor_invalid');
  const base = plainObject(metadata) ? { ...metadata } : {};
  const stored = { record };
  if (resolved) stored.anchor = resolved;
  return { ...base, passport: stored };
}

/** Metadata for a product save when the caller already supplied a passport. */
export function productPassportMetadata(input) {
  if (!plainObject(input)) return null;
  const bag = plainObject(input.metadata) ? input.metadata : {};
  if (input.passport != null) return storePassport(bag, input.passport);
  if (bag.passport != null) return storePassport(bag, bag.passport);
  return null;
}

export function digitalIdentityOf(metadata) {
  const id = metadata?.passport?.record?.credentialSubject?.id;
  return typeof id === 'string' ? id : null;
}

function binding(method, pass, reason) {
  return { method, pass, reason, samePassport: true };
}

function sealCommitment(record) {
  const value = record?.credentialSubject?.sealSerialSha256;
  return typeof value === 'string' && SHA256_FIELD.test(value) ? value : null;
}

/**
 * Compare a presented seal serial to the signed commitment.
 * pass is the hash match. It does not change genuine. A second call is the
 * same passport.
 */
export function checkSealSerial(record, presentedSerial) {
  const commitment = sealCommitment(record);
  if (presentedSerial === undefined || presentedSerial === null || presentedSerial === '') {
    return binding(
      commitment ? 'seal_serial_sha256' : 'none',
      false,
      commitment ? 'seal_serial_missing' : 'seal_commitment_missing',
    );
  }
  if (typeof presentedSerial !== 'string' || presentedSerial.length < 16 || presentedSerial.length > 128) {
    return binding('none', false, 'seal_serial_invalid');
  }
  if (!commitment) return binding('none', false, 'seal_commitment_missing');
  const digest = createHash('sha256').update(presentedSerial, 'utf8').digest();
  const expected = Buffer.from(commitment.slice('sha256:'.length), 'hex');
  const pass = expected.length === digest.length && timingSafeEqual(digest, expected);
  return binding('seal_serial_sha256', pass, pass ? null : 'seal_commitment_mismatch');
}

function callerFlagPresent(observation) {
  return Object.prototype.hasOwnProperty.call(observation, 'nfcMatch')
    || Object.prototype.hasOwnProperty.call(observation, 'visualMatch');
}

/** Server observation only. A presented seal wins over a caller flag. */
export function productBindingFor(record, observation) {
  const obs = plainObject(observation) ? observation : null;
  const hasSealKey = !!obs && Object.prototype.hasOwnProperty.call(obs, 'sealSerial');
  const seal = hasSealKey ? obs.sealSerial : undefined;
  const sealPresented = typeof seal === 'string' && seal.length > 0;
  if (hasSealKey && !sealPresented && seal !== undefined && seal !== null && typeof seal !== 'string') {
    return binding('none', false, 'seal_serial_invalid');
  }
  if (!sealPresented && obs && callerFlagPresent(obs)) {
    return binding('none', false, 'caller_flag_not_a_binding');
  }
  return checkSealSerial(record, sealPresented ? seal : undefined);
}

/**
 * The passport scan plus productBinding. scanProvesGenuine is unchanged.
 * An absent observation does not invent a binding method.
 */
export function scanPassport(record, anchor = null, observation = null, opts = {}) {
  const scan = scanProvesGenuine(record, anchor, opts);
  return { ...scan, productBinding: productBindingFor(record, observation) };
}

/**
 * The product-genuine sentence. Only a genuine passport whose seal commitment
 * matched, and only when the chain transaction was not read.
 */
export function productBindingSentence(scan) {
  if (!scan || scan.genuine !== true) return null;
  const bound = scan.productBinding;
  if (!bound || bound.method !== 'seal_serial_sha256' || bound.pass !== true) return null;
  if (scan.anchorTransactionQueried === true) return null;
  const id = typeof scan.digitalIdentity === 'string' ? scan.digitalIdentity : '';
  return SEAL_SENTENCE.replace('{digitalIdentity}', id);
}

/**
 * Append one evidence entry beside the signed passport. This does not re-sign
 * the record and does not set genuine. The array holds at most 32 entries.
 */
export function appendPassportEvidence(metadata, entry) {
  if (!plainObject(metadata) || !plainObject(metadata.passport)) throw new Error('passport_required');
  if (!plainObject(entry)) throw new Error('evidence_required');
  rejectGenuineKey(entry);
  if (JSON.stringify(entry).length > 1024) throw new Error('evidence_too_large');
  const existing = metadata.passport.evidence;
  const list = existing === undefined ? [] : existing;
  if (!Array.isArray(list)) throw new Error('evidence_invalid');
  if (list.length >= 32) throw new Error('evidence_cap');
  return {
    ...metadata,
    passport: {
      ...metadata.passport,
      evidence: [...list, entry],
    },
  };
}

export const UDI_PRESENT_SENTENCE =
  'The manufacturer supplied UDI-DI {udiDi} as evidence on this passport. The category name did not assign it. It is not a certification.';
export const UDI_ABSENT_SENTENCE =
  'No manufacturer-supplied UDI is stored on this passport.';

function suppliedText(value) {
  if (typeof value !== 'string') return '';
  return value.trim();
}

/**
 * Store a UDI only when the manufacturer supplies udiDi.
 * The category word does not assign one. The row does not set genuine.
 */
export function udiEvidence(metadata, input) {
  const supplied = plainObject(input) ? input : {};
  const udiDi = suppliedText(supplied.udiDi);
  const udiPi = suppliedText(supplied.udiPi);
  if (!udiDi) {
    return { stored: false, entry: null, metadata, message: UDI_ABSENT_SENTENCE };
  }
  const entry = { type: 'manufacturer_udi', udiDi };
  if (udiPi) entry.udiPi = udiPi;
  try {
    const next = appendPassportEvidence(metadata, entry);
    return {
      stored: true,
      entry,
      metadata: next,
      message: UDI_PRESENT_SENTENCE.replace('{udiDi}', () => udiDi),
    };
  } catch (err) {
    if (err && err.message === 'passport_required') {
      return { stored: false, entry: null, metadata, message: UDI_ABSENT_SENTENCE };
    }
    throw err;
  }
}

/**
 * Scan entry used by the CLI. A product passport exits 0 only when genuine.
 * Any other record keeps the reference verifier's exit rule.
 */
export function verifyScan(record, anchor = null, opts = {}) {
  const types = Array.isArray(record?.type) ? record.type : [];
  if (types.includes('DigitalProductPassport')) {
    const body = scanProvesGenuine(record, anchor, opts);
    return { exitCode: body.genuine ? 0 : 1, body };
  }
  const body = verifyRecord(record, anchor, opts);
  return { exitCode: body.verdict === 'invalid' ? 1 : 0, body };
}
