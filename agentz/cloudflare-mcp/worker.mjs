import {enqueue,recent,runQueue} from "./memory.mjs";
/** AgentZ Cloudflare edge MCP gateway, read-only foundation.
 * No secrets or privileged GitHub operations are exposed.
 * Configure AGENTZ_MCP_TOKEN as a Worker secret before deployment.
 */
const TOOLS = [
  {name:"agentz_enqueue_probe",description:"Queue a bounded public GitHub repository inspection",inputSchema:{type:"object",properties:{target:{type:"string"},priority:{type:"integer"}},required:["target"],additionalProperties:false}},
  {name:"agentz_memory_recent",description:"Read recent task outcomes and learned observations",inputSchema:{type:"object",properties:{limit:{type:"integer"}},additionalProperties:false}},
  {name:"agentz_readiness",description:"Check the read-only AgentZ Cloudflare gateway",inputSchema:{type:"object",properties:{},additionalProperties:false}},
];
const json=(obj,status=200)=>new Response(JSON.stringify(obj),{status,headers:{"content-type":"application/json","cache-control":"no-store"}});
async function schedulerState(env){
 const state={scheduler_ready:false,task_registered:false,task_executed:false,task_verified:false};
 if(!env.AGENTZ_DB)return state;
 try{
  await Promise.all([
   env.AGENTZ_DB.prepare("SELECT id,kind,target,priority,status,attempts,created_at,updated_at,next_run_at,last_error,max_attempts,authorization_class,expires_at,lease_expires_at,lease_token,completed_at FROM agentz_tasks LIMIT 0").all(),
   env.AGENTZ_DB.prepare("SELECT id,task_id,event_type,outcome,evidence_url,detail,created_at,event_key FROM agentz_task_events LIMIT 0").all(),
   env.AGENTZ_DB.prepare("SELECT id,task_kind,fingerprint,outcome,strategy,observation,source_event_id,created_at FROM agentz_learnings LIMIT 0").all()
  ]);
  state.scheduler_ready=true;
  const result=await env.AGENTZ_DB.prepare("SELECT EXISTS(SELECT 1 FROM agentz_tasks) AS task_registered,EXISTS(SELECT 1 FROM agentz_task_events WHERE event_type='public_probe' AND event_key IS NOT NULL) AS task_executed,EXISTS(SELECT 1 FROM agentz_tasks t JOIN agentz_task_events e ON e.task_id=t.id AND e.event_key='task:'||t.id||':'||t.attempts WHERE t.status='succeeded' AND t.completed_at IS NOT NULL AND e.outcome='success' AND e.evidence_url IS NOT NULL) AS task_verified").first();
  state.task_registered=Number(result?.task_registered)===1;
  state.task_executed=Number(result?.task_executed)===1;
  state.task_verified=Number(result?.task_verified)===1;
 }catch(error){
  console.warn("AgentZ scheduler readiness check failed",String(error?.name||"error"));
  state.scheduler_ready=false;
  state.task_registered=false;
  state.task_executed=false;
  state.task_verified=false;
 }
 return state;
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
 async scheduled(event,env,ctx){
  const execution=runQueue(env,3).then(result=>{
   console.log("AgentZ queue tick result",JSON.stringify({scheduledTime:event.scheduledTime,...result}));
   if(result.failed_retryable||result.failed_terminal)throw new Error("AgentZ queue completed with task failures");
  }).catch(error=>{
   console.error("AgentZ queue tick failed",String(error?.name||"error"));
   throw error;
  });
  ctx.waitUntil(execution);
 },
 async fetch(request,env){
  if(request.method==="POST"&&new URL(request.url).pathname==="/internal/cron"){
   if(!env.AGENTZ_DISPATCH_TOKEN)return json({error:"not configured"},503);
   const bearer=(request.headers.get("authorization")||"").replace(/^Bearer /i,"");
   if(!bearer||!(await equalSecret(bearer,env.AGENTZ_DISPATCH_TOKEN)))return json({error:"unauthorized"},401);
   if(request.headers.get("x-agentz-dispatch")!=="authichain-automation")return json({error:"invalid dispatcher"},403);
   try {
    const execution=await runQueue(env,3);
    const failed=execution.failed_retryable||execution.failed_terminal;
    return json({service:"agentz-mcp-edge",...execution},failed?503:200);
   } catch(error) {
    console.error("AgentZ internal dispatch failed",String(error?.name||"error"));
    return json({error:"dispatch unavailable"},503);
   }
  }
  if(request.method==="GET"&&new URL(request.url).pathname==="/health"){
   const state=await schedulerState(env);
   return json({service:"agentz-mcp-edge",status:"up",api_alive:true,scheduler_ready:state.scheduler_ready,authenticated_tools:Boolean(env.AGENTZ_MCP_TOKEN)});
  }
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
  if(name==="agentz_readiness"){
   const state=await schedulerState(env);
   return result({content:[{type:"text",text:JSON.stringify({api_alive:true,...state,browser_inspect:false,code_write:false,production_dispatch:false})}]});
  }
  return error(-32602,"unknown tool");
 }
};
