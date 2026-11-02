/**
 * AuthiChain free M2M MCP verification client, v0.1.
 * Fixed public target; no credentials, payment headers, redirects or paid tools.
 * Offline by default. Live: `node m2m-verify.mjs --live`.
 * This is an adapter/transport demonstration, not a conformance certificate.
 */
export const ENDPOINT = 'https://authichain.com/mcp';
export const PROTOCOL_VERSION = '2025-06-18';
export const DEMO_RECORD = 'polygon-anchor-1';
const MAX_RESPONSE_BYTES = 262144;
const MAX_TOOLS = 64;

export function decodeJsonRpc(raw, contentType, expectedId) {
  if (typeof raw !== 'string' || Buffer.byteLength(raw, 'utf8') > MAX_RESPONSE_BYTES) throw new Error('response_too_large');
  const parse = v => { try { return JSON.parse(v); } catch { throw new Error('malformed_json_rpc'); } };
  let frames = [];
  if (/text\/event-stream/i.test(contentType || '')) {
    for (const frame of raw.split(/\r?\n\r?\n/)) {
      const data = frame.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n');
      if (data && data !== '[DONE]') { try { frames.push(parse(data)); } catch { /* ignore non-JSON heartbeat */ } }
    }
  } else frames = [parse(raw)];
  const match = frames.find(x => x && x.jsonrpc === '2.0' && x.id === expectedId);
  if (!match) throw new Error('wrong_or_missing_jsonrpc_id');
  if (match.error) throw new Error('server_jsonrpc_error');
  if (!match.result || typeof match.result !== 'object' || Array.isArray(match.result)) throw new Error('invalid_result');
  return match.result;
}

function decodeVerification(result) {
  if (result?.isError === true || !Array.isArray(result?.content)) throw new Error('verification_tool_error');
  const text = result.content.find(x => x?.type === 'text' && typeof x.text === 'string')?.text;
  if (!text) throw new Error('missing_verification_text');
  let evidence;
  try { evidence = JSON.parse(text); } catch { throw new Error('invalid_verification_json'); }
  if (!evidence || typeof evidence !== 'object' || Array.isArray(evidence)) throw new Error('invalid_verification_evidence');
  if (evidence.source !== 'published_example' || evidence.demonstration !== true) throw new Error('not_published_demo');
  if (!['verified', 'unverified', 'invalid', 'valid-unanchored'].includes(evidence.verdict)) throw new Error('unexpected_verdict');
  return {
    verdict: evidence.verdict,
    protocolVerdict: evidence.protocolVerdict ?? null,
    signatureValid: evidence.checks?.signature === true,
    anchorHashMatches: evidence.checks?.anchorHash === true,
    anchorOnChain: evidence.anchorOnChain === true,
    anchorChainStatus: evidence.anchorChainStatus ?? null,
    issuerAllowlisted: evidence.signer?.allowlisted === true,
    issuerProduction: evidence.signer?.productionIssuer === true,
    reasons: Array.isArray(evidence.reasons) ? evidence.reasons : [],
    source: evidence.source,
    demonstration: true,
    physicalAuthenticityProven: false,
    independentPeerVerified: false,
  };
}

export async function runFreeM2M({ live=false, fetchImpl=globalThis.fetch, target=ENDPOINT }={}) {
  if (target !== ENDPOINT) throw new Error('only_public_authichain_endpoint_allowed');
  const report = {
    schema: 'authichain.agentz.m2m-proof.v0.1',
    endpoint: ENDPOINT, record: DEMO_RECORD, mode: live?'live':'dry_run',
    status: 'dry_run', requests: [], freeToolOnly: true,
    paymentAttempted: false, walletConnected: false,
    thirdPartyConformanceCertified: false, result: null,
  };
  if (!live) return report;
  let sessionId;
  async function send(method, params, id, {notify=false}={}) {
    const body = {jsonrpc:'2.0', ...(id===undefined?{}:{id}), method, ...(params===undefined?{}:{params})};
    if (!['initialize', 'notifications/initialized', 'tools/list', 'tools/call'].includes(method)) throw new Error('method_not_allowed');
    if (method==='tools/call' && (params?.name!=='verify_record' || params?.arguments?.id!==DEMO_RECORD)) throw new Error('unapproved_tool_call');
    const headers = {
      'content-type':'application/json', accept:'application/json, text/event-stream',
      'mcp-protocol-version':PROTOCOL_VERSION,
      ...(sessionId?{'mcp-session-id':sessionId}:{})
    };
    report.requests.push(method + (method==='tools/call' ? ':verify_record':''));
    const res=await fetchImpl(ENDPOINT, {method:'POST',headers,body:JSON.stringify(body),redirect:'error',credentials:'omit',signal:AbortSignal.timeout(12000)});
    if (res.status===401 || res.status===403) throw new Error('authorization_required');
    if (res.status===402) throw new Error('payment_required_no_payment_sent');
    if (res.status<200 || res.status>=300) throw new Error('http_'+res.status);
    const sid=res.headers?.get?.('mcp-session-id');
    if (sid && sid.length<=512 && /^[\x21-\x7e]+$/.test(sid)) sessionId=sid;
    if (notify) return {httpStatus:res.status};
    const raw=await res.text();
    return decodeJsonRpc(raw, res.headers?.get?.('content-type')||'application/json', id);
  }
  try {
    const initialized = await send('initialize', {
      protocolVersion:PROTOCOL_VERSION, capabilities:{},
      clientInfo:{name:'agentz-free-m2m-client',version:'0.1'}
    },1);
    if (initialized.serverInfo?.name!=='authichain' ||
        initialized.protocolVersion!==PROTOCOL_VERSION ||
        !initialized.capabilities?.tools) throw new Error('unsupported_mcp_server');
    // Ignore notification body; a 202 without a body is correct MCP behavior.
    await send('notifications/initialized',undefined,undefined,{notify:true});
    const listed=await send('tools/list',{},2);
    if (!Array.isArray(listed.tools)||listed.tools.length>MAX_TOOLS || listed.nextCursor) throw new Error('unsupported_tool_listing');
    const matching=listed.tools.filter(t=>t?.name==='verify_record');
    if (matching.length!==1 || typeof matching[0].description!=='string' ||
        !/^Free\b/i.test(matching[0].description.trim()) ||
        !matching[0].inputSchema || typeof matching[0].inputSchema!=='object') throw new Error('free_tool_not_confirmed');
    // No x402 verify, no customer records, exactly one free demonstration lookup.
    const verification=await send('tools/call', {name:'verify_record',arguments:{id:DEMO_RECORD}},3);
    report.result={serverVersion:initialized.serverInfo.version||null,toolCount:listed.tools.length,
      verification:decodeVerification(verification)};
    report.status='tool_response_received';
    return report;
  } catch (error) {
    report.status='inconclusive'; report.result={reason:error?.message||'unknown'};
    return report;
  }
}

if (process.argv[1] && import.meta.url === new URL('file://'+process.argv[1]).href) {
  const report=await runFreeM2M({live:process.argv.includes('--live')});
  process.stdout.write(JSON.stringify(report,null,2)+'\n');
  if (report.mode==='live' && report.status!=='tool_response_received') process.exitCode=2;
}
