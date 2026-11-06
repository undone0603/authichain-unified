import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const source = rel => readFileSync(new URL(rel, import.meta.url), 'utf8');

test('QRON marketing never presents the historically HTTP 400 stored id as working', () => {
  const qron = source('../../workers/qron-space/src/index.ts');
  assert.doesNotMatch(qron, /qron%3Aurl%3A71cead6b/i);
  assert.match(qron, /An anonymous generate is not a stored signed scan/);
  assert.match(qron, /not a physical inspection/i);
});

test('canonical resolver still returns indeterminate, never counterfeit, for missing presentation', () => {
  const resolver = source('../../src/lib/qron-resolve.ts');
  assert.match(resolver, /indeterminate\("presentation_not_found"\)/);
  assert.match(resolver, /qron_store_unavailable/);
});

test('GovChain live listing retains expiry filter and minimum-fit threshold', () => {
  const gov = source('../../workers/govchain-us/src/supabase.ts');
  assert.match(gov, /fit_score=gte\.\$\{minFit\}/);
  assert.match(gov, /deadline\.gte\.\$\{today\}/);
  assert.match(gov, /OPPORTUNITIES_VIEW = "gov_opportunities_public"/);
});
