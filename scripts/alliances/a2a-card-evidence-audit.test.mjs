import { test } from 'node:test';
import assert from 'node:assert/strict';
import { auditAgentCard } from './a2a-card-evidence-audit.mjs';
const card = () => ({
  name: 'AuthiChain', version: '1.4.0',
  supportedInterfaces: [{ protocolBinding: 'JSONRPC', protocolVersion: '1.0', url: 'https://authichain.com/api/a2a' }],
  skills: [{ id: 'verify', name: 'Verify' }],
  capabilities: {},
});
test('well-shaped card is review-required, never task acceptance', () => {
  const a = auditAgentCard(card());
  assert.equal(a.status, 'DESCRIPTOR_REVIEW_REQUIRED');
  assert.equal(a.a2aTaskAccepted, false);
  assert.equal(a.externalIntegrationCounted, false);
});
test('null card rejected', () => assert.ok(auditAgentCard(null).failures.includes('NOT_JSON_OBJECT')));
test('empty skills rejected', () => { const c=card(); c.skills=[]; assert.ok(auditAgentCard(c).failures.includes('SKILLS_INVALID')); });
test('version mismatch rejected', () => { const c=card(); c.supportedInterfaces[0].protocolVersion='0.3.0'; assert.ok(auditAgentCard(c).failures.includes('NO_EXPECTED_JSONRPC_V1_INTERFACE')); });
test('binding mismatch rejected', () => { const c=card(); c.supportedInterfaces[0].protocolBinding='GRPC'; assert.ok(auditAgentCard(c).failures.includes('NO_EXPECTED_JSONRPC_V1_INTERFACE')); });
test('wrong host rejected', () => { const c=card(); c.supportedInterfaces[0].url='https://example.com/api/a2a'; assert.ok(auditAgentCard(c).failures.includes('UNEXPECTED_TARGET')); });
test('HTTP downgrade rejected', () => { const c=card(); c.supportedInterfaces[0].url='http://authichain.com/api/a2a'; assert.ok(auditAgentCard(c).failures.includes('UNEXPECTED_TARGET')); });
test('URL credentials rejected', () => { const c=card(); c.supportedInterfaces[0].url='https://user:pass@authichain.com/api/a2a'; assert.ok(auditAgentCard(c).failures.includes('UNEXPECTED_TARGET')); });
test('unexpected query rejected', () => { const c=card(); c.supportedInterfaces[0].url='https://authichain.com/api/a2a?token=x'; assert.ok(auditAgentCard(c).failures.includes('UNEXPECTED_TARGET')); });
test('no interface rejected', () => { const c=card(); c.supportedInterfaces=[]; assert.ok(auditAgentCard(c).failures.includes('NO_INTERFACE')); });
test('missing name rejected', () => { const c=card(); c.name=''; assert.ok(auditAgentCard(c).failures.includes('NAME_MISSING')); });
test('invalid capabilities rejected', () => { const c=card(); c.capabilities=[]; assert.ok(auditAgentCard(c).failures.includes('CAPABILITIES_INVALID')); });
