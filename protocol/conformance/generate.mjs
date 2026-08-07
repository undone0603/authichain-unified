/**
 * Deterministically generate the conformance fixture set.
 *
 * SPDX-License-Identifier: Apache-2.0
 *
 *   node generate.mjs
 *
 * Signing keys are derived from fixed seeds, so re-running this reproduces the
 * committed fixtures byte for byte. That matters: a fixture set nobody can
 * regenerate is a fixture set nobody can audit.
 *
 * Fixtures are deliberately CLOCK-INDEPENDENT. Time-sensitive cases use dates
 * far enough out (year 2099 / year 2000) that any plausible system clock gives
 * the same verdict, so implementations need no clock-injection hook to conform.
 */

import { createPrivateKey, createPublicKey, sign as edSign, createHash } from 'node:crypto';
import { writeFileSync, mkdirSync, readdirSync, unlinkSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const OUT = join(HERE, 'fixtures');

const B58 = '123456789ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz';
function b58(buf) {
  let n = BigInt('0x' + (Buffer.from(buf).toString('hex') || '0'));
  let o = '';
  while (n > 0n) { o = B58[Number(n % 58n)] + o; n /= 58n; }
  for (const b of buf) { if (b !== 0) break; o = '1' + o; }
  return o;
}

/** Ed25519 keypair from a fixed 32-byte seed, so fixtures are reproducible. */
function keyFromSeed(seedHex) {
  const pkcs8 = Buffer.concat([
    Buffer.from('302e020100300506032b657004220420', 'hex'),
    Buffer.from(seedHex, 'hex'),
  ]);
  const privateKey = createPrivateKey({ key: pkcs8, format: 'der', type: 'pkcs8' });
  const publicKey = createPublicKey(privateKey);
  const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
  const did = 'did:key:z' + b58(Buffer.concat([Buffer.from([0xed, 0x01]), raw]));
  return { privateKey, did };
}

const ISSUER = keyFromSeed('00'.repeat(31) + '01');
const IMPOSTOR = keyFromSeed('00'.repeat(31) + '02');

/** RFC 8785 (JCS) canonicalisation — must match the spec exactly. */
function canonicalize(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(canonicalize).join(',')}]`;
  return `{${Object.keys(v).sort()
    .filter((k) => v[k] !== undefined)
    .map((k) => `${JSON.stringify(k)}:${canonicalize(v[k])}`)
    .join(',')}}`;
}

function signingBytes(record) {
  const { proof, ...rest } = record;
  const { proofValue, ...proofRest } = proof ?? {};
  return Buffer.from(canonicalize({ ...rest, proof: proofRest }), 'utf8');
}

/** Build a record and sign it with the issuer key. */
function signed(overrides = {}, key = ISSUER) {
  const rec = {
    '@context': ['https://www.w3.org/ns/credentials/v2', 'https://authichain.com/protocol/v1'],
    type: ['VerifiableCredential', 'ProvenanceRecord'],
    issuer: key.did,
    validFrom: '2020-01-01T00:00:00Z',
    credentialSubject: {
      id: 'https://id.gs1.org/01/09506000134352/21/SERIAL123',
      gtin: '09506000134352',
      serial: 'SERIAL123',
    },
    ...overrides,
    proof: {
      type: 'Ed25519Signature2020',
      created: '2020-01-01T00:00:00Z',
      verificationMethod: `${key.did}#key-1`,
      proofPurpose: 'assertionMethod',
      ...(overrides.proof ?? {}),
    },
  };
  rec.proof.proofValue = 'z' + b58(edSign(null, signingBytes(rec), key.privateKey));
  return rec;
}

function anchorFor(record, over = {}) {
  return {
    recordHash: 'sha256:' + createHash('sha256').update(signingBytes(record)).digest('hex'),
    chain: 'polygon:137',
    txHash: '0x' + 'a1'.repeat(32),
    anchoredAt: '2020-01-01T00:05:00Z',
    ...over,
  };
}

const cases = [];
function add(id, description, record, anchor, expect, options) {
  cases.push({ id, description, record, anchor: anchor ?? null, options: options ?? {}, expect });
}

// ── Valid paths ────────────────────────────────────────────────────────────
const base = signed();
add('valid-unanchored', 'Correctly signed record with no anchor supplied.',
  base, null, { verdict: 'valid-unanchored' });

add('valid-anchored-polygon', 'Correctly signed record with a well-formed Polygon mainnet anchor.',
  base, anchorFor(base), { verdict: 'verified' });

add('valid-anchored-ethereum', 'Same, on eip155:1.',
  base, anchorFor(base, { chain: 'eip155:1' }), { verdict: 'verified' });

// ── Canonicalisation: the highest-value adversarial vectors ────────────────
// An implementation that signs or hashes the raw file bytes instead of the JCS
// form will fail these while passing everything else. This is the single most
// common way a second implementation silently diverges.
const unsorted = signed();
const reordered = {
  proof: unsorted.proof,
  credentialSubject: {
    serial: unsorted.credentialSubject.serial,
    id: unsorted.credentialSubject.id,
    gtin: unsorted.credentialSubject.gtin,
  },
  validFrom: unsorted.validFrom,
  issuer: unsorted.issuer,
  type: unsorted.type,
  '@context': unsorted['@context'],
};
add('canon-key-order', 'Identical content with keys serialised in non-sorted order. Must verify — signatures are over the JCS form, not the file bytes.',
  reordered, null, { verdict: 'valid-unanchored' });

add('canon-anchor-key-order', 'Non-sorted key order with an anchor. The record hash must be computed over the JCS form, so the anchor still matches.',
  reordered, anchorFor(unsorted), { verdict: 'verified' });

const unicode = signed({
  credentialSubject: {
    id: 'https://id.gs1.org/01/09506000134352/21/S%C3%89RIE-1',
    gtin: '09506000134352',
    serial: 'SÉRIE-Ω-123   emoji:🔒',
  },
});
add('canon-unicode', 'Non-ASCII and U+2028 in the subject. Exercises UTF-8 handling and JCS string escaping.',
  unicode, null, { verdict: 'valid-unanchored' });

const nested = signed({
  credentialSubject: {
    id: 'https://id.gs1.org/01/09506000134352/21/NEST',
    events: [
      { stage: 'manufactured', at: '2020-01-01T09:00:00Z', location: 'US-MI' },
      { at: '2020-02-01T09:00:00Z', location: 'US-CA', stage: 'shipped' },
    ],
    meta: { z: 1, a: { y: 2, b: 3 } },
  },
});
add('canon-nested', 'Nested objects and arrays. Object keys sort at every depth; array order is significant and must NOT be sorted.',
  nested, null, { verdict: 'valid-unanchored' });

// ── Signature failures ─────────────────────────────────────────────────────
const tampered = JSON.parse(JSON.stringify(base));
tampered.credentialSubject.serial = 'TAMPERED';
add('sig-tampered-subject', 'Subject modified after signing.',
  tampered, null, { verdict: 'invalid', reasonsInclude: ['signature_invalid'] });

const tamperedIssuer = JSON.parse(JSON.stringify(base));
tamperedIssuer.validFrom = '2021-06-06T00:00:00Z';
add('sig-tampered-validfrom', 'validFrom modified after signing.',
  tamperedIssuer, null, { verdict: 'invalid', reasonsInclude: ['signature_invalid'] });

const wrongKey = signed({}, IMPOSTOR);
wrongKey.issuer = ISSUER.did;
wrongKey.proof.verificationMethod = `${ISSUER.did}#key-1`;
add('sig-wrong-key', 'Signed by a different key than the one named in verificationMethod.',
  wrongKey, null, { verdict: 'invalid', reasonsInclude: ['signature_invalid'] });

const truncatedSig = JSON.parse(JSON.stringify(base));
truncatedSig.proof.proofValue = base.proof.proofValue.slice(0, 20);
add('sig-truncated', 'proofValue truncated.',
  truncatedSig, null, { verdict: 'invalid' });

const unprefixedSig = JSON.parse(JSON.stringify(base));
unprefixedSig.proof.proofValue = base.proof.proofValue.slice(1);
add('sig-missing-multibase-prefix', 'proofValue without the base58btc "z" prefix.',
  unprefixedSig, null, { verdict: 'invalid' });

const notEd = JSON.parse(JSON.stringify(base));
notEd.proof.verificationMethod = 'did:key:z' + b58(Buffer.concat([Buffer.from([0xec, 0x01]), Buffer.alloc(32)]));
add('sig-non-ed25519-didkey', 'verificationMethod is a did:key with a non-Ed25519 multicodec (0xec = X25519).',
  notEd, null, { verdict: 'invalid' });

// ── Required fields ────────────────────────────────────────────────────────
for (const field of ['@context', 'type', 'issuer', 'validFrom', 'proof']) {
  const missing = JSON.parse(JSON.stringify(base));
  delete missing[field];
  add(`missing-${field.replace('@', 'at-')}`, `Required field "${field}" absent.`,
    missing, null, { verdict: 'invalid', reasonsInclude: [`missing_field:${field}`] });
}
const noSubjectId = JSON.parse(JSON.stringify(base));
delete noSubjectId.credentialSubject.id;
add('missing-subject-id', 'credentialSubject.id absent.',
  noSubjectId, null, { verdict: 'invalid', reasonsInclude: ['missing_field:credentialSubject.id'] });

// ── Validity window (clock-independent by construction) ────────────────────
add('time-not-yet-valid', 'validFrom in the year 2099 — not yet valid under any plausible clock.',
  signed({ validFrom: '2099-01-01T00:00:00Z' }), null,
  { verdict: 'invalid', reasonsInclude: ['not_yet_valid'] });

add('time-expired', 'validUntil in the year 2000 — expired under any plausible clock.',
  signed({ validUntil: '2000-01-01T00:00:00Z' }), null,
  { verdict: 'invalid', reasonsInclude: ['expired'] });

// ── Anchor failures ────────────────────────────────────────────────────────
add('anchor-hash-mismatch', 'Anchor commits a hash that is not this record.',
  base, anchorFor(base, { recordHash: 'sha256:' + '0'.repeat(64) }),
  { verdict: 'invalid', reasonsInclude: ['anchor_hash_mismatch'] });

// The two rules that exist because this project shipped violations of them.
add('anchor-testnet-rejected', 'Testnet anchor (Polygon Amoy) without opt-in. A testnet anchor is not proof.',
  base, anchorFor(base, { chain: 'eip155:80002' }),
  { verdict: 'invalid', reasonsInclude: ['anchor_not_mainnet:eip155:80002'] });

add('anchor-testnet-opt-in', 'Same testnet anchor with allowTestnet enabled.',
  base, anchorFor(base, { chain: 'eip155:80002' }),
  { verdict: 'verified' }, { allowTestnet: true });

add('anchor-tx-truncated', 'Transaction hash of 49 hex characters instead of 64. Must be rejected, not displayed.',
  base, anchorFor(base, { txHash: '0x' + 'e'.repeat(49) }),
  { verdict: 'invalid', reasonsInclude: ['tx_hash_malformed'] });

add('anchor-tx-no-0x', 'Transaction hash missing the 0x prefix.',
  base, anchorFor(base, { txHash: 'a1'.repeat(32) }),
  { verdict: 'invalid', reasonsInclude: ['tx_hash_malformed'] });

add('anchor-chain-not-caip2', 'Chain identifier is a bare name rather than CAIP-2.',
  base, anchorFor(base, { chain: 'polygon' }),
  { verdict: 'invalid', reasonsInclude: ['chain_not_caip2'] });

add('anchor-tx-missing', 'Anchor with no transaction hash at all.',
  base, anchorFor(base, { txHash: '' }),
  { verdict: 'invalid' });

// ── Emit ───────────────────────────────────────────────────────────────────
mkdirSync(OUT, { recursive: true });
for (const f of readdirSync(OUT)) {
  if (f.endsWith('.json')) unlinkSync(join(OUT, f));
}
for (const c of cases) {
  writeFileSync(join(OUT, `${c.id}.json`), JSON.stringify(c, null, 2) + '\n');
}
const ids = cases.map((c) => c.id);
if (new Set(ids).size !== ids.length) throw new Error('duplicate fixture id');
writeFileSync(join(HERE, 'manifest.json'), JSON.stringify({
  version: '0.1.0',
  specVersion: '0.1.0',
  count: cases.length,
  fixtures: ids,
}, null, 2) + '\n');

console.log(`wrote ${cases.length} fixtures to ${OUT}`);
