/**
 * Cedr v0.8.1 compatible, read-only MCP Streamable HTTP handshake probe.
 * AuthiChain public target only. Sends initialize / notification / tools/list,
 * NEVER tools/call, authorization, credentials, payment, or a mutation.
 * Does NOT execute Cedr itself, enforce DNS pinning or certify conformance.
 * CLI: node cedr-streamable-handshake.mjs --live
 * Default: offline dry-run.
 */
export const TARGET = 'https://authichain.com/mcp';
export const PROTOCOL_VERSION = '2025-06-18';
const MAX_BYTES = 262144;
const MAX_PAGES = 20;
const MAX_TOOLS = 2000;
const TIMEOUT_MS = 12000;

export function parseReply(text, mediaType, id) {
  if (text.length > MAX_BYTES) throw new Error('response_too_large');
  let messages;
  if (mediaType.toLowerCase().includes('text/event-stream')) {
    messages = text.split(/\r?\n\r?\n/).map(event => {
      const data = event.split(/\r?\n/).filter(line => line.startsWith('data:')).map(line => line.slice(5).trim()).join('\n');
      if (!data || data === '[DONE]') return null;
      try { return JSON.parse(data); } catch { return null; }
    }).filter(Boolean);
  } else {
    try { messages = [JSON.parse(text)]; } catch { throw new Error('invalid_json'); }
  }
  const response = messages.find(x => x && x.jsonrpc === '2.0' && x.id === id);
  if (!response) throw new Error('missing_jsonrpc_reply');
  if (response.error) throw new Error('jsonrpc_error');
  if (!response.result || typeof response.result !== 'object' || Array.isArray(response.result))
    throw new Error('invalid_result');
  return response.result;
}

export async function probeStreamableHttp({ fetchImpl = fetch, live = false, target = TARGET } = {}) {
  if (target !== TARGET) throw new Error('target_must_be_public_authichain_mcp');
  const output = {
    checked: TARGET, protocolVersion: PROTOCOL_VERSION,
    technique: 'read_only_streamable_http_handshake',
    cedrBinaryExecuted: false, toolCallsExecuted: 0, paymentsAttempted: 0,
    status: 'dry_run', result: null,
  };
  if (!live) return output;
  let sessionId = null;
  let requestCount = 0;
  async function post(method, params, id) {
    const body = { jsonrpc: '2.0', method, ...(id == null ? {} : { id }), ...(params == null ? {} : { params }) };
    const headers = {
      'content-type': 'application/json',
      accept: 'application/json, text/event-stream',
      'mcp-protocol-version': PROTOCOL_VERSION,
      ...(sessionId ? { 'mcp-session-id': sessionId } : {}),
    };
    const response = await fetchImpl(TARGET, {
      method: 'POST', headers, body: JSON.stringify(body), redirect: 'error',
      signal: AbortSignal.timeout(TIMEOUT_MS), credentials: 'omit',
    });
    requestCount += 1;
    const status = response.status;
    if (status === 401 || status === 403) throw new Error('authentication_required');
    if (status === 402) throw new Error('payment_required_no_payment_attempted');
    if (status < 200 || status >= 300) throw new Error('http_' + status);
    const sid = response.headers?.get?.('mcp-session-id');
    if (sid && sid.length <= 512 && /^[\x21-\x7e]+$/.test(sid)) sessionId = sid;
    if (id == null) return null;
    const text = await response.text();
    return parseReply(text, response.headers?.get?.('content-type') || 'application/json', id);
  }
  try {
    const init = await post('initialize', {
      protocolVersion: PROTOCOL_VERSION, capabilities: {},
      clientInfo: { name: 'authichain-cedr-compat-probe', version: '0.8.1' },
    }, 1);
    const capabilities = init.capabilities;
    if (!capabilities || typeof capabilities !== 'object' || Array.isArray(capabilities))
      throw new Error('initialize_capabilities_missing');
    // Following Cedr's behavior: no tools capability means there are no tools to diff.
    if (!Object.prototype.hasOwnProperty.call(capabilities, 'tools')) {
      output.status = 'initialized_without_tools';
      output.result = { toolNames: [], requests: requestCount };
      return output;
    }
    // Cedr ignores notification response. An HTTP error is reported, but not a tool call.
    let notification;
    try { await post('notifications/initialized', null, null); notification = 'sent'; }
    catch { notification = 'not_accepted'; }
    let cursor = null;
    const names = [];
    const seenCursors = new Set();
    for (let page = 0; page < MAX_PAGES; page++) {
      const result = await post('tools/list', cursor ? { cursor } : {}, page + 2);
      if (!Array.isArray(result.tools)) throw new Error('invalid_tool_list');
      for (const tool of result.tools) {
        if (!tool || typeof tool.name !== 'string' || !tool.name ||
            !tool.inputSchema || typeof tool.inputSchema !== 'object')
          throw new Error('invalid_tool');
        names.push(tool.name);
      }
      if (names.length > MAX_TOOLS) throw new Error('too_many_tools');
      if (result.nextCursor == null || result.nextCursor === '') {
        output.status = 'tools_listed';
        output.result = { toolNames: names.sort(), totalTools: names.length,
          requests: requestCount, notification };
        return output;
      }
      if (typeof result.nextCursor !== 'string' || seenCursors.has(result.nextCursor))
        throw new Error('invalid_or_repeated_cursor');
      seenCursors.add(result.nextCursor);
      cursor = result.nextCursor;
    }
    throw new Error('too_many_pages');
  } catch (error) {
    output.status = 'inconclusive';
    output.result = { reason: error?.message || 'unreachable', requests: requestCount };
    return output;
  }
}

if (process.argv[1] && import.meta.url === new URL('file://' + process.argv[1]).href) {
  const live = process.argv.includes('--live');
  const result = await probeStreamableHttp({live});
  process.stdout.write(JSON.stringify(result, null, 2) + '\n');
  if (live && result.status !== 'tools_listed') process.exitCode = 2;
}
