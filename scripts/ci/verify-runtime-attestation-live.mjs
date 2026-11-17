#!/usr/bin/env node
import {pathToFileURL} from "node:url";
const SHA=/^[a-f0-9]{40}$/;
const HASH=/^sha256:[a-f0-9]{20}$/;
const allowedHosts=new Set(["app.authichain.com","qron.space","authichain.com"]);
export function validateEndpoint(raw) {
  const url=new URL(raw);
  if(url.protocol!=="https:" || !allowedHosts.has(url.hostname) || url.port ||
     url.username || url.password || url.pathname!=="/api/internal/runtime-db-attestation" ||
     url.search || url.hash) throw Error("attestation URL is not a permitted HTTPS endpoint");
  return url.toString();
}
export function assertAttestationResult(body,sha){
  if(!SHA.test(sha||"")||body?.verified!==true||body?.deployedVersion!==sha)
    throw Error("runtime attestation version or verified state mismatched");
  const a=body?.connections?.databaseUrl,b=body?.connections?.webhookSupabase;
  if(a?.verified!==true || b?.verified!==true || a?.path!=="postgres-js:getDb" ||
     b?.path!=="stripe-webhook:supabase-js" || !HASH.test(a?.identity||"") ||
     a.identity!==b.identity) throw Error("real database connection identities not independently equal");
  const t=Date.parse(body.checkedAt||"");
  if(!Number.isFinite(t)||Math.abs(Date.now()-t)>10*60*1000)
    throw Error("runtime attestation evidence missing or stale");
  return true;
}
export async function inspectLive({url,token,sha,fetchImpl=fetch}) {
  const target=validateEndpoint(url);
  if(!token || token.length<32 || !SHA.test(sha||"")) throw Error("missing protected attestation identity");
  const response=await fetchImpl(target,{method:"GET",headers:{Authorization:"Bearer "+token,Accept:"application/json"},redirect:"error",cache:"no-store"});
  if(response.status!==200) throw Error("authenticated runtime attestation did not return 200");
  const body=await response.json();
  return assertAttestationResult(body,sha);
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  inspectLive({url:process.env.RUNTIME_ATTESTATION_URL,token:process.env.RUNTIME_ATTESTATION_KEY,sha:process.env.EXPECTED_SHA})
  .then(()=>console.log("Runtime verified: exact deployment SHA and both live database paths match"))
  .catch(e=>{console.error("::error::"+e.message);process.exitCode=1});
}
