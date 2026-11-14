import { test } from 'node:test';
import assert from 'node:assert/strict';

// Offline fixture only. No network, payment credentials, or production code changes.
const OLD = '2025-06-18', NEW = '2026-07-28';
function request(version, method) {
  if (!['initialize','server/discover','tools/list','tools/call'].includes(method)) throw Error('method denied');
  if (version === NEW && method === 'initialize') throw Error('modern handshake forbidden');
  if (version === OLD && method === 'server/discover') throw Error('legacy discovery unsupported');
  const params = method === 'tools/call'
    ? { name: 'verify_record', arguments: { id: 'polygon-anchor-1' } } : {};
  const headers = { 'MCP-Protocol-Version': version, accept: 'application/json, text/event-stream' };
  if (version === NEW) {
    params._meta = {
      'io.modelcontextprotocol/protocolVersion': NEW,
      'io.modelcontextprotocol/clientInfo': { name: 'offline-authichain-test', version: '1.0' },
      'io.modelcontextprotocol/clientCapabilities': {},
    };
    headers['Mcp-Method'] = method;
    if (method === 'tools/call') headers['Mcp-Name'] = params.name;
  }
  return { headers, body: { jsonrpc: '2.0', id: 7, method, params } };
}
function validate(req, version) {
  assert.equal(req.headers['MCP-Protocol-Version'], version);
  if (version === NEW) {
    assert.equal(req.body.params._meta['io.modelcontextprotocol/protocolVersion'], version);
    assert.equal(req.headers['Mcp-Method'], req.body.method);
    assert.equal(req.headers['Mcp-Session-Id'], undefined);
  }
}
function parse({ status, type, body }, id) {
  if (status === 402) throw Error('HTTP 402: no payment fallback');
  if (status !== 200) throw Error('HTTP ' + status);
  let value;
  if (type === 'application/json') value = JSON.parse(body);
  else if (type === 'text/event-stream') {
    const data = body.split(/\r?\n\r?\n/).map(event =>
      event.split(/\r?\n/).filter(line => line.startsWith('data:'))
        .map(line => line.slice(5).trimStart()).join('\n')).filter(Boolean);
    if (!data.length) throw Error('SSE missing data');
    value = JSON.parse(data.at(-1));
  } else throw Error('unsupported content type');
  if (value.jsonrpc !== '2.0' || value.id !== id || value.error || !value.result)
    throw Error('invalid JSON-RPC envelope');
  if (value.result.isError) throw Error('tool error');
  return value.result;
}
const success = { jsonrpc: '2.0', id: 7, result: { isError: false, content: [] } };
test('legacy initialize and modern server/discover are separate', () => {
  validate(request(OLD, 'initialize'), OLD);
  validate(request(NEW, 'server/discover'), NEW);
  assert.throws(() => request(NEW, 'initialize'), /forbidden/);
});
test('modern tool call is demo-only and session-free', () => {
  const r = request(NEW, 'tools/call');
  validate(r, NEW);
  assert.equal(r.headers['Mcp-Name'], 'verify_record');
  assert.deepEqual(r.body.params.arguments, { id: 'polygon-anchor-1' });
});
test('modern version-header mismatch rejects', () => {
  const r = request(NEW, 'tools/list');
  r.headers['MCP-Protocol-Version'] = OLD;
  assert.throws(() => validate(r, NEW));
});
test('matching JSON and SSE response IDs are accepted', () => {
  assert.deepEqual(parse({ status: 200, type: 'application/json', body: JSON.stringify(success) }, 7), success.result);
  assert.deepEqual(parse({ status: 200, type: 'text/event-stream', body: ': ping\n\ndata: ' + JSON.stringify(success) + '\n\n' }, 7), success.result);
});
test('malformed SSE and wrong response IDs reject', () => {
  assert.throws(() => parse({ status: 200, type: 'text/event-stream', body: ': ping\n\n' }, 7), /missing data/);
  assert.throws(() => parse({ status: 200, type: 'application/json', body: JSON.stringify(success) }, 8), /envelope/);
});
test('HTTP 402 and tool-level errors fail closed', () => {
  assert.throws(() => parse({ status: 402, type: 'application/json', body: '{}' }, 7), /no payment fallback/);
  assert.throws(() => parse({ status: 200, type: 'application/json',
    body: JSON.stringify({ ...success, result: { isError: true } }) }, 7), /tool error/);
});
