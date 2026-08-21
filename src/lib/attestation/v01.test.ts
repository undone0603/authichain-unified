import { describe, expect, it } from 'vitest';
import { verifyAttestationJws, canonicalize } from './v01';
import fixture from '../../../fixtures/attestation-v0.1-valid.json';
import jwks from '../../../fixtures/attestation-v0.1-jwks.json';
import fs from 'node:fs';
import path from 'node:path';

const validJws = fs.readFileSync(path.join(process.cwd(), 'fixtures/attestation-v0.1-valid.jws'), 'utf8').trim();
const tamperedJws = fs.readFileSync(path.join(process.cwd(), 'fixtures/attestation-v0.1-tampered.jws'), 'utf8').trim();

// The fixture is also a published conformance artifact: no production secret is required to verify it.
describe('AuthiChain Attestation Contract v0.1', () => {
  it('verifies the canonical signed fixture', async () => {
    const attestation = await verifyAttestationJws(validJws, jwks.keys[0]);
    expect(canonicalize(attestation as never)).toBe(canonicalize(fixture as never));
    expect(attestation.decision).toBe('verified');
  });

  it('rejects a tampered payload', async () => {
    await expect(verifyAttestationJws(tamperedJws, jwks.keys[0])).rejects.toThrow();
  });
});
