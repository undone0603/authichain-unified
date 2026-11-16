import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { validateSubmission } from './validate-independent-receipt.mjs';

const result = () => Buffer.from(JSON.stringify({
  transport: 'MCP JSON-RPC POST (read-only)',
  version: '1.4.0',
  checkedAtUtc: '2026-11-14T20:00:00.000Z',
  demoOnly: true,
  verdict: 'unverified',
  signatureOrAnchorOutcome: 'verified',
  onChain: false,
  paidCalls: 0,
  userDataTransmitted: false,
  limitation: 'Not independent evidence of physical product authenticity',
}, null, 2));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
function sample(bytes = result()) {
  return {
    schema: 'authichain-free-mcp-reproduction/v1', protocol: 'mcp',
    operator: { github: 'external-fixture-user', unaffiliated: true, consentToPublish: true },
    client: { repoUrl: 'https://github.com/undone0603/authichain-unified', commitSha: 'a'.repeat(40), runtime: 'Node.js 22' },
    execution: {
      command: 'node scripts/agent-adoption/free-record-smoke.mjs',
      endpoint: 'https://authichain.com/mcp/free', tool: 'verify_record',
      demoId: 'polygon-anchor-1', resultSha256: digest(bytes),
    },
  };
}
const now = Date.parse('2026-11-14T22:00:00.000Z');
const gate = (receipt, bytes = result()) => validateSubmission(receipt, bytes, { now });

test('valid mock receipt is review-required, NEVER counted as independent adoption', () => {
  const v = gate(sample());
  assert.equal(v.status, 'REVIEW_REQUIRED');
  assert.equal(v.independentAdoptionCounted, false);
  assert.equal(v.problems.length, 0);
});
test('owner-operated evidence cannot claim an independent operator', () => {
  const v = sample(); v.operator.github = 'undone0603';
  assert.ok(gate(v).problems.includes('EXTERNAL_OPERATOR_UNCONFIRMED'));
});
test('explicit publication consent and unaffiliated statement are required', () => {
  const v = sample(); v.operator.consentToPublish = false;
  assert.ok(gate(v).problems.includes('NO_INDEPENDENT_CONSENT'));
});
test('rejects digest mismatch instead of treating a hash string as authentication', () => {
  const v = sample(); v.execution.resultSha256 = 'f'.repeat(64);
  assert.ok(gate(v).problems.includes('RESULT_DIGEST_MISMATCH'));
});
test('rejects a paid call in the result', () => {
  const bytes = Buffer.from(result().toString().replace('"paidCalls": 0', '"paidCalls": 1'));
  assert.ok(gate(sample(bytes), bytes).problems.includes('NOT_FREE_READ_ONLY'));
});
test('rejects a different destination or paid tool', () => {
  const v = sample(); v.execution.endpoint = 'https://authichain.com/mcp'; v.execution.tool = 'verify';
  assert.ok(gate(v).problems.includes('OUTSIDE_FREE_DEMO_SCOPE'));
});
test('rejects unsupported claimed verdict and does not infer authenticity', () => {
  const bytes = Buffer.from(result().toString().replace('"unverified"', '"certified_authentic"'));
  assert.ok(gate(sample(bytes), bytes).problems.includes('VERDICT_OR_LIMITATION_INVALID'));
});
test('rejects old observations; cannot replay stale tests as fresh adoption', () => {
  const bytes = Buffer.from(result().toString().replace('2026-11-14T20:00:00.000Z', '2026-01-01T00:00:00.000Z'));
  assert.ok(gate(sample(bytes), bytes).problems.includes('OBSERVATION_TIME_INVALID'));
});
test('rejects extra result fields that may leak private metadata', () => {
  const bytes = Buffer.from(result().toString().replace('"paidCalls": 0,', '"customerEmail": "private@example.com", "paidCalls": 0,'));
  assert.ok(gate(sample(bytes), bytes).problems.includes('RESULT_SHAPE_INVALID'));
});
test('rejects embedded bearer tokens even with a matching SHA-256', () => {
  const bytes = Buffer.from(result().toString().replace('"version": "1.4.0"', '"version": "Authorization: Bearer secret_token"'));
  assert.ok(gate(sample(bytes), bytes).problems.includes('POTENTIAL_SECRET_IN_RESULT'));
});
test('external peer interest alone is not a completed MCP receipt', () => {
  const v = sample(Buffer.from('{}'));
  v.protocol = 'x402';
  const gateResult = gate(v, Buffer.from('{}'));
  assert.ok(gateResult.problems.includes('WRONG_SCHEMA_OR_PROTOCOL'));
  assert.ok(gateResult.problems.includes('NOT_FREE_READ_ONLY'));
  assert.equal(gateResult.independentAdoptionCounted, false);
});
