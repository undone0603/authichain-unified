// Offline trust-boundary regression fixture. No network, secrets, wallet, or production side effects.
// This is a contract fixture, not proof that production handlers enforce these rules.
// Run: node --test tests/security/agent-trust-boundaries.offline.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';

function assess({ card, signatureVerified = false, authorized = false, taskSession, requestSession, verification, x402 } = {}) {
  const identity = card && signatureVerified ? 'integrity_verified_only' : 'unverified';
  const taskAccess = authorized === true && typeof taskSession === 'string' &&
    taskSession.length > 0 && taskSession === requestSession ? 'allowed' : 'denied';
  const product = verification?.decision === 'not_found' ? 'not_found_not_counterfeit' : 'no_authenticity_conclusion';
  const settlement = x402?.receiptVerified === true && x402?.receiptBoundToRequest === true
    ? 'receipt_evidence_present' : 'unverified';
  return { identity, taskAccess, product, settlement };
}

test('unsigned AgentCard is not an authenticated identity', () => {
  assert.equal(assess({card: {url:'https://example.invalid/a2a'}}).identity, 'unverified');
});
test('tampered or unverified signature does not authenticate AgentCard', () => {
  assert.equal(assess({card: {signature:'tampered'}, signatureVerified:false}).identity, 'unverified');
});
test('verified signature is integrity evidence only, not task authorization', () => {
  const result = assess({card:{signature:'fixture'},signatureVerified:true,authorized:false,taskSession:'a',requestSession:'a'});
  assert.equal(result.identity,'integrity_verified_only');
  assert.equal(result.taskAccess,'denied');
});
test('anonymous task request is denied', () => {
  assert.equal(assess({taskSession:'a',requestSession:'a'}).taskAccess,'denied');
});
test('cross-session task request is denied even when authorized flag is present', () => {
  assert.equal(assess({authorized:true,taskSession:'a',requestSession:'b'}).taskAccess,'denied');
});
test('missing session and empty session fail closed', () => {
  assert.equal(assess({authorized:true,taskSession:'',requestSession:''}).taskAccess,'denied');
  assert.equal(assess({authorized:true,requestSession:'a'}).taskAccess,'denied');
});
test('same-session task access requires explicit authorization', () => {
  assert.equal(assess({authorized:true,taskSession:'a',requestSession:'a'}).taskAccess,'allowed');
});
test('not_found is not a counterfeit verdict', () => {
  assert.equal(assess({verification:{decision:'not_found',reason:'object_not_found'}}).product,'not_found_not_counterfeit');
});
test('demo anchor is not physical inspection', () => {
  assert.equal(assess({verification:{demonstration:true,physical_binding_not_inspected:true}}).product,'no_authenticity_conclusion');
});
test('x402 price and health do not prove settlement', () => {
  assert.equal(assess({x402:{healthy:true,price:'0.05 USDC'}}).settlement,'unverified');
});
test('unbound or unverified receipts are not settlement evidence', () => {
  assert.equal(assess({x402:{receiptVerified:true}}).settlement,'unverified');
  assert.equal(assess({x402:{receiptBoundToRequest:true}}).settlement,'unverified');
});
test('receipt evidence remains distinct from buyer acceptance or authorization', () => {
  const result=assess({x402:{receiptVerified:true,receiptBoundToRequest:true}});
  assert.equal(result.settlement,'receipt_evidence_present');
  assert.equal(result.taskAccess,'denied');
});
