import test from "node:test";
import assert from "node:assert/strict";
import worker from "./worker.mjs";

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
