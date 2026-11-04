import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
const source = readFileSync(new URL('./govchain-onboard.ts', import.meta.url), 'utf8');
const mod = await import('data:text/javascript;charset=utf-8,' + encodeURIComponent(stripTypeScriptTypes(source)));
const { renderGovchainOnboard, submitGovchainOnboard } = mod;
const req = (body, headers = {}) => new Request('https://govchain.us/onboard', { method:'POST', headers:{'content-type':'application/x-www-form-urlencoded',...headers}, body });
const valid = 'company=Example+Contractor&email=buyer%40example.com';
test('renders GovChain-specific no-payment form', async()=>{
  const r=renderGovchainOnboard();const h=await r.text();assert.equal(r.status,200);
  for(const s of ['Request GovChain contractor access','method="POST"','action="/onboard"','/opportunities','No payment is collected here']) assert.ok(h.includes(s),s);
  for(const banned of ['Buy Starter Pack','StrainChain Passport','Workspace opened']) assert.equal(h.includes(banned),false,banned);
  assert.match(r.headers.get('cache-control'),/no-store/);assert.match(r.headers.get('content-security-policy'),/form-action 'self'/);
});
test('valid inquiry sends only GovChain-tagged fields and confirms stored response',async()=>{
 let got;const r=await submitGovchainOnboard(req(valid),async lead=>{got=lead;return Response.json({ok:true})});
 assert.deepEqual(got,{email:'buyer@example.com',name:'Example Contractor',source:'govchain_onboard',product_interest:'govchain',page_url:'https://govchain.us/onboard'});
 assert.equal(r.status,200);assert.match(await r.text(),/inquiry was saved/i);
});
for(const [why,body] of [['invalid email','company=Co&email=invalid'],['missing email','company=Co'],['duplicate email','company=Co&email=a%40b.com&email=c%40d.com'],['missing company','email=a%40b.com'],['duplicate company','company=Co&company=Other&email=a%40b.com']]){
 test('rejects '+why+' without forwarding',async()=>{let calls=0;const r=await submitGovchainOnboard(req(body),async()=>{calls++;return Response.json({ok:true})});assert.equal(r.status,400);assert.equal(calls,0)});
}
test('rejects unsupported content type',async()=>{let calls=0;const r=await submitGovchainOnboard(req(valid,{'content-type':'application/json'}),async()=>{calls++;return Response.json({ok:true})});assert.equal(r.status,415);assert.equal(calls,0)});
test('limits excessive submissions',async()=>{let calls=0;const r=await submitGovchainOnboard(req(valid,{'content-length':'3000'}),async()=>{calls++;return Response.json({ok:true})});assert.equal(r.status,413);assert.equal(calls,0)});
test('honeypot never forwards',async()=>{let calls=0;const r=await submitGovchainOnboard(req(valid+'&website=bot'),async()=>{calls++;return Response.json({ok:true})});assert.equal(calls,0);assert.doesNotMatch(await r.text(),/was saved/i)});
for(const [name,response] of [['backend failure',()=>new Response('oops',{status:500})],['false ok',()=>Response.json({ok:false})],['invalid json',()=>new Response('html')],['network error',()=>{throw Error('down')}]] )test('fails closed: '+name,async()=>{const r=await submitGovchainOnboard(req(valid),async()=>response());assert.equal(r.status,503);assert.match(await r.text(),/not saved/i)});

test('rejects chunked oversize input without Content-Length or forwarding', async () => {
 let calls = 0;
 const stream = new ReadableStream({
   start(controller) {
     controller.enqueue(new TextEncoder().encode('company=Firm&email=x%40example.com&other='));
     controller.enqueue(new Uint8Array(3500).fill(65));
     controller.close();
   },
 });
 const request = new Request('https://govchain.us/onboard', {
   method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
   body: stream, duplex: 'half',
 });
 const response = await submitGovchainOnboard(request, async () => { calls++; return Response.json({ ok: true }); });
 assert.equal(response.status, 413);
 assert.equal(calls, 0);
});
test('rejects malformed UTF-8 before forwarding', async () => {
 const request = new Request('https://govchain.us/onboard', {
   method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
   body: new Uint8Array([0xff, 0xfe]), duplex: 'half',
 });
 let calls = 0;
 const response = await submitGovchainOnboard(request, async () => { calls++; return Response.json({ ok: true }); });
 assert.equal(response.status, 400);
 assert.equal(calls, 0);
});
