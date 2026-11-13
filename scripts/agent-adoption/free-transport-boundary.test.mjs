/**
 * Offline interoperability boundary fixtures for the public free MCP sample.
 * No network, credentials, wallets, production writes, or paid calls.
 * These are characterization tests, NOT proof of SSE/session support.
 *
 * Run: node --test scripts/agent-adoption/free-transport-boundary.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { run, ENDPOINT, FREE_TOOLS } from './free-record-smoke.mjs';

const serverInfo = { name: 'authichain-free', version: '1.4.0' };
const toolList = FREE_TOOLS.map(name => ({
  name, annotations: { readOnlyHint: true, destructiveHint: false },
}));
const json = (body, extra = {}) => new Response(JSON.stringify(body), {
  status: 200, headers: { 'content-type': 'application/json', ...extra },
});
const result = (id, body) => ({ jsonrpc: '2.0', id, result: body });

function harness({ initializeResponse, listResponse, callResponse } = {}) {
  const requests = [];
  const fetchImpl = async (url, options = {}) => {
    assert.equal(url, ENDPOINT);
    assert.equal(options.redirect, 'manual');
    requests.push(options);
    if (options.method === 'GET') {
      return json({ endpoint: ENDPOINT, serverInfo, tools: FREE_TOOLS });
    }
    assert.equal(options.method, 'POST');
    assert.equal(options.headers.Authorization, undefined);
    assert.equal(options.headers['PAYMENT-SIGNATURE'], undefined);
    assert.equal(options.headers['X-Payment-Tx'], undefined);
    const request = JSON.parse(options.body);
    switch (request.method) {
      case 'initialize':
        return initializeResponse ?? json(result(request.id, {
          protocolVersion: '2025-06-18', serverInfo,
        }));
      case 'tools/list':
        return listResponse ?? json(result(request.id, { tools: toolList }));
      case 'tools/call':
        assert.deepEqual(request.params, {
          name: 'verify_record', arguments: { id: 'polygon-anchor-1' },
        });
        return callResponse ?? json(result(request.id, {
          content: [{ type: 'text', text: JSON.stringify({
            source: 'published_example', demonstration: true,
            verdict: 'unverified', protocolVerdict: 'verified',
            anchorOnChain: false,
            limits: 'Signature only; does not inspect a physical product.',
          }) }],
        }));
      default:
        assert.fail('unexpected request method: ' + request.method);
    }
  };
  return { fetchImpl, requests };
}

test('JSON-only happy path stays free and emits exactly three POSTs', async () => {
  const h = harness();
  const output = await run({ fetchImpl: h.fetchImpl, log() {} });
  assert.equal(output.paidCalls, 0);
  assert.equal(output.demoOnly, true);
  assert.deepEqual(h.requests.map(r => r.method), ['GET', 'POST', 'POST', 'POST']);
});

test('SSE initialize is advertised but rejected; no follow-up requests', async () => {
  const event = ['event: message', 'data: ' + JSON.stringify(result(1, {
    protocolVersion: '2025-06-18', serverInfo,
  }))].join(String.fromCharCode(10)) + String.fromCharCode(10, 10);
  const h = harness({ initializeResponse: new Response(event, {
    status: 200, headers: { 'content-type': 'text/event-stream' },
  }) });
  await assert.rejects(run({ fetchImpl: h.fetchImpl, log() {} }), new RegExp('expected application/json'));
  assert.match(h.requests[1].headers.accept, new RegExp('text/event-stream'));
  assert.equal(h.requests.length, 2);
});

test('negotiated different protocol version fails closed before tools/list', async () => {
  const h = harness({ initializeResponse: json(result(1, {
    protocolVersion: '2026-07-28', serverInfo,
  })) });
  await assert.rejects(run({ fetchImpl: h.fetchImpl, log() {} }), /protocol mismatch/);
  assert.equal(h.requests.length, 2);
});

test('HTTP 402 on free tools/call causes failure with no retry or paid fallback', async () => {
  const h = harness({ callResponse: new Response('payment required', {
    status: 402, headers: { 'content-type': 'text/plain' },
  }) });
  await assert.rejects(run({ fetchImpl: h.fetchImpl, log() {} }), /HTTP 402/);
  assert.equal(h.requests.length, 4);
});
