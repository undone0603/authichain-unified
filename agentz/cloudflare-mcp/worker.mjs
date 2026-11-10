import {enqueue,recent,runQueue} from "./memory.mjs";
/** AgentZ Cloudflare edge MCP gateway, read-only foundation.
 * No secrets or privileged GitHub operations are exposed.
 * Configure AGENTZ_MCP_TOKEN as a Worker secret before deployment.
 */
const TOOLS = [
  {name:"agentz_enqueue_probe",description:"Queue a bounded public GitHub repository inspection",inputSchema:{type:"object",properties:{target:{type:"string"},priority:{type:"integer"}},required:["target"],additionalProperties:false}},
  {name:"agentz_memory_recent",description:"Read recent task outcomes and learned observations",inputSchema:{type:"object",properties:{limit:{type:"integer"}},additionalProperties:false}},
  {name:"agentz_readiness",description:"Check the read-only AgentZ Cloudflare gateway",inputSchema:{type:"object",properties:{},additionalProperties:false}},
  {name:"agentz_public_fetch",description:"Fetch a bounded public HTTPS page as untrusted text",inputSchema:{type:"object",properties:{url:{type:"string"}},required:["url"],additionalProperties:false}},
];
const json=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
function publicUrl(raw) {
  const u=new URL(raw);
  if(u.protocol!=="https:"||u.username||u.password||u.port)throw Error("HTTPS only");
  const host=u.hostname.toLowerCase();
  if(host==="localhost"||host.endsWith(".localhost")||host.endsWith(".internal")||host.endsWith(".local"))throw Error("private host");
  if(!/^[a-z0-9.-]+$/.test(host)||!host.includes("."))throw Error("invalid hostname");
  if(/^[0-9.]+$/.test(host)||host.includes(".."))throw Error("IP literal forbidden");
  return u;
}
async function equalSecret(a,b){
  const enc=new TextEncoder();
  const key=await crypto.subtle.importKey("raw",enc.encode("agentz-mcp-auth"),{name:"HMAC",hash:"SHA-256"},false,["sign"]);
  const [x,y]=await Promise.all([crypto.subtle.sign("HMAC",key,enc.encode(a)),crypto.subtle.sign("HMAC",key,enc.encode(b))]);
  const aa=new Uint8Array(x),bb=new Uint8Array(y);let diff=0;
  for(let i=0;i<aa.length;i++)diff|=aa[i]^bb[i];
  return diff===0;
}
export default {
 async scheduled(event,env,ctx){ctx.waitUntil(runQueue(env,3));},
 async fetch(request,env){
  if(request.method==="GET"&&new URL(request.url).pathname==="/health")return json({service:"agentz-mcp-edge",status:"up",authenticated_tools:true});
  if(!env.AGENTZ_MCP_TOKEN)return json({error:"not configured"},503);
  const supplied=(request.headers.get("authorization")||"").replace(/^Bearer /i,"");
  if(!supplied||!(await equalSecret(supplied,env.AGENTZ_MCP_TOKEN)))return json({error:"unauthorized"},401);
  if(request.method!=="POST"||new URL(request.url).pathname!=="/mcp")return json({error:"not found"},404);
  let call;try{call=await request.json()}catch{return json({error:"invalid JSON"},400)}
  if(call?.jsonrpc!=="2.0"||typeof call.method!=="string")return json({error:"invalid JSON-RPC"},400);
  const result=(value)=>json({jsonrpc:"2.0",id:call.id??null,result:value});
  const error=(code,message)=>json({jsonrpc:"2.0",id:call.id??null,error:{code,message}});
  if(call.method==="initialize")return result({protocolVersion:"2025-03-26",capabilities:{tools:{}},serverInfo:{name:"agentz-cloudflare-edge",version:"0.1.0"}});
  if(call.method==="notifications/initialized")return new Response(null,{status:202});
  if(call.method==="tools/list")return result({tools:TOOLS});
  if(call.method!=="tools/call")return error(-32601,"method not found");
  const name=call.params?.name;
  if(name==="agentz_enqueue_probe"||name==="agentz_memory_recent"){
   try {const value=name==="agentz_enqueue_probe"?await enqueue(env,call.params?.arguments):await recent(env,call.params?.arguments);return result({content:[{type:"text",text:JSON.stringify(value)}]})}
   catch(e){return error(-32000,String(e.message).slice(0,200))}
  }
  if(name==="agentz_readiness")return result({content:[{type:"text",text:JSON.stringify({cloudflare_edge:true,browser_inspect:false,code_write:false,production_dispatch:false})}]});
  if(name==="agentz_public_fetch"){
   try{
    const url=publicUrl(call.params?.arguments?.url);
    // Redirects are disabled: caller cannot steer into a private destination.
    const response=await fetch(url.toString(),{redirect:"manual",headers:{"accept":"text/plain,text/html"}});
    if(response.status>=300&&response.status<400)throw Error("redirect refused");
    if(!response.ok)throw Error("upstream status "+response.status);
    const type=response.headers.get("content-type")||"";
    if(!/text\/(html|plain)/i.test(type))throw Error("text only");
    const length=Number(response.headers.get("content-length")||0);
    if(length>32768)throw Error("response too large");
    const reader=response.body.getReader();let total=0;const chunks=[];
    while(true){const {done,value}=await reader.read();if(done)break;total+=value.length;if(total>32768){await reader.cancel();throw Error("response too large")}chunks.push(value)}
    const bytes=new Uint8Array(total);let off=0;for(const chunk of chunks){bytes.set(chunk,off);off+=chunk.length}
    return result({content:[{type:"text",text:JSON.stringify({url:url.toString(),trusted:false,body:new TextDecoder().decode(bytes)})}]});
   }catch(e){return error(-32000,String(e.message).slice(0,200))}
  }
  return error(-32602,"unknown tool");
 }
};
