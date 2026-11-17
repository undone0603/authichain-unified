#!/usr/bin/env node
import {pathToFileURL} from "node:url";
export const PINS = Object.freeze([
  "RUNTIME_ATTESTATION_KEY","RUNTIME_EXPECTED_DB_SYSTEM_IDENTIFIER",
  "RUNTIME_EXPECTED_DATABASE_NAME","RUNTIME_EXPECTED_SUPABASE_PROJECT_REF",
  "AUTHICHAIN_DEPLOYED_SHA"
]);
export function assertInstalledPins(bindings) {
  if(!Array.isArray(bindings)) throw Error("Worker binding inventory unavailable");
  for(const name of PINS) {
    if(!bindings.some(b=>b?.name===name && b?.type==="secret_text"))
      throw Error("protected runtime pin missing or not secret_text: "+name);
  }
  return PINS.length;
}
export async function inspectWorkerPins({accountId,token,fetchImpl=fetch}) {
  if(!/^[0-9a-f]{32}$/.test(accountId||"") || !token) throw Error("protected Cloudflare identity unavailable");
  const u="https://api.cloudflare.com/client/v4/accounts/"+accountId+"/workers/scripts/authichain-app/settings";
  const response=await fetchImpl(u,{method:"GET",headers:{Authorization:"Bearer "+token}});
  if(!response.ok) throw Error("Cloudflare read-only Worker settings unavailable");
  const body=await response.json();
  if(body?.success!==true) throw Error("Cloudflare Worker settings verification failed");
  return assertInstalledPins(body?.result?.bindings);
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  inspectWorkerPins({accountId:process.env.CLOUDFLARE_ACCOUNT_ID,token:process.env.CLOUDFLARE_API_TOKEN})
  .then(()=>console.log("All protected attestation pin bindings are present (values opaque; live proof pending)"))
  .catch(e=>{console.error("::error::"+e.message);process.exitCode=1});
}
