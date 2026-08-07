import { describe, it, expect } from 'vitest';
import { generateKeyPairSync, sign as edSign, createHash } from 'node:crypto';
import {
  verifyRecord,
  signingBytes,
  canonicalize,
  base58Decode,
  publicKeyFromDidKey,
} from './verifier.mjs';

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

/** Build a real signed record with a freshly generated Ed25519 key. */
function makeRecord(overrides = {}) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const raw = publicKey.export({ format: 'der', type: 'spki' }).subarray(-32);
  const did = 'did:key:z' + base58Encode(Buffer.concat([Buffer.from([0xed, 0x01]), raw]));

  const record = {
    '@context': ['https://www.w3.org/ns/credentials/v2', 'https://authichain.com/protocol/v1'],
    type: ['VerifiableCredential', 'ProvenanceRecord'],
    issuer: did,
    validFrom: '2026-01-01T00:00:00Z',
    credentialSubject: {
      id: 'https://id.gs1.org/01/09506000134352/21/SERIAL123',
      gtin: '09506000134352',
      serial: 'SERIAL123',
    },
    ...overrides,
    proof: {
      type: 'Ed25519Signature2020',
      created: '2026-01-01T00:00:00Z',
      verificationMethod: `${did}#${did.slice(8)}`,
      proofPurpose: 'assertionMethod',
      ...(overrides.proof ?? {}),
    },
  };

  const sig = edSign(null, signingBytes(record), privateKey);
  record.proof.proofValue = 'z' + base58Encode(sig);
  return record;
}

function anchorFor(record, over = {}) {
  return {
    recordHash: 'sha256:' + createHash('sha256').update(signingBytes(record)).digest('hex'),
    chain: 'polygon:137',
    txHash: '0x' + 'a'.repeat(64),
    anchoredAt: '2026-01-01T00:05:00Z',
    ...over,
  };
}

const NOW = '2026-06-01T00:00:00Z';

describe('canonicalize', () => {
  it('sorts keys so two serialisations agree', () => {
    expect(canonicalize({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
    expect(canonicalize({ a: 2, b: 1 })).toBe(canonicalize({ b: 1, a: 2 }));
  });

  it('handles nesting and arrays without reordering array elements', () => {
    expect(canonicalize({ z: [3, 1, 2], a: { y: 1, x: 2 } })).toBe('{"a":{"x":2,"y":1},"z":[3,1,2]}');
  });
});

describe('base58 / did:key', () => {
  it('round-trips through decode', () => {
    expect(base58Decode(base58Encode(Buffer.from([1, 2, 3, 250])))).toEqual(Buffer.from([1, 2, 3, 250]));
  });

  it('rejects a did:key that is not Ed25519', () => {
    const notEd = 'did:key:z' + base58Encode(Buffer.concat([Buffer.from([0xec, 0x01]), Buffer.alloc(32)]));
    expect(() => publicKeyFromDidKey(notEd)).toThrow(/not an Ed25519/);
  });
});

describe('verifyRecord — valid paths', () => {
  it('returns valid-unanchored for a good record with no anchor', () => {
    const r = verifyRecord(makeRecord(), null, { now: NOW });
    expect(r.verdict).toBe('valid-unanchored');
    expect(r.checks.signature).toBe(true);
    expect(r.reasons).toEqual([]);
  });

  it('returns verified for a good record with a good mainnet anchor', () => {
    const rec = makeRecord();
    const r = verifyRecord(rec, anchorFor(rec), { now: NOW });
    expect(r.verdict).toBe('verified');
    expect(r.checks.anchorHash).toBe(true);
  });
});

describe('verifyRecord — rejects tampering', () => {
  it('detects a modified subject after signing', () => {
    const rec = makeRecord();
    rec.credentialSubject.serial = 'TAMPERED';
    const r = verifyRecord(rec, null, { now: NOW });
    expect(r.verdict).toBe('invalid');
    expect(r.reasons).toContain('signature_invalid');
  });

  it('detects an anchor whose hash does not match the record', () => {
    const rec = makeRecord();
    const bad = anchorFor(rec, { recordHash: 'sha256:' + '0'.repeat(64) });
    const r = verifyRecord(rec, bad, { now: NOW });
    expect(r.verdict).toBe('invalid');
    expect(r.reasons).toContain('anchor_hash_mismatch');
  });
});

describe('verifyRecord — required fields', () => {
  it.each(['@context', 'type', 'issuer', 'validFrom', 'proof'])('rejects a record missing %s', (field) => {
    const rec = makeRecord();
    delete rec[field];
    const r = verifyRecord(rec, null, { now: NOW });
    expect(r.verdict).toBe('invalid');
    expect(r.reasons).toContain(`missing_field:${field}`);
  });

  it('rejects a record with no credentialSubject.id', () => {
    const rec = makeRecord();
    delete rec.credentialSubject.id;
    const r = verifyRecord(rec, null, { now: NOW });
    expect(r.reasons).toContain('missing_field:credentialSubject.id');
  });
});

describe('verifyRecord — validity window', () => {
  it('rejects a record that is not yet valid', () => {
    const rec = makeRecord({ validFrom: '2030-01-01T00:00:00Z' });
    expect(verifyRecord(rec, null, { now: NOW }).reasons).toContain('not_yet_valid');
  });

  it('rejects an expired record', () => {
    const rec = makeRecord({ validUntil: '2026-02-01T00:00:00Z' });
    expect(verifyRecord(rec, null, { now: NOW }).reasons).toContain('expired');
  });
});

describe('verifyRecord — the failure modes that motivated this spec', () => {
  // These two cases are exactly what docs/strategy/AUTHENTICITY_INDEX.md
  // published as proof: testnet anchors, and a transaction hash that was 49 hex
  // characters rather than 64. A conforming verifier must refuse both.

  it('refuses to call a testnet anchor verified', () => {
    const rec = makeRecord();
    const amoy = anchorFor(rec, { chain: 'eip155:80002' });
    const r = verifyRecord(rec, amoy, { now: NOW });
    expect(r.verdict).toBe('invalid');
    expect(r.reasons).toContain('anchor_not_mainnet:eip155:80002');
  });

  it('accepts a testnet anchor only when explicitly opted in', () => {
    const rec = makeRecord();
    const amoy = anchorFor(rec, { chain: 'eip155:80002' });
    expect(verifyRecord(rec, amoy, { now: NOW, allowTestnet: true }).verdict).toBe('verified');
  });

  it('rejects a truncated transaction hash instead of displaying it', () => {
    const rec = makeRecord();
    const truncated = anchorFor(rec, { txHash: '0x' + 'e'.repeat(49) });
    const r = verifyRecord(rec, truncated, { now: NOW });
    expect(r.verdict).toBe('invalid');
    expect(r.reasons).toContain('tx_hash_malformed');
  });

  it('rejects a chain identifier that is not CAIP-2', () => {
    const rec = makeRecord();
    const r = verifyRecord(rec, anchorFor(rec, { chain: 'polygon' }), { now: NOW });
    expect(r.reasons).toContain('chain_not_caip2');
  });
});

describe('verifyRecord — verdict discipline', () => {
  it('only ever returns one of the three specified verdicts', () => {
    const cases = [
      [makeRecord(), null],
      [makeRecord(), anchorFor(makeRecord())],
      [{}, null],
    ];
    for (const [rec, anchor] of cases) {
      expect(['verified', 'valid-unanchored', 'invalid']).toContain(
        verifyRecord(rec, anchor, { now: NOW }).verdict,
      );
    }
  });

  it('never reports verified when any reason was recorded', () => {
    const rec = makeRecord();
    const r = verifyRecord(rec, anchorFor(rec, { chain: 'eip155:80002' }), { now: NOW });
    expect(r.reasons.length).toBeGreaterThan(0);
    expect(r.verdict).not.toBe('verified');
  });
});
