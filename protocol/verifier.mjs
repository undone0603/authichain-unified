/**
 * Reference verifier for the AuthiChain Verification Specification v0.1.0.
 *
 * SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2026 AuthiChain Inc.
 *
 * Zero dependencies (node: builtins only). Verified on Node 22; the APIs used
 * are available from Node 18. Runs offline. Nothing here contacts an
 * AuthiChain server, and that is the point: a verifier you have to ask us to
 * run for you is not proof of anything.
 *
 *   node verifier.mjs record.json [anchor.json]
 *
 * Exit code 0 for `verified` / `valid-unanchored`, 1 for `invalid`.
 */

import { createHash, createPublicKey, verify as edVerify } from 'node:crypto';
import { readFileSync } from 'node:fs';

/** Chains considered production. A testnet anchor is not proof (SPEC §4.1). */
const MAINNET_CHAINS = new Set(['polygon:137', 'eip155:1', 'eip155:137']);

const REQUIRED_TOP = ['@context', 'type', 'issuer', 'validFrom', 'proof'];

/**
 * RFC 8785 (JCS) canonicalisation.
 *
 * Object keys sorted by UTF-16 code unit, no insignificant whitespace. Two
 * verifiers must derive byte-identical input from the same record, or a valid
 * signature will read as invalid depending on who serialised the JSON.
 */
export function canonicalize(value) {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(',')}]`;
  const keys = Object.keys(value).sort();
  const parts = keys
    .filter((k) => value[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalize(value[k])}`);
  return `{${parts.join(',')}}`;
}

/** The signed payload: the record minus proof.proofValue (SPEC §3.2). */
export function signingBytes(record) {
  const { proof, ...rest } = record;
  const { proofValue, ...proofRest } = proof ?? {};
  return Buffer.from(canonicalize({ ...rest, proof: proofRest }), 'utf8');
}

export function sha256Hex(bytes) {
  return createHash('sha256').update(bytes).digest('hex');
}

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';

/** base58btc decode. Used for did:key identifiers and proofValue. */
export function base58Decode(str) {
  let num = 0n;
  for (const ch of str) {
    const idx = B58.indexOf(ch);
    if (idx === -1) throw new Error(`invalid base58 character: ${ch}`);
    num = num * 58n + BigInt(idx);
  }
  const bytes = [];
  while (num > 0n) {
    bytes.unshift(Number(num & 0xffn));
    num >>= 8n;
  }
  // Leading '1's encode leading zero bytes.
  for (const ch of str) {
    if (ch !== '1') break;
    bytes.unshift(0);
  }
  return Buffer.from(bytes);
}

/**
 * Extract the raw Ed25519 public key from a did:key identifier.
 * did:key for Ed25519 is 'z' + base58btc(0xed 0x01 || 32-byte key).
 */
export function publicKeyFromDidKey(did) {
  const id = did.split('#')[0].replace(/^did:key:/, '');
  if (!id.startsWith('z')) throw new Error('did:key must use base58btc (z) encoding');
  const decoded = base58Decode(id.slice(1));
  if (decoded.length !== 34 || decoded[0] !== 0xed || decoded[1] !== 0x01) {
    throw new Error('not an Ed25519 did:key');
  }
  const raw = decoded.subarray(2);
  // Wrap the raw key in the SPKI DER prefix Node's crypto expects.
  const spki = Buffer.concat([
    Buffer.from('302a300506032b6570032100', 'hex'),
    raw,
  ]);
  return createPublicKey({ key: spki, format: 'der', type: 'spki' });
}

/**
 * Verify a record, and an anchor if supplied.
 * Returns { verdict, reasons[], checks{} } — verdict is exactly one of
 * 'verified' | 'valid-unanchored' | 'invalid' (SPEC §5.1).
 */
export function verifyRecord(record, anchor = null, opts = {}) {
  const reasons = [];
  const checks = {};
  const allowTestnet = opts.allowTestnet === true;
  const now = opts.now ? new Date(opts.now) : new Date();

  // 1. Required fields. Absence is rejection, not a warning.
  for (const field of REQUIRED_TOP) {
    if (record?.[field] === undefined) reasons.push(`missing_field:${field}`);
  }
  if (record?.credentialSubject?.id === undefined) {
    reasons.push('missing_field:credentialSubject.id');
  }
  if (reasons.length) return { verdict: 'invalid', reasons, checks };

  // 2 & 3. Resolve the key and verify the signature.
  try {
    const key = publicKeyFromDidKey(record.proof.verificationMethod ?? record.issuer);
    const sigStr = String(record.proof.proofValue ?? '');
    if (!sigStr.startsWith('z')) throw new Error('proofValue must be base58btc (z-prefixed)');
    const signature = base58Decode(sigStr.slice(1));
    const ok = edVerify(null, signingBytes(record), key, signature);
    checks.signature = ok;
    if (!ok) reasons.push('signature_invalid');
  } catch (err) {
    checks.signature = false;
    reasons.push(`signature_unverifiable:${err.message}`);
  }

  // 4. Validity window.
  const validFrom = new Date(record.validFrom);
  if (Number.isNaN(validFrom.getTime())) {
    reasons.push('validFrom_malformed');
  } else if (validFrom > now) {
    reasons.push('not_yet_valid');
  }
  if (record.validUntil) {
    const validUntil = new Date(record.validUntil);
    if (Number.isNaN(validUntil.getTime())) reasons.push('validUntil_malformed');
    else if (validUntil < now) reasons.push('expired');
  }

  if (reasons.length) return { verdict: 'invalid', reasons, checks };

  // No anchor is a legitimate state, and distinct from a failed one (SPEC §4.1).
  if (!anchor) {
    return { verdict: 'valid-unanchored', reasons, checks };
  }

  // 5. Hash commitment.
  const expected = sha256Hex(signingBytes(record));
  const claimed = String(anchor.recordHash ?? '').replace(/^sha256:/, '');
  checks.anchorHash = expected === claimed;
  if (!checks.anchorHash) reasons.push('anchor_hash_mismatch');

  // 6. Chain and transaction sanity.
  const chain = String(anchor.chain ?? '');
  if (!chain.includes(':')) {
    reasons.push('chain_not_caip2');
  } else if (!MAINNET_CHAINS.has(chain) && !allowTestnet) {
    // Explicit and loud: a testnet anchor is not production proof.
    reasons.push(`anchor_not_mainnet:${chain}`);
  }

  const txHash = String(anchor.txHash ?? '');
  if (chain.startsWith('eip155:') || chain.startsWith('polygon:')) {
    // A truncated hash is malformed, not "close enough" — display it and you
    // have published something that looks like proof and links nowhere.
    if (!/^0x[0-9a-fA-F]{64}$/.test(txHash)) reasons.push('tx_hash_malformed');
  } else if (!txHash) {
    reasons.push('tx_hash_missing');
  }

  if (reasons.length) return { verdict: 'invalid', reasons, checks };
  return { verdict: 'verified', reasons, checks };
}

// CLI
if (import.meta.url === `file://${process.argv[1]}`) {
  const [recordPath, anchorPath] = process.argv.slice(2);
  if (!recordPath) {
    console.error('usage: node verifier.mjs <record.json> [anchor.json]');
    process.exit(2);
  }
  const record = JSON.parse(readFileSync(recordPath, 'utf8'));
  const anchor = anchorPath ? JSON.parse(readFileSync(anchorPath, 'utf8')) : null;
  const result = verifyRecord(record, anchor, {
    allowTestnet: process.env.ALLOW_TESTNET === '1',
  });
  console.log(JSON.stringify(result, null, 2));
  process.exit(result.verdict === 'invalid' ? 1 : 0);
}
