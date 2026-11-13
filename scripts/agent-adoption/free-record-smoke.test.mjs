import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ENDPOINT, FREE_TOOLS, run } from './free-record-smoke.mjs';

const tools = FREE_TOOLS.map(name => ({
  name, annotations: { readOnlyHint: true, destructiveHint: false },
}));
const reply = (body, status = 200) => new Response(JSON.stringify(body), {
  status, headers: { 'content-type': 'application/json' },
});

function mock(overrides = {}) {
  const calls = [];
  const fetchImpl = async (url, opts) => {
    calls.push({ url, ...opts });
    assert.equal(url, ENDPOINT);
    if (opts.method === 'GET') return reply({
      endpoint: ENDPOINT,
      serverInfo: { name: 'authichain-free', version: '1.4.0' },
      tools: overrides.discoveryTools ?? FREE_TOOLS,
    });
    const req = JSON.parse(opts.body);
    if (req.method === 'initialize') return reply({ jsonrpc: '2.0', id: req.id, result: {
      protocolVersion: '2025-06-18', serverInfo: { name: 'authichain-free', version: '1.4.0' },
    } });
    if (req.method === 'tools/list') return reply({ jsonrpc: '2.0', id: req.id, result: {
      tools: overrides.listTools ?? tools,
    } });
    if (req.method === 'tools/call') {
      if (overrides.paymentRequired) return reply({ error: 'payment required' }, 402);
      return reply({ jsonrpc: '2.0', id: req.id, result: {
        isError: overrides.toolError === true,
        content: [{ type: 'text', text: JSON.stringify(overrides.record ?? {
          source: 'published_example', demonstration: true, verdict: 'unverified',
          protocolVerdict: 'verified', anchorOnChain: false,
          limits: 'Signature only; does not inspect a physical product.',
        }) }],
      } });
    }
    throw new Error('Unexpected method');
  };
  return { fetchImpl, calls };
}

test('free example completes three JSON-RPC requests and never attempts a paid operation', async () => {
  const m = mock();
  const result = await run({ fetchImpl: m.fetchImpl, log: () => {} });
  assert.equal(result.demoOnly, true);
  assert.equal(result.verdict, 'unverified');
  assert.equal(result.paidCalls, 0);
  assert.deepEqual(m.calls.map(x => x.method), ['GET', 'POST', 'POST', 'POST']);
  assert.deepEqual(m.calls.slice(1).map(x => JSON.parse(x.body).method),
    ['initialize', 'tools/list', 'tools/call']);
  const call = JSON.parse(m.calls[3].body);
  assert.deepEqual(call.params, { name: 'verify_record', arguments: { id: 'polygon-anchor-1' } });
  for (const x of m.calls) {
    assert.equal(x.redirect, 'manual');
    assert.equal(x.headers?.Authorization, undefined);
    assert.equal(x.headers?.['PAYMENT-SIGNATURE'], undefined);
    assert.equal(x.headers?.['X-Payment-Tx'], undefined);
    assert.equal(x.headers?.['X-API-Key'], undefined);
  }
});

test('fails before POST if discovery includes a paid or unknown tool', async () => {
  const m = mock({ discoveryTools: [...FREE_TOOLS, 'verify'] });
  await assert.rejects(run({ fetchImpl: m.fetchImpl, log: () => {} }), /allowlist/);
  assert.equal(m.calls.length, 1);
});

test('fails before tools/call if readOnlyHint is missing', async () => {
  const m = mock({ listTools: tools.map(x => x.name === 'verify_record' ? { name: x.name } : x) });
  await assert.rejects(run({ fetchImpl: m.fetchImpl, log: () => {} }), /safety hints/);
  assert.equal(m.calls.length, 3);
});

test('does not retry, charge, or fall back when tool returns HTTP 402', async () => {
  const m = mock({ paymentRequired: true });
  await assert.rejects(run({ fetchImpl: m.fetchImpl, log: () => {} }), /HTTP 402/);
  assert.equal(m.calls.length, 4);
});

test('does not treat tool isError=true as verified', async () => {
  const m = mock({ toolError: true });
  await assert.rejects(run({ fetchImpl: m.fetchImpl, log: () => {} }), /reported an error/);
});

test('rejects a result that is not marked as a demonstration', async () => {
  const m = mock({ record: {
    source: 'submitted', demonstration: false, verdict: 'verified',
    protocolVerdict: 'verified', anchorOnChain: true,
    limits: 'Signature only; does not inspect a physical product.',
  } });
  await assert.rejects(run({ fetchImpl: m.fetchImpl, log: () => {} }), /demonstration record/);
});

test('accepts a properly reported published-demo verified verdict without claiming physical authenticity', async () => {
  const m = mock({ record: {
    source: 'published_example', demonstration: true, verdict: 'verified',
    protocolVerdict: 'verified', anchorOnChain: true,
    limits: 'The verifier does not inspect a physical product.',
  } });
  const v = await run({ fetchImpl: m.fetchImpl, log: () => {} });
  assert.equal(v.verdict, 'verified');
  assert.match(v.limitation, /Not independent evidence/);
});
