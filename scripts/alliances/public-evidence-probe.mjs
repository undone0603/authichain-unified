// Public, read-only observation probe. No wallet, POST, task creation, cookies or secrets.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const TARGETS = Object.freeze([
  Object.freeze({ id: 'demo_verification', url: 'https://authichain.com/api/verify?id=polygon-anchor-1' }),
  Object.freeze({ id: 'unknown_verification', url: 'https://authichain.com/api/verify?id=authichain-peer-fixture-missing-20261102' }),
  Object.freeze({ id: 'agentcard_discovery', url: 'https://authichain.com/.well-known/agent-card.json' }),
  Object.freeze({ id: 'mcp_registry_metadata', url: 'https://registry.modelcontextprotocol.io/v0.1/servers/com.authichain%2Fauthichain/versions/latest' }),
]);
const MAX_BYTES = 131072;

export function classify(id, record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) return { state: 'coverage_unknown', reason: 'invalid_json_shape' };
  if (id === 'demo_verification') return {
    state: 'observed', kind: record.demonstration === true ? 'demonstration' : 'not_confirmed_demonstration',
    reported_decision: typeof record.decision === 'string' ? record.decision : 'not_reported',
    independently_verified_signature: false, independently_verified_chain: false,
    physical_product_authenticity: 'not_established',
  };
  if (id === 'unknown_verification') return {
    state: 'observed', reported_decision: typeof record.decision === 'string' ? record.decision : 'not_reported',
    counterfeit_verdict: 'not_established', absence_is_counterfeit: false,
  };
  if (id === 'agentcard_discovery') return {
    state: 'observed', advertised_url: typeof record.url === 'string' ? record.url : null,
    advertised_version: typeof record.protocolVersion === 'string' ? record.protocolVersion : null,
    card_signature_validated: false, caller_authorized: false, a2a_tck_passed: false,
  };
  if (id === 'mcp_registry_metadata') return {
    state: 'observed', registry_response_received: true,
    tools_list_tested: false, tool_invocation_tested: false, mcp_conformance_verified: false,
  };
  return { state: 'coverage_unknown', reason: 'unrecognized_target' };
}

async function boundedJson(response) {
  if (!response?.ok) throw new Error('http_status_' + (Number.isInteger(response?.status) ? response.status : 'unknown'));
  if (!String(response.headers?.get('content-type') ?? '').toLowerCase().includes('json')) throw new Error('non_json_response');
  const len = Number(response.headers?.get('content-length'));
  if (Number.isFinite(len) && len > MAX_BYTES) throw new Error('oversize_response');
  const reader = response.body?.getReader?.();
  if (!reader) throw new Error('unreadable_body');
  let total = 0;
  const chunks = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_BYTES) throw new Error('oversize_response');
      chunks.push(value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  try { return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); }
  catch { throw new Error('invalid_json'); }
}

export async function probe(fetchImpl = globalThis.fetch, sourceRef = 'unpinned') {
  const observations = [];
  for (const target of TARGETS) {
    try {
      const response = await fetchImpl(target.url, {
        method: 'GET', credentials: 'omit', redirect: 'error',
        signal: AbortSignal.timeout(6000), headers: { accept: 'application/json' },
      });
      observations.push({ target: target.id, ...classify(target.id, await boundedJson(response)) });
    } catch (error) {
      const allowed = ['non_json_response', 'unreadable_body', 'oversize_response', 'invalid_json'];
      const msg = String(error?.message || '');
      observations.push({ target: target.id, state: 'coverage_unknown', reason: allowed.includes(msg) || /^http_status_\d+$/.test(msg) ? msg : 'transport_or_parse_failure' });
    }
  }
  return {
    schema: 'authichain.public-peer-probe.v1', source_ref: sourceRef,
    timestamp: new Date().toISOString(), execution: 'read_only_get',
    independent_review: 'not_established', a2a_tck: 'not_executed', paid_settlement: 'not_tested',
    observations,
  };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  if (process.argv.includes('--help')) {
    console.log('Usage: node scripts/alliances/public-evidence-probe.mjs --live [--ref=<exact-git-sha>]');
  } else if (!process.argv.includes('--live') || process.argv.some(x => x.startsWith('--') && x !== '--live' && !/^--ref=[a-f0-9]{40}$/.test(x))) {
    console.error('Refusing without --live and optional 40-hex --ref. No network request was made.');
    process.exitCode = 2;
  } else {
    const ref = process.argv.find(x => x.startsWith('--ref='))?.slice(6) ?? 'unpinned';
    console.log(JSON.stringify(await probe(globalThis.fetch, ref), null, 2));
  }
}
