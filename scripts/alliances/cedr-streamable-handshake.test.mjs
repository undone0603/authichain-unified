import { test } from 'node:test';
import assert from 'node:assert/strict';
import { TARGET, parseReply, probeStreamableHttp } from './cedr-streamable-handshake.mjs';
const result = (id, value) => JSON.stringify({ jsonrpc:'2.0', id, result: value });
const headers = (contentType = 'application/json', sid = null) => ({ get(k) {
  return k.toLowerCase() === 'content-type' ? contentType : k.toLowerCase() === 'mcp-session-id' ? sid : null;
}});
const reply = (body, {status = 200, type = 'application/json', sid = null} = {}) => ({
 status, headers: headers(type,sid), text: async () => body,
});
function fake({init = {capabilities:{tools:{}}}, tools = [{name:'verify_record', inputSchema:{type:'object'}}],
 listStatus = 200, initStatus = 200, initSid = null, listType = 'application/json'} = {}) {
 const calls=[];
 const fetchImpl=async (url, opts) => {
   assert.equal(url,TARGET); assert.equal(opts.method,'POST'); assert.equal(opts.credentials,'omit');
   assert.equal(opts.redirect,'error'); assert.ok(!opts.headers.authorization);
   const req=JSON.parse(opts.body); calls.push({req, headers:opts.headers});
   if(req.method==='initialize') return reply(result(1,init),{status:initStatus,sid:initSid});
   if(req.method==='notifications/initialized') return reply('',{status:202});
   if(req.method==='tools/list') return reply(result(req.id,{tools}),{status:listStatus, type:listType});
   throw new Error('unexpected_method');
 };
 return {fetchImpl,calls};
}
test('default dry run never calls network',async()=>{let called=false;let r=await probeStreamableHttp({fetchImpl:()=>{called=true}});assert.equal(r.status,'dry_run');assert.equal(called,false)});
test('fixed target rejects other URLs before network',async()=>{await assert.rejects(probeStreamableHttp({target:'https://other.site/mcp',live:true}),/target_must_be/)});
test('normal Streamable HTTP initialize then tools/list',async()=>{const m=fake();const r=await probeStreamableHttp({...m,live:true});assert.equal(r.status,'tools_listed');assert.deepEqual(r.result.toolNames,['verify_record']);assert.deepEqual(m.calls.map(x=>x.req.method),['initialize','notifications/initialized','tools/list'])});
test('no tool calls or payments occur',async()=>{const m=fake();const r=await probeStreamableHttp({...m,live:true});assert.equal(r.paymentsAttempted,0);assert.equal(r.toolCallsExecuted,0);assert.equal(r.cedrBinaryExecuted,false);assert.ok(m.calls.every(x=>x.req.method!=='tools/call'))});
test('mcp protocol header sent with no credentials',async()=>{const m=fake();await probeStreamableHttp({...m,live:true});assert.ok(m.calls.every(x=>x.headers['mcp-protocol-version']==='2025-06-18'));assert.ok(m.calls.every(x=>!x.headers.cookie))});
test('session id propagated to tools/list without displaying it',async()=>{const m=fake({initSid:'secret-session-value'});const r=await probeStreamableHttp({...m,live:true});assert.equal(m.calls[2].headers['mcp-session-id'],'secret-session-value');assert.doesNotMatch(JSON.stringify(r),/secret-session-value/)});
test('not declaring tools is a bounded result, not compatibility',async()=>{const m=fake({init:{capabilities:{}}});const r=await probeStreamableHttp({...m,live:true});assert.equal(r.status,'initialized_without_tools');assert.equal(m.calls.length,1)});
test('401/403 require auth, no retries',async()=>{for(const s of [401,403]){const m=fake({initStatus:s});const r=await probeStreamableHttp({...m,live:true});assert.equal(r.result.reason,'authentication_required');assert.equal(m.calls.length,1)}});
test('402 is not paid',async()=>{const m=fake({listStatus:402});const r=await probeStreamableHttp({...m,live:true});assert.equal(r.status,'inconclusive');assert.equal(r.result.reason,'payment_required_no_payment_attempted');assert.equal(r.paymentsAttempted,0)});
test('500 error is inconclusive, not success',async()=>{const m=fake({initStatus:500});const r=await probeStreamableHttp({...m,live:true});assert.equal(r.result.reason,'http_500')});
test('missing capabilities is inconclusive',async()=>{const m=fake({init:{hello:true}});const r=await probeStreamableHttp({...m,live:true});assert.equal(r.result.reason,'initialize_capabilities_missing')});
test('JSON-RPC missing result fails closed',()=>{assert.throws(()=>parseReply('{"jsonrpc":"2.0","id":1}', 'application/json',1),/invalid_result/)});
test('SSE JSON-RPC data parse',()=>{let s='event: message\ndata: '+result(1,{capabilities:{tools:{}}})+'\n\n';assert.ok(parseReply(s,'text/event-stream',1).capabilities.tools)});
test('wrong JSON-RPC id fails closed',()=>{assert.throws(()=>parseReply(result(2,{}),'application/json',1),/missing_jsonrpc_reply/)});
test('large response fails closed',()=>{assert.throws(()=>parseReply('x'.repeat(300000),'application/json',1),/response_too_large/)});
test('invalid tool list is inconclusive',async()=>{const m=fake({tools:null});const r=await probeStreamableHttp({...m,live:true});assert.equal(r.result.reason,'invalid_tool_list')});
test('network exception remains inconclusive',async()=>{const r=await probeStreamableHttp({live:true,fetchImpl:async()=>{throw new Error('no_dns')}});assert.equal(r.result.reason,'no_dns')});
