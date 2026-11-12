import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.mjs";
import { webcrypto } from "node:crypto";
if (!globalThis.crypto) globalThis.crypto = webcrypto;

const token="unit-dispatch-secret";
const env={AGENTZ_DISPATCH_TOKEN:token,AGENTZ_MCP_TOKEN:"different-mcp-secret"};
const request=(path,auth,header="authichain-automation")=>new Request("https://agentz.internal"+path,{method:"POST",headers:{"authorization":auth?"Bearer "+auth:"","x-agentz-dispatch":header}});
test("internal dispatch rejects missing token",async()=>{
 assert.equal((await worker.fetch(request("/internal/cron"),env)).status,401);
});
test("internal dispatch rejects MCP client credential",async()=>{
 assert.equal((await worker.fetch(request("/internal/cron",env.AGENTZ_MCP_TOKEN),env)).status,401);
});
test("internal dispatch rejects unauthorized dispatcher",async()=>{
 assert.equal((await worker.fetch(request("/internal/cron",token,"unknown"),env)).status,403);
});
test("authorized dispatcher cannot execute without D1",async()=>{
 const r=await worker.fetch(request("/internal/cron",token),env);
 assert.equal(r.status,200);
 assert.deepEqual(await r.json(),{service:"agentz-mcp-edge",processed:0,reason:"D1 not configured"});
});
test("MCP endpoint denies dispatcher credential",async()=>{
 assert.equal((await worker.fetch(request("/mcp",token),env)).status,401);
});
test("MCP tool list is authenticated",async()=>{
 const r=await worker.fetch(new Request("https://agentz.internal/mcp",{method:"POST",headers:{authorization:"Bearer "+env.AGENTZ_MCP_TOKEN},body:JSON.stringify({jsonrpc:"2.0",id:1,method:"tools/list"})}),env);
 assert.equal(r.status,200);
 const payload=await r.json();
 assert.ok(payload.result.tools.some(t=>t.name==="agentz_enqueue_probe"));
 assert.ok(payload.result.tools.some(t=>t.name==="agentz_memory_recent"));
 assert.ok(!payload.result.tools.some(t=>t.name==="agentz_public_fetch"));
});

test("signed Cloudflare Access identity can read tools but cannot queue work",async()=>{
 const keys=await webcrypto.subtle.generateKey({name:"RSASSA-PKCS1-v1_5",modulusLength:2048,publicExponent:new Uint8Array([1,0,1]),hash:"SHA-256"},true,["sign","verify"]);
 const jwk=await webcrypto.subtle.exportKey("jwk",keys.publicKey);
 jwk.kid="test-key";
 const now=Math.floor(Date.now()/1000);
 const enc=v=>Buffer.from(JSON.stringify(v)).toString("base64url");
 const payload={iss:"https://test-team.cloudflareaccess.com",aud:["expected-audience"],email:"founder@example.com",sub:"founder-id",iat:now,exp:now+300};
 const signingInput=enc({alg:"RS256",kid:"test-key"})+"."+enc(payload);
 const signature=Buffer.from(await webcrypto.subtle.sign("RSASSA-PKCS1-v1_5",keys.privateKey,new TextEncoder().encode(signingInput))).toString("base64url");
 const assertion=signingInput+"."+signature;
 const accessEnv={...env,AGENTZ_ACCESS_ISSUER:payload.iss,AGENTZ_ACCESS_AUD:"expected-audience",AGENTZ_ACCESS_OWNER_EMAIL:"founder@example.com"};
 const oldFetch=globalThis.fetch;
 globalThis.fetch=async url=>{
  assert.equal(url,"https://test-team.cloudflareaccess.com/cdn-cgi/access/certs");
  return {ok:true,json:async()=>({keys:[jwk]})};
 };
 try{
  const invoke=async(name)=>{
   const r=await worker.fetch(new Request("https://agentz.internal/mcp",{method:"POST",headers:{"Cf-Access-Jwt-Assertion":assertion,"content-type":"application/json"},body:JSON.stringify({jsonrpc:"2.0",id:1,method:name==="list"?"tools/list":"tools/call",params:name==="list"?undefined:{name,arguments:{target:"https://github.com/undone0603/authichain-unified"}}})}),accessEnv);
   assert.equal(r.status,200);
   return r.json();
  };
  const listing=await invoke("list");
  assert.ok(listing.result.tools.some(t=>t.name==="agentz_readiness"));
  assert.ok(!listing.result.tools.some(t=>t.name==="agentz_enqueue_probe"));
  const rejection=await invoke("agentz_enqueue_probe");
  assert.equal(rejection.error.code,-32001);
  const readiness=await invoke("agentz_readiness");
  assert.match(readiness.result.content[0].text,/"production_dispatch":false/);
  const forged=await worker.fetch(new Request("https://agentz.internal/mcp",{method:"POST",headers:{"Cf-Access-Jwt-Assertion":assertion+"bogus"}}),accessEnv);
  assert.equal(forged.status,401);
 }finally{globalThis.fetch=oldFetch}
});
