#!/usr/bin/env node
// Fail-closed archive-only scope; security/quality and protected main run full.
import { execFileSync } from "node:child_process";
const TASKS=new Set(["test-workers","test-other","build","extras","typecheck-ratchet"]);
const SHA=/^[a-f0-9]{40}$/;
export function isArchiveOnly(paths) {
 return Array.isArray(paths)&&paths.length>0&&paths.every(p=>
  typeof p==="string"&&p.length>0&&!p.startsWith("/")&&!p.includes("\\")&&
  !p.split("/").includes("..")&&
  ((p.startsWith("docs/archive/")&&p.length>"docs/archive/".length)||
   /(?:^|\/)CHANGELOG\.md$/.test(p)));
}
export function decide(task,branch,sha,paths) {
 return TASKS.has(task)&&branch&&branch!=="main"&&SHA.test(sha||"")&&
  isArchiveOnly(paths)?"skip":"full";
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
