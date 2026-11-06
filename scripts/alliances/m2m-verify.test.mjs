import test from 'node:test';
import assert from 'node:assert/strict';
import { ENDPOINT, DEMO_RECORD, decodeJsonRpc, runFreeM2M } from './m2m-verify.mjs';
const encode=(id,result)=>JSON.stringify({jsonrpc:'2.0',id,result});
function client({init={},listing={},verdict={},toolError=false,overrideStatus={},failOn}={}) {
  const calls=[];
  const tool={name:'verify_record',description:'Free. Verify published signed reference provenance record',inputSchema:{type:'object',properties:{id:{type:'string'}}}};
  const fetchImpl=async (url,opts)=>{
    assert.equal(url, ENDPOINT);
    assert.equal(opts.credentials,'omit');assert.equal(opts.redirect,'error');
    assert.equal(opts.headers['mcp-protocol-version'],'2025-06-18');
    assert.ok(!opts.headers.authorization && !opts.headers['x-payment'] && !opts.headers.cookie);
    const body=JSON.parse(opts.body);calls.push(body);
    if (body.method===failOn) throw new Error('transport_failure');
    const status=overrideStatus[body.method]|| (body.method==='notifications/initialized'?202:200);
    const data=body.method==='initialize' ? {serverInfo:{name:'authichain',version:'1.4.0'},protocolVersion:'2025-06-18',capabilities:{tools:{}},...init} :
      body.method==='tools/list' ? {tools:[tool],...listing} :
      body.method==='tools/call' ? {content:[{type:'text',text:JSON.stringify({source:'published_example',demonstration:true,verdict:'verified',protocolVerdict:'verified',checks:{signature:true,anchorHash:true},anchorOnChain:true,anchorChainStatus:'tx_contains_record_hash',signer:{allowlisted:true,productionIssuer:false},...verdict})}],isError:toolError} : {};
    return {status,headers:{get:(key)=>key==='content-type'?'application/json':null},text:async()=>encode(body.id,data)};
  };
  return {fetchImpl,calls};
}
test('dry-run makes no requests',async()=>{let called=false;const r=await runFreeM2M({fetchImpl:()=>{called=true;}});assert.equal(r.status,'dry_run');assert.equal(called,false)});
test('rejects all targets except canonical public MCP URL',async()=>{await assert.rejects(runFreeM2M({target:'https://example.com/mcp',live:true}),/only_public/)});
test('valid M2M handshake and one free tool call',async()=>{const f=client();const r=await runFreeM2M({...f,live:true});assert.equal(r.status,'tool_response_received');assert.deepEqual(f.calls.map(x=>x.method),['initialize','notifications/initialized','tools/list','tools/call']);assert.deepEqual(f.calls.at(-1).params,{name:'verify_record',arguments:{id:DEMO_RECORD}});assert.equal(r.result.verification.verdict,'verified');assert.equal(r.result.verification.physicalAuthenticityProven,false);assert.equal(r.paymentAttempted,false)});
test('never calls paid verify tool',async()=>{const f=client();await runFreeM2M({...f,live:true});assert.equal(f.calls.filter(x=>x.method==='tools/call').length,1);assert.equal(f.calls.at(-1).params.name,'verify_record')});
test('missing free tool stops before any tool invocation',async()=>{const f=client({listing:{tools:[{name:'verify',description:'x402 paid',inputSchema:{type:'object'}}]}});const r=await runFreeM2M({...f,live:true});assert.equal(r.status,'inconclusive');assert.equal(r.result.reason,'free_tool_not_confirmed');assert.equal(f.calls.length,3)});
test('mislabelled paid tool stops',async()=>{const f=client({listing:{tools:[{name:'verify_record',description:'Payment required',inputSchema:{type:'object'}}]}});const r=await runFreeM2M({...f,live:true});assert.equal(r.result.reason,'free_tool_not_confirmed');assert.equal(f.calls.length,3)});
test('HTTP 402 never initiates a payment',async()=>{const f=client({overrideStatus:{'tools/call':402}});const r=await runFreeM2M({...f,live:true});assert.equal(r.status,'inconclusive');assert.equal(r.result.reason,'payment_required_no_payment_sent');assert.equal(r.paymentAttempted,false)});
test('error in free tool is not success',async()=>{const f=client({toolError:true});const r=await runFreeM2M({...f,live:true});assert.equal(r.result.reason,'verification_tool_error')});
test('unsigned/unpublished record is not promoted to proof',async()=>{const f=client({verdict:{source:'submitted',demonstration:false}});const r=await runFreeM2M({...f,live:true});assert.equal(r.result.reason,'not_published_demo')});
test('reported verdict unverified is kept distinct',async()=>{const f=client({verdict:{verdict:'unverified',anchorOnChain:false}});const r=await runFreeM2M({...f,live:true});assert.equal(r.status,'tool_response_received');assert.equal(r.result.verification.verdict,'unverified');assert.equal(r.result.verification.anchorOnChain,false)});
test('no tools capability stops before invocation',async()=>{const f=client({init:{capabilities:{}}});const r=await runFreeM2M({...f,live:true});assert.equal(r.result.reason,'unsupported_mcp_server');assert.equal(f.calls.length,1)});
test('network failure is inconclusive',async()=>{const f=client({failOn:'initialize'});const r=await runFreeM2M({...f,live:true});assert.equal(r.status,'inconclusive');assert.equal(r.result.reason,'transport_failure')});
test('wrong JSON-RPC id rejected',()=>{assert.throws(()=>decodeJsonRpc(encode(2,{}),'application/json',1),/wrong_or_missing_jsonrpc_id/)});
test('SSE JSON-RPC message accepted',()=>{const s='event: message\ndata: '+encode(1,{ok:true})+'\n\n';assert.deepEqual(decodeJsonRpc(s,'text/event-stream',1),{ok:true})});
test('oversized response rejected',()=>{assert.throws(()=>decodeJsonRpc('x'.repeat(270000),'application/json',1),/response_too_large/)});
test('invalid tool listing never invokes tool',async()=>{const f=client({listing:{tools:null}});const r=await runFreeM2M({...f,live:true});assert.equal(r.result.reason,'unsupported_tool_listing');assert.equal(f.calls.length,3)});
test('HTTP 403 fails closed',async()=>{const f=client({overrideStatus:{'initialize':403}});const r=await runFreeM2M({...f,live:true});assert.equal(r.result.reason,'authorization_required')});
