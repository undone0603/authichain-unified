import test from 'node:test';
import assert from 'node:assert/strict';
import { TARGETS, classify, probe } from './public-evidence-probe.mjs';

const json = (data, init={}) => new Response(JSON.stringify(data), { status: 200, headers: { 'content-type':'application/json', ...init }, });

test('exactly five fixed public HTTPS targets, without a payment endpoint', () => {
  assert.equal(TARGETS.length, 5);
  assert.ok(TARGETS.every(x => x.url.startsWith('https://') && !/checkout|pay|wallet|stripe/.test(x.url)));
});
test('verified demo never certifies a physical product or independent chain observation', () => {
  const r = classify('demo_verification', {decision:'verified', demonstration:true, anchorOnChain:true});
  assert.equal(r.kind, 'demonstration'); assert.equal(r.physical_product_authenticity, 'not_established');
  assert.equal(r.independently_verified_chain, false);
});
test('missing identifier is not a counterfeit verdict', () => {
  const r = classify('unknown_verification', {decision:'not_found'});
  assert.equal(r.absence_is_counterfeit, false); assert.equal(r.counterfeit_verdict,'not_established');
});
test('unsigned AgentCard discovery is not authority or TCK certification', () => {
  const r = classify('agentcard_discovery', { name:'AuthiChain', version:'1.3.2',
    supportedInterfaces: [{url:'https://authichain.com/api/a2a',protocolBinding:'JSONRPC',protocolVersion:'1.0'}] });
  assert.equal(r.advertised_url, 'https://authichain.com/api/a2a');
  assert.equal(r.advertised_version, '1.0');
  assert.equal(r.application_version, '1.3.2');
  assert.equal(r.card_signature_validated, false); assert.equal(r.caller_authorized, false);
  assert.equal(r.a2a_tck_passed, false);
});
test('registry metadata does not imply a successful MCP tool call', () => {
  const r = classify('mcp_registry_metadata', {
    server:{name:'com.authichain/authichain',version:'1.3.2'},
    _meta:{'io.modelcontextprotocol.registry/official':{status:'active'}}
  });
  assert.equal(r.registry_version, '1.3.2'); assert.equal(r.registry_active, true);
  assert.equal(r.mcp_conformance_verified, false); assert.equal(r.tools_list_tested, false);
});
test('invalid evidence and unknown target produce coverage_unknown', () => {
  assert.equal(classify('demo_verification', null).state, 'coverage_unknown');
  assert.equal(classify('other', {}).state, 'coverage_unknown');
});
test('all outbound calls are GET, fixed targets, omitted credentials, and redirect denied', async () => {
  let i=0;const seen=[];
  const fixtures = [
    {demonstration:true,decision:'verified'},
    {decision:'not_found'},
    {name:'AuthiChain',version:'1.3.2',supportedInterfaces:[{url:'https://authichain.com/api/a2a',protocolBinding:'JSONRPC',protocolVersion:'1.0'}]},
    {server:{name:'com.authichain/authichain',version:'1.3.2'},_meta:{'io.modelcontextprotocol.registry/official':{status:'active'}}},
    {protocol:'mcp',serverInfo:{version:'1.4.0'},tools:[{name:'verify_record'}]},
  ];
  const result = await probe(async (url, opts) => { seen.push({url,opts}); return json(fixtures[i++]); }, 'a'.repeat(40));
  assert.equal(result.observations.filter(o=>o.state==='observed').length,5);
  assert.equal(result.source_ref,'a'.repeat(40));
  assert.ok(seen.every((x,j)=> x.url===TARGETS[j].url && x.opts.method==='GET' && x.opts.credentials==='omit' && x.opts.redirect==='error'));
});
test('HTTP error preserves unknown coverage', async () => {
  const r = await probe(async () => new Response('{}',{status:503,headers:{'content-type':'application/json'}}));
  assert.ok(r.observations.every(o=>o.state==='coverage_unknown' && o.reason==='http_status_503'));
});
test('HTML is not accepted as protocol evidence', async () => {
  const r=await probe(async()=>new Response('<html>ok</html>',{headers:{'content-type':'text/html'}}));
  assert.ok(r.observations.every(o=>o.reason==='non_json_response'));
});
test('malformed JSON is coverage_unknown', async () => {
  const r=await probe(async()=>new Response('{bad',{headers:{'content-type':'application/json'}}));
  assert.ok(r.observations.every(o=>o.reason==='invalid_json'));
});
test('large bodies are rejected regardless of header', async () => {
  const r=await probe(async()=>new Response(' '.repeat(131073),{headers:{'content-type':'application/json'}}));
  assert.ok(r.observations.every(o=>o.reason==='oversize_response'));
});
test('network failure is not mistaken for absence', async () => {
  const r=await probe(async()=>{throw new Error('private network detail must not leak')});
  assert.ok(r.observations.every(o=>o.state==='coverage_unknown' && o.reason==='transport_or_parse_failure'));
});
test('health/discovery does not establish payment or independent acceptance', async () => {
  const r=await probe(async()=>json({status:'healthy',paid:true}));
  assert.equal(r.paid_settlement,'not_tested');assert.equal(r.independent_review,'not_established');
  assert.equal(r.a2a_tck,'not_executed');
});

test('empty objects cannot masquerade as observed service evidence', () => {
  for (const { id } of TARGETS) {
    const r = classify(id, {});
    assert.equal(r.state, 'coverage_unknown', id);
  }
});
test('A2A root protocolVersion is not mistaken for versioned supportedInterfaces', () => {
  const r = classify('agentcard_discovery',{name:'Fake',version:'1.0',url:'https://authichain.com/api/a2a',protocolVersion:'1.0'});
  assert.equal(r.state, 'coverage_unknown');
  assert.equal(r.reason, 'missing_a2a_card_interface');
});
test('A2A HTTP or insecure interface cannot become a confirmed JSON-RPC 1.0 interface', () => {
  const base = {name:'AuthiChain',version:'1.3.2'};
  const http = classify('agentcard_discovery',{...base,supportedInterfaces:[{url:'http://authichain.com/api/a2a',protocolBinding:'JSONRPC',protocolVersion:'1.0'}]});
  const other = classify('agentcard_discovery',{...base,supportedInterfaces:[{url:'https://authichain.com/api/a2a',protocolBinding:'HTTP+JSON',protocolVersion:'1.0'}]});
  assert.equal(http.state,'coverage_unknown');assert.equal(other.state,'coverage_unknown');
});
test('MCP registry must match the canonical namespace and report its status', () => {
  const wrong = classify('mcp_registry_metadata',{server:{name:'io.github.other/other',version:'9.9'}});
  assert.equal(wrong.state,'coverage_unknown');
  const missingStatus = classify('mcp_registry_metadata',{server:{name:'com.authichain/authichain',version:'1.3.2'}});
  assert.equal(missingStatus.state,'observed');
  assert.equal(missingStatus.registry_active,false);
  assert.equal(missingStatus.registry_status,'not_reported');
});
test('MCP GET metadata advertises tools but cannot satisfy tools/list or tool-call conformance', () => {
  const observed = classify('mcp_discovery',{protocol:'mcp',serverInfo:{version:'1.4.0'},tools:[{name:'verify_record'},{name:'query_provenance'}]});
  assert.equal(observed.state,'observed');
  assert.equal(observed.advertised_version,'1.4.0');
  assert.equal(observed.advertised_tool_count,2);
  assert.equal(observed.free_verify_record_advertised,true);
  assert.equal(observed.tools_list_tested,false);assert.equal(observed.tool_invocation_tested,false);
  assert.equal(observed.mcp_conformance_verified,false);
});
test('MCP fake server metadata is not counted as tool discovery', () => {
  assert.equal(classify('mcp_discovery',{tools:[{name:'verify_record'}]}).state,'coverage_unknown');
  assert.equal(classify('mcp_discovery',{protocol:'mcp',serverInfo:{version:'1.4.0'},tools:[{description:'none'}]}).state,'coverage_unknown');
});
test('missing unknown-record decision cannot become verified absence', () => {
  const result=classify('unknown_verification',{reasons:['object_not_found']});
  assert.equal(result.state,'coverage_unknown');
  const mismatch=classify('unknown_verification',{decision:'verified'});
  assert.equal(mismatch.expected_not_found,false);
  assert.equal(mismatch.absence_is_counterfeit,false);
});
test('four malformed JSON GET responses and one valid GET remain separate evidence states', async () => {
  let i=0;
  const r=await probe(async()=>json(i++===4?{protocol:'mcp',serverInfo:{version:'1.4.0'},tools:[]} : {}));
  assert.equal(r.observations.filter(x=>x.state==='coverage_unknown').length,4);
  assert.equal(r.observations.find(x=>x.target==='mcp_discovery').state,'observed');
});
