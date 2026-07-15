import { existsSync } from 'node:fs';
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
