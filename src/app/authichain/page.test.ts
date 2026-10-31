import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// RES-209: the /authichain page ships in the bundle, so its source must not
// carry the "Ed25519 Signing" capability card or the "Anchor Chain: Polygon" stat.
describe('src/app/authichain/page.tsx (RES-209)', () => {
  const src = readFileSync(join(import.meta.dirname, 'page.tsx'), 'utf8');

  it('has no Ed25519 Signing capability card', () => {
    expect(src).not.toMatch(/Ed25519 Signing/i);
  });

  it('has no Anchor Chain stat', () => {
    expect(src).not.toMatch(/Anchor Chain/i);
    expect(src).not.toMatch(/anchored on Polygon/i);
  });
});
