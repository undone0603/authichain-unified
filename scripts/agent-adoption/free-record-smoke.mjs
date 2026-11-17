#!/usr/bin/env node
/**
 * Free, credential-free AuthiChain MCP sample for independently reproducing
 * a published DEMONSTRATION record response. Never attempts a payment.
 * This is an integration/transport smoke, not physical product authentication.
 */
import { pathToFileURL } from 'node:url';

export const ENDPOINT = 'https://authichain.com/mcp/free';
export const DEMO_ID = 'polygon-anchor-1';
export const FREE_TOOLS = ['verify_record', 'dpp_readiness_check', 'scan_living_qr'];
const PROTOCOL_VERSION = '2025-06-18';

function check(value, description) {
  if (!value) throw new Error(description);
}

async function jsonResponse(fetchImpl, init, operation) {
  // No bearer token, wallet signature, redirects, provider fallback, or URL override.
  const response = await fetchImpl(ENDPOINT, {
    ...init,
    redirect: 'manual',
    signal: AbortSignal.timeout(12000),
  });
  check(response.status === 200, operation + ': HTTP ' + response.status + ' (no retry or payment)');
  check((response.headers.get('content-type') || '').includes('application/json'),
    operation + ': expected application/json');
  const value = await response.json();
  check(value && typeof value === 'object' && !Array.isArray(value), operation + ': invalid JSON object');
  return value;
}

function sameTools(names) {
  return Array.isArray(names) && names.length === FREE_TOOLS.length &&
    new Set(names).size === FREE_TOOLS.length && FREE_TOOLS.every(name => names.includes(name));
}

async function rpc(fetchImpl, id, method, params) {
  check(['initialize', 'tools/list', 'tools/call'].includes(method), 'Method not allowlisted');
  if (method === 'tools/call') {
    check(params?.name === 'verify_record' && params.arguments?.id === DEMO_ID &&
      Object.keys(params.arguments).length === 1, 'Only free published record is allowed');
  }
  const result = await jsonResponse(fetchImpl, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'MCP-Protocol-Version': PROTOCOL_VERSION,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id, method, params }),
  }, method);
  check(result.jsonrpc === '2.0' && result.id === id && !result.error && result.result,
    method + ': invalid/error JSON-RPC envelope');
  return result.result;
}

export async function run({ fetchImpl = fetch, log = console.log } = {}) {
  const discovery = await jsonResponse(fetchImpl, { method: 'GET' }, 'GET discovery');
  check(discovery.endpoint === ENDPOINT && discovery.serverInfo?.name === 'authichain-free',
    'Unexpected free MCP endpoint or server identity');
  check(sameTools(discovery.tools), 'Free discovery tool list does not match allowlist');
  const init = await rpc(fetchImpl, 1, 'initialize', {
    protocolVersion: PROTOCOL_VERSION,
    capabilities: {},
    clientInfo: { name: 'authichain-public-free-record-example', version: '1.0.0' },
  });
  check(init.protocolVersion === PROTOCOL_VERSION &&
    init.serverInfo?.name === discovery.serverInfo.name &&
    init.serverInfo?.version === discovery.serverInfo.version,
  'GET/POST server identity or protocol mismatch');
  const list = await rpc(fetchImpl, 2, 'tools/list', {});
  check(sameTools(list.tools?.map(tool => tool.name)), 'POST tool list does not match free allowlist');
  const verifier = list.tools.find(tool => tool.name === 'verify_record');
  check(verifier.annotations?.readOnlyHint === true &&
    verifier.annotations?.destructiveHint === false, 'Free verification safety hints missing');
  const output = await rpc(fetchImpl, 3, 'tools/call', {
    name: 'verify_record', arguments: { id: DEMO_ID },
  });
  check(output.isError !== true, 'Free record tool reported an error');
  const content = output.content?.find(entry => entry.type === 'text')?.text;
  check(typeof content === 'string', 'No structured demonstration result');
  const record = JSON.parse(content);
  check(record.source === 'published_example' && record.demonstration === true,
    'Result was not identified as the published demonstration record');
  check(['verified', 'unverified', 'invalid', 'indeterminate'].includes(record.verdict),
    'Record verdict missing or outside supported result set');
  check(typeof record.limits === 'string' && record.limits.includes('does not inspect'),
    'Result did not disclose the physical-inspection limitation');
  const result = {
    transport: 'MCP JSON-RPC POST (read-only)',
    version: init.serverInfo.version,
    checkedAtUtc: new Date().toISOString(),
    demoOnly: true,
    verdict: record.verdict,
    signatureOrAnchorOutcome: record.protocolVerdict,
    onChain: record.anchorOnChain === true,
    paidCalls: 0,
    userDataTransmitted: false,
    limitation: 'Not independent evidence of physical product authenticity',
  };
  log(JSON.stringify(result, null, 2));
  return result;
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  run().catch(error => {
    console.error('FREE_RECORD_SMOKE_FAIL:', error.message);
    process.exitCode = 1;
  });
}
