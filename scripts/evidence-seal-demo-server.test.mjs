import test from 'node:test';
import assert from 'node:assert/strict';
import {createDemoServer} from './evidence-seal-demo-server.mjs';

let server,origin;
test.before(async()=>{
 server=createDemoServer();await new Promise(r=>server.listen(0,'127.0.0.1',r));origin=`http://127.0.0.1:${server.address().port}`;
});
test.after(async()=>{await new Promise(r=>server.close(r));});
test('test-only page explicitly limits scope',async()=>{
 const r=await fetch(origin+'/evidence/demo');const t=await r.text();
 assert.equal(r.status,200);assert.match(t,/Signature verified — evidence uncorroborated/);
 assert.match(t,/issuer.example/);assert.doesNotMatch(t,/SealKeeper-certified/);
 assert.equal(r.headers.get('x-content-type-options'),'nosniff');
 assert.match(r.headers.get('content-security-policy'),/default-src 'none'/);
});
test('well-known keys are public test keys only, never production issuer keys',async()=>{
 const r=await fetch(origin+'/.well-known/seal.json');const j=await r.json();
 assert.equal(j.keys.length,1);assert.equal(j.keys[0].d,undefined);assert.match(j.notice,/TEST PUBLIC KEY/);
});
test('badge and receipt JSON are read-only, no false certification',async()=>{
 let r=await fetch(origin+'/evidence/demo/badge.svg');assert.equal(r.status,200);assert.match(await r.text(),/NOT CERTIFICATION/);
 r=await fetch(origin+'/evidence/demo.json');const j=await r.json();assert.equal(r.status,200);assert.equal(j.issuer,'https://issuer.example');
});
test('POST/PUT fails closed, including credential issuance endpoint',async()=>{
 for(const path of ['/evidence/demo','/api/issue','/evidence/demo.json']){
   for(const method of ['POST','PUT']){
     const r=await fetch(origin+path,{method});assert.equal(r.status,405);assert.equal((await r.json()).valid,false);
   }
 }
});
test('unknown or private data routes are 404, no echo',async()=>{
 const r=await fetch(origin+'/api/stripe/webhook');assert.equal(r.status,404);assert.equal((await r.json()).valid,false);
});
test('HEAD hides payload',async()=>{
 const r=await fetch(origin+'/evidence/demo',{method:'HEAD'});assert.equal(r.status,200);assert.equal(await r.text(),'');
});
