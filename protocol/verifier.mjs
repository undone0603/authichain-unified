/**
 * Reference verifier for the AuthiChain Verification Specification v0.1.0.
 *
 * SPDX-License-Identifier: Apache-2.0
 * Copyright (c) 2026 Zachary Kietzman (AuthiChain)
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
import { fileURLToPath } from 'node:url';

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

/** base58btc encode (inverse of base58Decode). */
export function base58Encode(bytes) {
  const buf = Buffer.from(bytes);
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

/**
 * did:key for an Ed25519 public JWK ({ kty: 'OKP', crv: 'Ed25519', x }).
 * Lets you pin a record's signer to a key published in a JWKS.
 */
export function didKeyFromJwk(jwk) {
  if (jwk?.kty !== 'OKP' || jwk?.crv !== 'Ed25519' || typeof jwk?.x !== 'string') {
    throw new Error('not an Ed25519 OKP JWK');
  }
  const raw = Buffer.from(jwk.x, 'base64url');
  if (raw.length !== 32) throw new Error('Ed25519 JWK x must be 32 bytes');
  return 'did:key:z' + base58Encode(Buffer.concat([Buffer.from([0xed, 0x01]), raw]));
}

/**
 * Verify a record, and an anchor if supplied.
 * Pass opts.jwks to also require that the signer is a key in that JWKS.
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

  // Optional: pin the signer to a key in a JWKS the caller already holds.
  if (opts.jwks) {
    const signer = String(record.proof.verificationMethod ?? record.issuer).split('#')[0];
    const pinned = (Array.isArray(opts.jwks.keys) ? opts.jwks.keys : []).some((k) => {
      try {
        return didKeyFromJwk(k) === signer;
      } catch {
        return false;
      }
    });
    checks.issuerInJwks = pinned;
    if (!pinned) reasons.push('issuer_not_in_jwks');
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

/** JWS `typ` for AuthiChain attestation seals (docs/attestation/v0.1.md). */
export const ATTESTATION_TYP = 'AC-ATTESTATION+JWS';

function b64urlDecode(part) {
  if (typeof part !== 'string' || !/^[A-Za-z0-9_-]*$/.test(part)) {
    throw new Error('not base64url');
  }
  return Buffer.from(part, 'base64url');
}

/**
 * Verify a compact-JWS attestation seal offline against a JWKS you already
 * hold (for example a saved copy of https://authichain.com/protocol/jwks.json).
 *
 * Checks: the header is EdDSA with typ AC-ATTESTATION+JWS, the `kid` is in
 * the JWKS as an Ed25519 OKP key, the signature verifies, the payload has not
 * expired, and the issuer signed `decision: verified` with `status: active`.
 *
 * It does NOT check live revocation or supersession: that status lives in the
 * issuer's registry and needs a network call. A valid signature proves the
 * issuer signed this payload; it does not by itself prove the physical item in
 * hand is the one the payload names (docs/attestation/v0.1.md, rule 5).
 *
 * Returns { verdict: 'valid-offline' | 'invalid', reasons[], checks{}, header, payload }.
 */
export function verifyAttestationJws(jws, jwks, opts = {}) {
  const reasons = [];
  const checks = {};
  const now = opts.now ? new Date(opts.now) : new Date();
  let header = null;
  let payload = null;

  const parts = String(jws ?? '').trim().split('.');
  if (parts.length !== 3) {
    return { verdict: 'invalid', reasons: ['jws_malformed'], checks, header, payload };
  }
  try {
    header = JSON.parse(b64urlDecode(parts[0]).toString('utf8'));
    payload = JSON.parse(b64urlDecode(parts[1]).toString('utf8'));
  } catch {
    return { verdict: 'invalid', reasons: ['jws_malformed'], checks, header, payload };
  }

  if (header?.alg !== 'EdDSA') reasons.push(`alg_unsupported:${header?.alg}`);
  if (header?.typ !== ATTESTATION_TYP) reasons.push(`typ_unexpected:${header?.typ}`);

  const keys = Array.isArray(jwks?.keys) ? jwks.keys : [];
  const jwk = typeof header?.kid === 'string' ? keys.find((k) => k && k.kid === header.kid) : undefined;
  checks.kid = Boolean(jwk);
  if (!jwk) {
    reasons.push('kid_not_in_jwks');
  } else if (jwk.kty !== 'OKP' || jwk.crv !== 'Ed25519' || typeof jwk.x !== 'string') {
    reasons.push('jwk_not_ed25519');
  } else if (reasons.length === 0) {
    try {
      const key = createPublicKey({ key: { kty: 'OKP', crv: 'Ed25519', x: jwk.x }, format: 'jwk' });
      const ok = edVerify(null, Buffer.from(`${parts[0]}.${parts[1]}`, 'ascii'), key, b64urlDecode(parts[2]));
      checks.signature = ok;
      if (!ok) reasons.push('signature_invalid');
    } catch (err) {
      checks.signature = false;
      reasons.push(`signature_unverifiable:${err.message}`);
    }
  }
  if (checks.signature !== true) {
    return { verdict: 'invalid', reasons, checks, header, payload };
  }

  if (payload?.expires_at !== undefined) {
    const exp = new Date(payload.expires_at);
    if (Number.isNaN(exp.getTime())) reasons.push('expires_at_malformed');
    else if (exp < now) reasons.push('expired');
  }
  if (payload?.decision !== 'verified') reasons.push(`decision:${payload?.decision}`);
  if (payload?.status !== 'active') reasons.push(`status:${payload?.status}`);

  return { verdict: reasons.length ? 'invalid' : 'valid-offline', reasons, checks, header, payload };
}

// CLI
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
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
