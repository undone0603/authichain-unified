/**
 * Offline A2A JSON-RPC acceptance boundary checks.
 * No network, credentials, paid endpoints, or production state.
 * Run: node --test scripts/agent-adoption/a2a-envelope-boundary.test.mjs
 * This is NOT an A2A conformance certification or independent POST proof.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

export function selectJsonRpcInterface(card) {
  if (!card || typeof card !== 'object' || !Array.isArray(card.supportedInterfaces)) {
    throw new Error('missing supportedInterfaces; no inferred JSON-RPC support');
  }
  const candidate = card.supportedInterfaces.find(i =>
    i && i.protocolBinding === 'JSONRPC' && typeof i.url === 'string' &&
    typeof i.protocolVersion === 'string' && i.protocolVersion === '1.0'
  );
  if (!candidate) throw new Error('no advertised compatible JSONRPC 1.0 interface');
  let url;
  try { url = new URL(candidate.url); } catch { throw new Error('invalid interface URL'); }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash) {
    throw new Error('interface must use credential-free HTTPS URL');
  }
  return url.href;
}

export function classifyJsonRpcResponse(envelope, requestId) {
  if (!envelope || typeof envelope !== 'object' || Array.isArray(envelope) ||
      envelope.jsonrpc !== '2.0' || envelope.id !== requestId) {
    throw new Error('invalid JSON-RPC envelope or response correlation');
  }
  const hasResult = Object.prototype.hasOwnProperty.call(envelope, 'result');
  const hasError = Object.prototype.hasOwnProperty.call(envelope, 'error');
  if (hasResult === hasError) throw new Error('response must contain exactly one result or error');
  if (hasError) {
    if (!envelope.error || typeof envelope.error.code !== 'number' ||
        typeof envelope.error.message !== 'string') throw new Error('invalid JSON-RPC error');
    return { kind: 'error', code: envelope.error.code };
  }
  // A successful JSON-RPC result is NOT proof of a completed A2A task.
  return { kind: 'result', taskCompletionVerified: false };
}

const card = { supportedInterfaces: [{
  protocolBinding: 'JSONRPC', protocolVersion: '1.0',
  url: 'https://authichain.com/api/a2a',
}] };

test('selects only explicitly advertised compatible HTTPS JSONRPC interface', () => {
  assert.equal(selectJsonRpcInterface(card), 'https://authichain.com/api/a2a');
});
test('rejects missing interfaces and unrelated card version', () => {
  assert.throws(() => selectJsonRpcInterface({ version: '1.0', url: card.supportedInterfaces[0].url }), /missing supportedInterfaces/);
});
test('rejects unsupported binding/version rather than downgrading', () => {
  assert.throws(() => selectJsonRpcInterface({ supportedInterfaces: [{ ...card.supportedInterfaces[0], protocolVersion: '0.3' }] }), /no advertised compatible/);
  assert.throws(() => selectJsonRpcInterface({ supportedInterfaces: [{ ...card.supportedInterfaces[0], protocolBinding: 'GRPC' }] }), /no advertised compatible/);
});
test('rejects HTTP, embedded credentials and malformed URLs', () => {
  for (const url of ['http://authichain.com/api/a2a', 'https://user:pass@authichain.com/api/a2a', 'not-a-url']) {
    assert.throws(() => selectJsonRpcInterface({ supportedInterfaces: [{ ...card.supportedInterfaces[0], url }] }));
  }
});
test('accepts correlated result without claiming task completion', () => {
  assert.deepEqual(classifyJsonRpcResponse({ jsonrpc: '2.0', id: 'accept-1', result: { id: 'task-1' } }, 'accept-1'),
    { kind: 'result', taskCompletionVerified: false });
});
test('classifies JSON-RPC error as failure, even with HTTP 200', () => {
  assert.deepEqual(classifyJsonRpcResponse({ jsonrpc: '2.0', id: 4, error: { code: -32601, message: 'Method not found' } }, 4),
    { kind: 'error', code: -32601 });
});
test('rejects mismatched IDs, malformed and ambiguous envelopes', () => {
  for (const response of [
    { jsonrpc: '2.0', id: 2, result: {} },
    { jsonrpc: '1.0', id: 1, result: {} },
    { jsonrpc: '2.0', id: 1, result: {}, error: { code: -1, message: 'x' } },
    { jsonrpc: '2.0', id: 1 },
    { jsonrpc: '2.0', id: 1, error: { message: 'bad' } },
  ]) assert.throws(() => classifyJsonRpcResponse(response, 1));
});
