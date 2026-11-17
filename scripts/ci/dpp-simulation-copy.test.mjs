import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

test('fictional battery passport demo does not claim compliance verification', () => {
  const source = readFileSync('src/app/digital-product-passport/page.tsx', 'utf8');
  assert.match(source, /Simulate a Battery Passport/);
  assert.match(source, /Simulation Complete/);
  assert.doesNotMatch(source, /Compliance Verified/);
});
