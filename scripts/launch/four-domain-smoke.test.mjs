import test from 'node:test';
import assert from 'node:assert/strict';
import { TARGETS, run } from './four-domain-smoke.mjs';

const good = (isJson=false)=>new Response(isJson ? '{"ok":true}' : '<html>test</html>', {
  status:200,headers:{'content-type':isJson?'application/json':'text/html; charset=utf-8'}
});
const healthy = async (_url,opts)=>good(opts.headers.Accept==='application/json');

test('fixed list covers four brands with no arbitrary URL input',()=>{
  assert.equal(TARGETS.length,16);
  assert.deepEqual([...new Set(TARGETS.map(t=>t.brand))].sort(),['AuthiChain','GovChain','QRON','StrainChain']);
  assert.ok(TARGETS.every(t=>['https://authichain.com/','https://qron.space/','https://strainchain.io/','https://govchain.us/'].some(o=>t.url.startsWith(o))));
});
test('all probes use GET with no credential, no redirect, and no network writes',async()=>{
  const calls=[];
  const r=await run(async(url,opts)=>{calls.push({url,opts});return good(opts.headers.Accept==='application/json')},'a'.repeat(40));
  assert.equal(calls.length,16);
  assert.ok(calls.every((c,i)=>c.url===TARGETS[i].url&&c.opts.method==='GET'&&c.opts.credentials==='omit'&&c.opts.redirect==='error'));
  assert.equal(r.payments_performed,false);
  assert.equal(r.forms_submitted,false);
  assert.equal(r.agent_tck_passed,false);
  assert.equal(r.customer_delivery_proven,false);
  assert.equal(r.sites_publicly_reachable,true);
});
test('HTTP 400 on publicly advertised stored QR example is a regression',async()=>{
  const r=await run((url,opts)=>url.includes('/qron/r/')?Promise.resolve(new Response('bad id',{status:400,headers:{'content-type':'application/json'}})):Promise.resolve(good(opts.headers.Accept==='application/json')));
  const target=r.observations.find(x=>x.id==='qron_stored_scan');
  assert.equal(target.state,'failed');
  assert.equal(target.reason,'http_status_400');
  assert.equal(r.sites_publicly_reachable,true);
});
test('404 on checkout confirmation is not treated as a valid checkout',async()=>{
  const r=await run((url,opts)=>url.includes('/checkout/starter')?Promise.resolve(new Response('not found',{status:404})):Promise.resolve(good(opts.headers.Accept==='application/json')));
  assert.equal(r.observations.find(x=>x.id==='authichain_starter_confirm').reason,'http_status_404');
});
test('HTTP 500 on GovChain opportunities fails without interpreting data as zero demand',async()=>{
  const r=await run((url,opts)=>url.includes('/opportunities')?Promise.resolve(new Response('failed',{status:500})):Promise.resolve(good(opts.headers.Accept==='application/json')));
  assert.equal(r.observations.find(x=>x.id==='govchain_opportunities').state,'failed');
});
test('JSON discovery with HTML does not falsely pass',async()=>{
  const r=await run(async()=>good(false));
  assert.equal(r.observations.find(x=>x.id==='authichain_agent_card').reason,'wrong_content_type');
});
test('empty HTML does not falsely pass',async()=>{
  const r=await run(async(url,opts)=>url==='https://qron.space/'?new Response('',{headers:{'content-type':'text/html'}}):good(opts.headers.Accept==='application/json'));
  assert.equal(r.observations.find(x=>x.id==='qron_home').state,'failed');
  assert.equal(r.sites_publicly_reachable,false);
});
test('network outage is unknown, not a live 200 or confirmed failure',async()=>{
  const r=await run(async()=>{throw Error('Private internal endpoint unavailable')});
  assert.ok(r.observations.every(x=>x.state==='coverage_unknown' && x.reason==='transport_or_redirect_failure'));
  assert.equal(r.sites_publicly_reachable,false);
});
test('HTTP redirects fail closed',async()=>{
  const r=await run(async()=>{throw TypeError('redirect was rejected')});
  assert.ok(r.observations.every(x=>x.state==='coverage_unknown'));
});
test('oversized body rejects without storing potentially private response',async()=>{
  const r=await run(async()=>new Response('x'.repeat(262145),{headers:{'content-type':'text/html'}}));
  assert.ok(r.observations.every(x=>x.reason==='oversize_response'));
});
test('a passing GET does not establish A2A conformance or customer revenue',async()=>{
  const r=await run(healthy);
  assert.ok(r.observations.every(x=>x.state==='reachable'));
  assert.equal(r.agent_tck_passed,false);
  assert.equal(r.customer_delivery_proven,false);
  assert.equal(r.payments_performed,false);
});
