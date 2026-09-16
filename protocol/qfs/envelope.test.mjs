import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign as edSign } from 'node:crypto';
import { signingBytes } from '../verifier.mjs';
import { toPacs008, verifyEnvelope, extractRecord, QFS_PROFILE, ISO20022_MSG } from './envelope.mjs';

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

function makeRecord() {
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
    proof: {
      type: 'Ed25519Signature2020',
      created: '2026-01-01T00:00:00Z',
      verificationMethod: `${did}#${did.slice(8)}`,
      proofPurpose: 'assertionMethod',
    },
  };
  const sig = edSign(null, signingBytes(record), privateKey);
  record.proof.proofValue = 'z' + base58Encode(sig);
  return record;
}

describe('QFS ISO 20022 envelope', () => {
  it('wraps a signed record as pacs.008 and verifies offline', () => {
    const record = makeRecord();
    const env = toPacs008(record, { created: '2026-09-16T15:00:00Z', amount: '0' });
    assert.equal(env.profile, QFS_PROFILE);
    assert.equal(env.ISO20022, ISO20022_MSG);
    assert.equal(extractRecord(env).credentialSubject.serial, 'SERIAL123');
    const tx = env.Document.FIToFICstmrCdtTrf.CdtTrfTxInf;
    assert.match(tx.PmtId.UETR, /^[0-9a-f-]{36}$/);
    assert.equal(tx.SplmtryData.Envlp.AuthiChain.digest.pqcAlg, 'ML-DSA-65');
    assert.equal(tx.SplmtryData.Envlp.AuthiChain.digest.pqcStatus, 'reserved');
    const verdict = verifyEnvelope(env);
    assert.equal(verdict.ok, true);
    assert.equal(verdict.status, 'valid-unanchored');
    assert.deepEqual(verdict.reasons, []);
  });

  it('rejects a tampered digest', () => {
    const record = makeRecord();
    const env = toPacs008(record);
    env.Document.FIToFICstmrCdtTrf.CdtTrfTxInf.SplmtryData.Envlp.AuthiChain.digest.sha256 =
      'sha256:deadbeef';
    const verdict = verifyEnvelope(env);
    assert.equal(verdict.ok, false);
    assert.ok(verdict.reasons.includes('digest-mismatch-sha256'));
  });

  it('rejects a missing record', () => {
    const verdict = verifyEnvelope({ profile: QFS_PROFILE, ISO20022: ISO20022_MSG, Document: {} });
    assert.equal(verdict.ok, false);
    assert.ok(verdict.reasons.includes('missing-authichain-record'));
  });
});
