// Public, read-only observation probe. No wallet, POST, task creation, cookies or secrets.
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

export const TARGETS = Object.freeze([
  Object.freeze({ id: 'demo_verification', url: 'https://authichain.com/api/verify?id=polygon-anchor-1' }),
  Object.freeze({ id: 'unknown_verification', url: 'https://authichain.com/api/verify?id=authichain-peer-fixture-missing-20261102' }),
  Object.freeze({ id: 'agentcard_discovery', url: 'https://authichain.com/.well-known/agent-card.json' }),
  Object.freeze({ id: 'mcp_registry_metadata', url: 'https://registry.modelcontextprotocol.io/v0.1/servers/com.authichain%2Fauthichain/versions/latest' }),
  Object.freeze({ id: 'mcp_discovery', url: 'https://authichain.com/mcp' }),
]);
const MAX_BYTES = 131072;

const nonemptyString = x => typeof x === 'string' && x.trim().length > 0;

/** Discovery evidence is observed only when the expected target's shape is present. */
export function classify(id, record) {
  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    return { state: 'coverage_unknown', reason: 'invalid_json_shape' };
  }
  if (id === 'demo_verification') {
    if (!nonemptyString(record.decision) || typeof record.demonstration !== 'boolean') {
      return { state: 'coverage_unknown', reason: 'missing_demo_evidence_fields' };
    }
    return {
      state: 'observed', kind: record.demonstration === true ? 'demonstration' : 'not_confirmed_demonstration',
      reported_decision: record.decision,
      independently_verified_signature: false, independently_verified_chain: false,
      physical_product_authenticity: 'not_established',
    };
  }
  if (id === 'unknown_verification') {
    if (!nonemptyString(record.decision)) {
      return { state: 'coverage_unknown', reason: 'missing_record_decision' };
    }
    return {
      state: 'observed', reported_decision: record.decision,
      expected_not_found: record.decision === 'not_found',
      counterfeit_verdict: 'not_established', absence_is_counterfeit: false,
    };
  }
  if (id === 'agentcard_discovery') {
    // A2A 1.0 protocolVersion belongs on supportedInterfaces, NOT at card root.
    const iface = Array.isArray(record.supportedInterfaces) && record.supportedInterfaces.find(x =>
      x && x.protocolBinding === 'JSONRPC' && nonemptyString(x.protocolVersion) &&
      typeof x.url === 'string' && x.url.startsWith('https://'));
    if (!nonemptyString(record.name) || !nonemptyString(record.version) || !iface) {
      return { state: 'coverage_unknown', reason: 'missing_a2a_card_interface' };
    }
    return {
      state: 'observed', card_name: record.name, application_version: record.version,
      advertised_url: iface.url, advertised_version: iface.protocolVersion,
      card_signature_validated: false, caller_authorized: false, a2a_tck_passed: false,
    };
  }
  if (id === 'mcp_registry_metadata') {
    const server = record.server;
    if (server?.name !== 'com.authichain/authichain' || !nonemptyString(server.version)) {
      return { state: 'coverage_unknown', reason: 'mcp_registry_identity_unconfirmed' };
    }
    const meta = record._meta?.['io.modelcontextprotocol.registry/official'];
    return {
      state: 'observed', registry_response_received: true,
      registry_name: server.name, registry_version: server.version,
      registry_status: nonemptyString(meta?.status) ? meta.status : 'not_reported',
      registry_active: meta?.status === 'active',
      tools_list_tested: false, tool_invocation_tested: false, mcp_conformance_verified: false,
    };
  }
  if (id === 'mcp_discovery') {
    if (record.protocol !== 'mcp' || !nonemptyString(record.serverInfo?.version) ||
        !Array.isArray(record.tools) || !record.tools.every(x => nonemptyString(x?.name))) {
      return { state: 'coverage_unknown', reason: 'invalid_mcp_get_advertisement' };
    }
    const toolNames = record.tools.map(x => x.name);
    return {
      state: 'observed', advertised_version: record.serverInfo.version,
      advertised_tool_count: toolNames.length,
      free_verify_record_advertised: toolNames.includes('verify_record'),
      tools_list_tested: false, tool_invocation_tested: false,
      mcp_conformance_verified: false,
    };
  }
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
