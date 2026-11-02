import test from 'node:test';
import assert from 'node:assert/strict';
import { TARGETS, classify, probe } from './public-evidence-probe.mjs';

const json = (data, init={}) => new Response(JSON.stringify(data), { status: 200, headers: { 'content-type':'application/json', ...init }, });

test('exactly four fixed public HTTPS targets, without a payment endpoint', () => {
  assert.equal(TARGETS.length, 4);
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
  const r = classify('agentcard_discovery', {url:'https://authichain.com/api/a2a', protocolVersion:'1.0'});
  assert.equal(r.card_signature_validated, false); assert.equal(r.caller_authorized, false);
  assert.equal(r.a2a_tck_passed, false);
});
test('registry metadata does not imply a successful MCP tool call', () => {
  const r = classify('mcp_registry_metadata', {server:{name:'com.authichain/authichain'}});
  assert.equal(r.mcp_conformance_verified, false); assert.equal(r.tools_list_tested, false);
});
test('invalid evidence and unknown target produce coverage_unknown', () => {
  assert.equal(classify('demo_verification', null).state, 'coverage_unknown');
  assert.equal(classify('other', {}).state, 'coverage_unknown');
});
test('all outbound calls are GET, fixed targets, omitted credentials, and redirect denied', async () => {
  let i=0;const seen=[];
  const result = await probe(async (url, opts) => { seen.push({url,opts}); return json(i++===0 ? {demonstration:true,decision:'verified'} : {decision:'not_found'}); }, 'a'.repeat(40));
  assert.equal(result.observations.filter(o=>o.state==='observed').length,4);
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
