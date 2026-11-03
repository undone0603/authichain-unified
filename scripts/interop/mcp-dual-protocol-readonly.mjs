#!/usr/bin/env node
// Read-only, zero-credential A2A/MCP transport diagnostic. No tools/call or payments.
const endpoint = process.env.MCP_URL || "https://authichain.com/mcp";
const out = [];
async function probe(label, headers, body) {
  const r = await fetch(endpoint, {method:"POST",redirect:"manual",headers:{"Content-Type":"application/json","Accept":"application/json, text/event-stream",...headers},body:JSON.stringify(body),signal:AbortSignal.timeout(12000)});
  const raw = await r.text();
  let data; try { data=JSON.parse(raw); } catch {data={parse_error:true};}
  const result={label,http:r.status,version:r.headers.get("mcp-protocol-version"),resultType:data?.result?.resultType??null,tools:Array.isArray(data?.result?.tools)?data.result.tools.map(x=>x.name):[],error:data?.error??null,redirect:r.status>=300&&r.status<400};
  out.push(result);return result;
}
const modern={"MCP-Protocol-Version":"2026-07-28","Mcp-Method":"tools/list"};
const legacy={"MCP-Protocol-Version":"2025-06-18"};
try {
  await probe("modern-tools-list",modern,{jsonrpc:"2.0",id:1,method:"tools/list",params:{_meta:{"io.modelcontextprotocol/protocolVersion":"2026-07-28"}}});
  await probe("legacy-initialize",legacy,{jsonrpc:"2.0",id:2,method:"initialize",params:{protocolVersion:"2025-06-18",capabilities:{},clientInfo:{name:"authichain-independent-probe",version:"0.1"}}});
  await probe("legacy-tools-list",legacy,{jsonrpc:"2.0",id:3,method:"tools/list",params:{}});
  console.log(JSON.stringify({endpoint,observations:out,modern_pass:out[0].http===200&&out[0].resultType==="complete"&&out[0].tools.length>0,legacy_pass:out[1].http===200&&out[2].http===200&&out[2].tools.length>0},null,2));
  if(!(out[0].http===200&&out[0].resultType==="complete"&&out[0].tools.length>0&&out[1].http===200&&out[2].http===200))process.exitCode=1;
} catch(e) {console.error(JSON.stringify({transport_error:String(e),observations:out}));process.exitCode=2;}
