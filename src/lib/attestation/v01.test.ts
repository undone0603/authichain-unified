import { describe, expect, it } from 'vitest';
import { verifyAttestationJws, validateAttestation, canonicalize } from './v01';
import fixture from '../../../fixtures/attestation-v0.1-valid.json';
import jwks from '../../../fixtures/attestation-v0.1-jwks.json';
import fs from 'node:fs';
import path from 'node:path';

const validJws = fs.readFileSync(path.join(process.cwd(), 'fixtures/attestation-v0.1-valid.jws'), 'utf8').trim();
const tamperedJws = fs.readFileSync(path.join(process.cwd(), 'fixtures/attestation-v0.1-tampered.jws'), 'utf8').trim();

describe('AuthiChain Attestation Contract v0.1', () => {
  it('verifies the canonical signed fixture', async () => {
    const attestation = await verifyAttestationJws(validJws, jwks.keys[0]);
    expect(canonicalize(attestation as never)).toBe(canonicalize(fixture as never));
    expect(attestation.decision).toBe('verified');
  });

  it('rejects a tampered payload', async () => {
    await expect(verifyAttestationJws(tamperedJws, jwks.keys[0])).rejects.toThrow();
  });

  it('rejects a valid signature paired with the wrong key id', async () => {
    await expect(verifyAttestationJws(validJws, { ...jwks.keys[0], kid: 'wrong-key' })).rejects.toThrow(/kid does not match/);
  });

  it('requires issuer identity fields', () => {
    expect(() => validateAttestation({ ...fixture, issuer: { id: 'https://authichain.com' } })).toThrow(/issuer.name/);
  });

  it('requires a provider-scoped object id', () => {
    expect(() => validateAttestation({ ...fixture, subject: { ...fixture.subject, object_id: '' } })).toThrow(/object_id/);
  });

  it('rejects malformed evidence digests', () => {
    expect(() => validateAttestation({
      ...fixture,
      evidence: [{ ...fixture.evidence[0], digest: 'sha256:not-a-digest' }],
    })).toThrow(/digest/);
  });

  it('rejects an expiry at or before issuance', () => {
    expect(() => validateAttestation({ ...fixture, expires_at: fixture.issued_at })).toThrow(/expires_at/);
  });
});
