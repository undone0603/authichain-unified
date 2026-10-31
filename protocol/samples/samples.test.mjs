// SPDX-License-Identifier: Apache-2.0
// SAMPLE-ONLY passport gates for ADM-256 Item 3. These lock the Research PASS
// labels, the sample did:key, and the ship rule that this key never appears in
// production JWKS / issuer docs. // pragma: allowlist secret
import { describe, it, expect } from 'vitest';
import { generateKeyPairSync } from 'node:crypto';
import { mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { didKeyFromJwk } from '../verifier.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const ROOT = join(HERE, '..', '..');

export const SAMPLE_TITLE =
  'SAMPLE ONLY — fictional AuthiChain passport (not a live product)'; // pragma: allowlist secret
export const SAMPLE_ISSUER_DID =
  'did:key:z6MknvZLpAxf4Z1rbs2tNiv3pwwygwBEk6ivASSi6FpYt8Mp';
export const SAMPLE_ISSUER_LINE =
  `Issuer did:key (SAMPLE — not the AuthiChain production issuer): ${SAMPLE_ISSUER_DID}`; // pragma: allowlist secret
export const SAMPLE_BANNER =
  'FICTIONAL SAMPLE — for dogfood/demo labels only. Not a production attestation. Do not treat as a real product seal.'; // pragma: allowlist secret
export const SAMPLE_FOOTER =
  'Generated SAMPLE-ONLY Ed25519 · private key never published · ADM-256 Item 3';
export const SHIP_RULE =
  'This did:key must never appear in production JWKS/issuer docs.'; // pragma: allowlist secret

const PRODUCTION_SURFACES = [ // pragma: allowlist secret
  'docs/launch/PRODUCTION_ISSUER.md', // pragma: allowlist secret
  'worker-app/jwks.ts',
  'worker-app/jwks.test.ts',
  'workers/authichain-com/src/mcp-routes.ts', // pragma: allowlist secret
  'workers/authichain-com/src/mcp-routes.test.ts', // pragma: allowlist secret
  'workers/authichain-com/content/docs/public/examples.md', // pragma: allowlist secret
  'workers/authichain-com/content/docs/public/verification.md', // pragma: allowlist secret
  'fixtures/attestation-v0.1-jwks.json',
  'protocol/examples/attestation-fixture.jwks.json',
  'protocol/examples/record.json',
];

const SECRET_MARKERS = [
  'BEGIN PRIVATE KEY',
  'BEGIN RSA PRIVATE KEY',
  'BEGIN OPENSSH PRIVATE KEY',
  'AUTHICHAIN_ATTESTATION_PRIVATE_KEY', // pragma: allowlist secret
];

function read(rel) {
  return readFileSync(join(HERE, rel), 'utf8');
}

function json(rel) {
  return JSON.parse(read(rel));
}

function walkFiles(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    const abs = join(dir, name);
    const st = statSync(abs);
    if (st.isDirectory()) walkFiles(abs, acc);
    else acc.push(abs);
  }
  return acc;
}

describe('ADM-256 Item 3 SAMPLE-ONLY labels', () => {
  it('README carries Title/Issuer/Banner/Footer and the ship rule verbatim', () => {
    const md = read('README.md');
    expect(md).toContain(`Title: ${SAMPLE_TITLE}`);
    expect(md).toContain(`Issuer: ${SAMPLE_ISSUER_LINE}`);
    expect(md).toContain(`Banner: ${SAMPLE_BANNER}`);
    expect(md).toContain(`Footer: ${SAMPLE_FOOTER}`);
    expect(md).toContain(SHIP_RULE);
    expect(md).toContain('SAMPLE_PASSPORT_SIGNING_KEY');
    expect(md).toContain('SAMPLE_SIGNING_KEY_PEM_FILE');
  });

  it('ISSUER.json is SAMPLE-ONLY public metadata for the Research PASS did:key', () => {
    const issuer = json('ISSUER.json');
    expect(issuer.sampleOnly).toBe(true);
    expect(issuer.status).toBe('SAMPLE-ONLY');
    expect(issuer.liveIssuerForbidden).toBe(true); // pragma: allowlist secret
    expect(issuer.issuer).toBe(SAMPLE_ISSUER_DID);
    expect(issuer.title).toBe(SAMPLE_TITLE);
    expect(issuer.issuerLabel).toBe(SAMPLE_ISSUER_LINE);
    expect(issuer.banner).toBe(SAMPLE_BANNER);
    expect(issuer.footer).toBe(SAMPLE_FOOTER);
    expect(issuer.shipRule).toBe(SHIP_RULE);
    expect(issuer.privateKeyPublished).toBe(false);
    expect(issuer.d).toBeUndefined();
    expect(issuer.privateKey).toBeUndefined();
    expect(issuer.publicJwk.d).toBeUndefined();
    expect(didKeyFromJwk(issuer.publicJwk)).toBe(SAMPLE_ISSUER_DID);
  });

  it('passport.sample.json is a labelled fictional unsigned record', () => {
    const sample = json('passport.sample.json');
    expect(sample.sampleOnly).toBe(true);
    expect(sample.signatureStatus).toBe('unsigned');
    expect(sample.title).toBe(SAMPLE_TITLE);
    expect(sample.issuerLabel).toBe(SAMPLE_ISSUER_LINE);
    expect(sample.banner).toBe(SAMPLE_BANNER);
    expect(sample.footer).toBe(SAMPLE_FOOTER);
    expect(sample.record.issuer).toBe(SAMPLE_ISSUER_DID);
    expect(sample.record.credentialSubject.id).toMatch(/^urn:authichain:sample:/); // pragma: allowlist secret
    expect(sample.record.credentialSubject.title).toBe(SAMPLE_TITLE);
    expect(sample.record.credentialSubject.banner).toBe(SAMPLE_BANNER);
    expect(sample.record.credentialSubject.footer).toBe(SAMPLE_FOOTER);
    expect(sample.record.proof.proofValue).toBeUndefined();
    expect(sample.record.proof.verificationMethod).toContain(SAMPLE_ISSUER_DID);
  });
});

describe('SAMPLE-ONLY key hygiene', () => {
  it('does not publish a private key under protocol/samples/', () => {
    const artifacts = walkFiles(HERE).filter(
      (abs) => abs.endsWith('.json') || abs.endsWith('.md')
    );
    for (const abs of artifacts) {
      const text = readFileSync(abs, 'utf8');
      for (const marker of SECRET_MARKERS) {
        expect(text, `${relative(HERE, abs)} must not contain ${marker}`).not.toContain(marker);
      }
      if (abs.endsWith('.json')) {
        const body = JSON.parse(text);
        expect(body.d).toBeUndefined();
        expect(body.publicJwk?.d).toBeUndefined();
        expect(body.record?.proof?.d).toBeUndefined();
      }
    }
  });

  it('sample did:key is absent from production JWKS / issuer surfaces', () => { // pragma: allowlist secret
    for (const rel of PRODUCTION_SURFACES) { // pragma: allowlist secret
      const text = readFileSync(join(ROOT, rel), 'utf8');
      expect(text, `${rel} must not list the SAMPLE did:key`).not.toContain(SAMPLE_ISSUER_DID);
    }
  });

  it('sign script refuses to invent a key when env is unset', () => {
    const env = { ...process.env };
    delete env.SAMPLE_PASSPORT_SIGNING_KEY;
    delete env.SAMPLE_SIGNING_KEY_PEM_FILE;
    const result = spawnSync(process.execPath, [join(HERE, 'sign-sample-passport.mjs')], {
      env,
      encoding: 'utf8',
    });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/will not invent a key/);
    expect(result.stdout + result.stderr).not.toMatch(/BEGIN PRIVATE KEY/);
  });

  it('sign script rejects a non-SAMPLE Ed25519 key without printing it', () => {
    const dir = mkdtempSync(join(tmpdir(), 'adm256-sample-'));
    const pemPath = join(dir, 'stranger.pem');
    const { privateKey } = generateKeyPairSync('ed25519');
    writeFileSync(pemPath, privateKey.export({ format: 'pem', type: 'pkcs8' }));
    const env = { ...process.env, SAMPLE_SIGNING_KEY_PEM_FILE: pemPath };
    delete env.SAMPLE_PASSPORT_SIGNING_KEY;
    const result = spawnSync(process.execPath, [join(HERE, 'sign-sample-passport.mjs')], {
      env,
      encoding: 'utf8',
    });
    rmSync(dir, { recursive: true, force: true });
    expect(result.status).not.toBe(0);
    expect(result.stderr).toMatch(/not the SAMPLE issuer/);
    expect(result.stdout + result.stderr).not.toMatch(/BEGIN PRIVATE KEY/);
    expect(result.stdout + result.stderr).not.toMatch(/-----/);
  });
});
