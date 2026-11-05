/**
 * Public, stateless negotiation planning endpoint. No paid calls or commitments.
 * GET /negotiate: schema + examples. POST /negotiate: proposals only.
 */
import {evaluateNegotiation, NegotiationInputError} from "./negotiation-engine.mjs";
const MAX_BYTES=16*1024;
const HEADERS={
  "Content-Type":"application/json; charset=utf-8",
  "Cache-Control":"no-store",
  "X-Content-Type-Options":"nosniff",
  "Content-Security-Policy":"default-src 'none'",
};
const response=(status:number,body:unknown)=>new Response(JSON.stringify(body),{status,headers:HEADERS});
async function boundedInput(request:Request):Promise<unknown> {
  if (!request.body) throw new NegotiationInputError("request body required");
  const len=Number(request.headers.get("content-length")||"0");
  if (len>MAX_BYTES) throw new NegotiationInputError("negotiation payload exceeds 16 KiB");
  const reader=request.body.getReader();
  let bytes=0;
  const chunks:Uint8Array[]=[];
  while (true) {
    const part=await reader.read();
    if(part.done)break;
    bytes+=part.value.byteLength;
    if(bytes>MAX_BYTES) {
      await reader.cancel();
      throw new NegotiationInputError("negotiation payload exceeds 16 KiB");
    }
    chunks.push(part.value);
  }
  const joined=new Uint8Array(bytes);
  let offset=0;
  for(const chunk of chunks) {joined.set(chunk,offset);offset+=chunk.length;}
  try{return JSON.parse(new TextDecoder().decode(joined));}
  catch{throw new NegotiationInputError("valid JSON object required");}
}
export function negotiateDiscovery(){
  return {
    schema:"authichain-negotiate-discovery/0.1",
    status:"stateless_proposals_only",
    mcpTool:"negotiate",
    http:{method:"POST",url:"https://authichain.com/negotiate"},
    a2a:{agentCard:"https://authichain.com/.well-known/agent-card.json",version:"1.0",interaction:"SendMessage describes use; structured proposals use HTTP or MCP"},
    example:{
      objective:"Find fair replacement-part terms; do not purchase",
      issues:[
        {key:"price_usd",direction:"minimize",target:80,walkAway:120,weight:5,unit:"USD"},
        {key:"delivery_days",direction:"minimize",target:2,walkAway:10,weight:4,unit:"days"},
        {key:"warranty_months",direction:"maximize",target:24,walkAway:6,weight:2,unit:"months"},
      ],
    },
    boundaries:{authorization:false,externalMessages:false,payment:false,orders:false,signatures:false,trustGrant:false},
    note:"Compatibility scores use caller-entered claims only; obtain written permission before any action.",
  };
}
export async function tryHandleNegotiate(request:Request):Promise<Response|null> {
  const u=new URL(request.url);
  if(u.pathname!=="/negotiate"&&u.pathname!=="/api/negotiate")return null;
  if(request.method==="GET")return response(200,negotiateDiscovery());
  if(request.method!=="POST")return new Response(JSON.stringify({error:"method_not_allowed"}),{status:405,headers:{...HEADERS,Allow:"GET, POST"}});
  const origin=request.headers.get("Origin");
  if(origin&&origin!==u.origin)return response(403,{error:"cross_origin_submission_not_permitted"});
  if(!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type")??""))
    return response(415,{error:"application_json_required"});
  try {
    const input=await boundedInput(request);
    return response(200,evaluateNegotiation(input));
  }catch(e) {
    if(e instanceof NegotiationInputError)return response(422,{error:"invalid_negotiation_input",detail:e.message});
    return response(500,{error:"negotiation_unavailable"});
  }
}
