import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { assess } from '../alliances/independent-evidence-preflight.mjs';

const hash = createHash('sha256').update('published-redacted-fixture').digest('hex');
const base = Object.freeze({
  kind: 'mcp', evidenceUrl: 'https://example.org/evidence',
  observedAt: '2026-11-13T07:00:00Z', artifactSha256: hash,
  sourceSha: '76a36fe68d5d8bbadb0a7bea9ac1166819c7f51f',
  operator: 'example-third-party-not-a-real-submission', consentToPublish: true,
  traceUrl: 'https://example.org/trace', runtime: 'node 22', httpStatus: 200,
});
test('complete metadata is review_required, never verified', () => {
  assert.deepEqual(assess(base), { state: 'review_required', reasons: [], artifactFingerprint: hash });
});
for (const [name, patch, reason] of [
  ['no consent', { consentToPublish: false }, 'explicit_publication_consent_required'],
  ['moving source ref', { sourceSha: 'main' }, 'merged_source_sha_required'],
  ['missing hash', { artifactSha256: '' }, 'artifact_sha256_required'],
  ['insecure trace', { traceUrl: 'http://example.org/trace' }, 'https_trace_url_required'],
  ['missing attribution', { operator: '' }, 'operator_attribution_required'],
  ['bad timestamp', { observedAt: 'not-a-date' }, 'utc_or_offset_timestamp_required'],
  ['no runtime', { runtime: '' }, 'runtime_required'],
]) test(name, () => {
  const result = assess({ ...base, ...patch });
  assert.equal(result.state, 'incomplete');
  assert.ok(result.reasons.includes(reason));
});
test('x402 without settlement and fulfillment is incomplete', () => {
  const result = assess({ ...base, kind: 'x402' });
  assert.equal(result.state, 'incomplete');
  assert.ok(result.reasons.includes('base_transaction_hash_required'));
  assert.ok(result.reasons.includes('fulfillment_evidence_url_required'));
});
test('invalid object is rejected', () => assert.equal(assess(null).state, 'rejected'));
