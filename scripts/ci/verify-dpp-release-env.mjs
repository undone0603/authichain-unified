#!/usr/bin/env node
/** Fail-closed read-only GitHub environment policy probe. */
import {pathToFileURL} from "node:url";
export const REPO = "undone0603/authichain-unified";
export const ENV = "production-supabase";
export function assertPolicy(env) {
  if(env?.name!==ENV || env?.deployment_branch_policy?.protected_branches!==true ||
     env?.deployment_branch_policy?.custom_branch_policies!==false ||
     !Array.isArray(env?.protection_rules))
    throw new Error("Protected production-supabase environment is missing or unrestricted");
  return true;
}
export async function verifyEnvironment({token,repo=REPO,fetchImpl=fetch}) {
  if(!token||repo!==REPO)throw new Error("Missing GitHub identity");
  const res=await fetchImpl("https://api.github.com/repos/"+REPO+"/environments/"+ENV,{
    headers:{Authorization:"Bearer "+token,Accept:"application/vnd.github+json",
             "X-GitHub-Api-Version":"2022-11-28"}
  });
  if(!res.ok)throw new Error("Protected environment read HTTP "+res.status);
  assertPolicy(await res.json());
  return ENV;
}
if(process.argv[1] && import.meta.url===pathToFileURL(process.argv[1]).href){
  verifyEnvironment({token:process.env.GH_TOKEN,repo:process.env.REPOSITORY})
    .then(()=>console.log("Protected production-supabase environment verified"))
    .catch(err=>{console.error("::error::"+err.message);process.exitCode=1});
}
