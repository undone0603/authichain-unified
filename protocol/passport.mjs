/**
 * Product passport and digital identity.
 *
 * SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2026 Zachary Kietzman (AuthiChain)
 *
 * A product's digital identity is credentialSubject.id. A scan proves that
 * passport genuine only when the reference verifier returns `verified`.
 * verifier.mjs is unchanged. This module does not assign a GTIN.
 */

import { sign as edSign } from 'node:crypto';
import { verifyRecord, signingBytes } from './verifier.mjs';

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

/**
 * Sign a DigitalProductPassport for one digital identity.
 * privateKey is an Ed25519 key from node:crypto. issuer is its did:key.
 */
export function signPassport({ digitalIdentity, privateKey, issuer, validFrom, serial, gtin }) {
  const id = assertDigitalIdentity(digitalIdentity);
  if (!privateKey) throw new Error('private_key_required');
  if (typeof issuer !== 'string' || !issuer.startsWith('did:key:')) {
    throw new Error('issuer_did_key_required');
  }
  if (gtin !== undefined && gtin !== null && !/^\d{14}$/.test(String(gtin))) {
    throw new Error('gtin_not_14_digits');
  }
  const subject = { id };
  if (serial) subject.serial = String(serial);
  if (gtin !== undefined && gtin !== null) subject.gtin = String(gtin);
  const issuedAt = validFrom ?? '2026-01-01T00:00:00Z';
  const record = {
    '@context': [
      'https://www.w3.org/ns/credentials/v2',
      'https://authichain.com/protocol/v1',
    ],
    type: ['VerifiableCredential', 'DigitalProductPassport'],
    issuer,
    validFrom: issuedAt,
    credentialSubject: subject,
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
  const result = verifyRecord(record, anchor, opts);
  return {
    genuine: result.verdict === 'verified',
    digitalIdentity,
    verdict: result.verdict,
    reasons: result.reasons,
  };
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
