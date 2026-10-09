import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('app router root', () => {
  it('has no root-level app/ directory shadowing src/app/', () => {
    const root = join(import.meta.dirname, '..', '..');
    const rootApp = existsSync(join(root, 'app'));
    const srcApp = existsSync(join(root, 'src', 'app'));
    expect(srcApp).toBe(true);
    expect(rootApp).toBe(false);
  });
});

describe('authichain enterprise page copy (RES-177)', () => {
  it('does not claim a certificate contract live on Polygon', () => {
    const src = readFileSync(
      join(import.meta.dirname, 'authichain', 'page.tsx'),
      'utf8',
    );
    expect(src).not.toMatch(/(live|deployed) on Polygon|0x4da4/i);
  });

  it('does not claim per-asset Ed25519 signing or W3C VC conformance (RES-179)', () => {
    const src = readFileSync(
      join(import.meta.dirname, 'authichain', 'page.tsx'),
      'utf8',
    );
    expect(src).not.toMatch(/W3C Verifiable Credentials/i);
    expect(src).not.toMatch(/>\s*Signing\s*</);
    expect(src).not.toMatch(/Ed25519\s*<span/);
  });
});
