import test from "node:test";
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import {stripTypeScriptTypes} from "node:module";
import vm from "node:vm";

const source=readFileSync(new URL("./src/mcp-modern-discovery.ts", import.meta.url),"utf8");
const executable=stripTypeScriptTypes(source,{mode:"strip"})
  .replace(/^export\s+(?=function|const)/gm,"");
const context=vm.createContext({Request,Response,URL});
vm.runInContext(executable+"\nthis.handler=handleModernMcpDiscovery;",context,{timeout:1500,filename:"mcp-modern-discovery.ts"});
const handler=context.handler;
function msg(method="tools/list",id=1,version="2026-07-28"){
 return {jsonrpc:"2.0",id,method,params:{_meta:{
 "io.modelcontextprotocol/protocolVersion":version,
 "io.modelcontextprotocol/clientInfo":{name:"offline-test",version:"0.1"},
 "io.modelcontextprotocol/clientCapabilities":{}
 }}};
}
const headers=(method="tools/list",version="2026-07-28")=>({
 "Content-Type":"application/json","MCP-Protocol-Version":version,"Mcp-Method":method
});
async function run(body,requestHeaders=headers()){
 const request=new Request("https://authichain.com/mcp",{method:"POST",headers:requestHeaders,body:JSON.stringify(body)});
 const response=handler(request,body,()=>[{name:"verify_record",inputSchema:{type:"object"}}]);
 return response?{http:response.status,payload:await response.json(),header:response.headers.get("MCP-Protocol-Version")}:null;
}
test("modern list returns completed JSON-RPC result",async()=>{
 const r=await run(msg());assert.equal(r.http,200);assert.equal(r.payload.result.resultType,"complete");
 assert.equal(r.payload.result.ttlMs,0);assert.equal(r.payload.result.cacheScope,"private");
 assert.equal(r.payload.result.tools[0].name,"verify_record");assert.equal(r.header,"2026-07-28");
});
test("cache hints are conservative for all modern tool lists",async()=>{
 for(const id of [1,2,50]){
   const r=await run(msg("tools/list",id));
   assert.equal(r.payload.result.resultType,"complete");
   assert.equal(r.payload.result.ttlMs,0);
   assert.equal(r.payload.result.cacheScope,"private");
 }
});
test("legacy initialize remains in legacy dispatcher",async()=>{
 const b=msg("initialize",2,"2025-06-18");const r=await run(b,{"MCP-Protocol-Version":"2025-06-18"});
 assert.equal(r,null);
});
test("no tools/call can pass modern read-only adapter",async()=>{
 const r=await run(msg("tools/call",3),headers("tools/call"));assert.equal(r.http,404);
 assert.equal(r.payload.error.code,-32601);
});
test("method header mismatch rejected",async()=>{
 const r=await run(msg(),headers("tools/call"));assert.equal(r.http,400);assert.equal(r.payload.error.code,-32020);
});
test("version header mismatch rejected",async()=>{
 const r=await run(msg(),headers("tools/list","2025-06-18"));assert.equal(r.http,400);assert.equal(r.payload.error.code,-32020);
});
test("unsupported version advertises modern supported revision",async()=>{
 const r=await run(msg("tools/list",1,"2027-01-01"),headers("tools/list","2027-01-01"));assert.equal(r.http,400);
 assert.equal(r.payload.error.code,-32022);assert.equal(r.payload.error.data.supported[0],"2026-07-28");
});
test("missing version header is rejected for modern methods",async()=>{
 const r=await run(msg(),{"Mcp-Method":"tools/list"});assert.equal(r.http,400);assert.equal(r.payload.error.code,-32020);
});
test("origin mismatch is forbidden",async()=>{
 const r=await run(msg(),{...headers(),Origin:"https://untrusted.invalid"});assert.equal(r.http,403);
});
test("client capabilities are required",async()=>{
 const b=msg();delete b.params._meta["io.modelcontextprotocol/clientCapabilities"];
 const r=await run(b);assert.equal(r.http,400);assert.equal(r.payload.error.code,-32602);
});
test("modern notifications are not treated as successful work",async()=>{
 const b=msg("notifications/initialized",10);const r=await run(b,headers("notifications/initialized"));
 assert.equal(r.http,404);
});
test("missing JSON-RPC id is rejected",async()=>{
 const b=msg();delete b.id;const r=await run(b);assert.equal(r.http,400);
});
test("no credentials or network are required for adapter",async()=>{
 const r=await run(msg());assert.equal(r.http,200);assert.equal(r.payload.jsonrpc,"2.0");
});
