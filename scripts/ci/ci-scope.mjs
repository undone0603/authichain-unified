#!/usr/bin/env node
// Fail-closed CI scope. Decides whether a CircleCI task can skip on a PR.
//   - quality, protected main, and unknown metadata always run full.
//   - archive/changelog-only diffs skip every scoped task.
//   - AgentZ-only diffs skip the AuthiChain tasks.
//   - AuthiChain-app-only diffs skip the AgentZ task.
// Anything that is not clearly one product's runs both. Errors run full.
import { execFileSync } from "node:child_process";
export const AUTHICHAIN_TASKS=new Set(["test-workers","test-other","build","extras",
 "typecheck-ratchet","runtime-db-attestation-postgres"]);
export const AGENTZ_TASKS=new Set(["agentz"]);
const TASKS=new Set([...AUTHICHAIN_TASKS,...AGENTZ_TASKS]);
const SHA=/^[a-f0-9]{40}$/;
// Owned by AgentZ and read by no AuthiChain job (vitest, tsconfig, pnpm
// workspace and next build all exclude them).
const AGENTZ_ROOTS=["agentz/","docs/agentz/","docs/technical-reference/docs-agentz/"];
const AGENTZ_FILES=new Set(["requirements-agentz.txt","pyproject.toml"]);
// AuthiChain app roots that AgentZ code and tests never read. workers/,
// protocol/, scripts/, docs/ and root config are read by AgentZ, so they
// are deliberately absent. Any path naming agentz is the contract between
// the products (webhook, status route, supervisor) and runs both.
const APP_ROOTS=["src/","server/","client/","shared/","public/","apps/",
 "packages/","supabase/","mobile/","api/","worker-app/"];
const canonical=p=>typeof p==="string"&&p.length>0&&!p.startsWith("/")&&
 !p.includes("\\")&&!p.split("/").includes("..");
const archivePath=p=>(p.startsWith("docs/archive/")&&p.length>"docs/archive/".length)||
 /(?:^|\/)CHANGELOG\.md$/.test(p);
const every=(paths,ok)=>Array.isArray(paths)&&paths.length>0&&
 paths.every(p=>canonical(p)&&ok(p));
export function isArchiveOnly(paths) {
 return every(paths,archivePath);
}
export function isAgentzOnly(paths) {
 return every(paths,p=>archivePath(p)||AGENTZ_FILES.has(p)||
  AGENTZ_ROOTS.some(r=>p.startsWith(r)&&p.length>r.length));
}
export function isAuthichainAppOnly(paths) {
 return every(paths,p=>archivePath(p)||(!/agentz/i.test(p)&&
  APP_ROOTS.some(r=>p.startsWith(r)&&p.length>r.length)));
}
export function decide(task,branch,sha,paths) {
 if(!TASKS.has(task)||!branch||branch==="main"||!SHA.test(sha||""))return "full";
 if(isArchiveOnly(paths))return "skip";
 if(AUTHICHAIN_TASKS.has(task)&&isAgentzOnly(paths))return "skip";
 if(AGENTZ_TASKS.has(task)&&isAuthichainAppOnly(paths))return "skip";
 return "full";
}
function git(...args) {
 return execFileSync("git",args,{encoding:"utf8",timeout:12000,
  maxBuffer:8388608,stdio:["ignore","pipe","ignore"]}).trim();
}
export function inspect(task,env=process.env) {
 if(!TASKS.has(task)||!env.CIRCLE_BRANCH||env.CIRCLE_BRANCH==="main"||
    !SHA.test(env.CIRCLE_SHA1||""))return "full";
 try {
  if(git("rev-parse","HEAD")!==env.CIRCLE_SHA1)return "full";
  git("fetch","--quiet","--no-tags","--depth=250","origin","main");
  const base=git("merge-base","HEAD","FETCH_HEAD");
  if(!SHA.test(base))return "full";
  const changed=execFileSync("git",["diff","--no-renames","--name-only","-z",base,"HEAD"],
   {encoding:"utf8",timeout:12000,maxBuffer:8388608,stdio:["ignore","pipe","ignore"]});
  return decide(task,env.CIRCLE_BRANCH,env.CIRCLE_SHA1,changed.split("\0").filter(Boolean));
 } catch {return "full";}
}
if(process.argv[1]?.endsWith("/ci-scope.mjs"))
 process.stdout.write(inspect(process.argv[2])+"\n");
