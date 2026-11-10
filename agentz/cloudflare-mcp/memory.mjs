// Bounded, read-only task execution. No arbitrary shell, deployment or payment operations.
const validTarget = (s) => {
  if (typeof s !== "string" || s.length > 1024) throw Error("invalid target");
  const u = new URL(s);
  if (u.protocol !== "https:" || u.username || u.password || u.port || u.hash) throw Error("invalid HTTPS target");
  // Fixed public domain prevents private-address SSRF and redirect pivoting.
  if (u.hostname !== "github.com" || !/^\/(undone0603\/authichain-unified)(\/|$)/.test(u.pathname)) throw Error("target not allowlisted");
  return u.toString();
};
const safe = (s,n=400) => String(s ?? "").slice(0,n);
export async function enqueue(env, args) {
  if (!env.AGENTZ_DB) throw Error("D1 not configured");
  const target=validTarget(args?.target);
  const priority=Number.isInteger(args?.priority)?args.priority:50;
  if(priority<0||priority>100)throw Error("priority out of range");
  const id=crypto.randomUUID();
  await env.AGENTZ_DB.prepare("INSERT INTO agentz_tasks(id,kind,target,priority) VALUES (?,'public_probe',?,?)").bind(id,target,priority).run();
  return {id,status:"pending",target,priority};
}
export async function recent(env,args){
  if(!env.AGENTZ_DB)throw Error("D1 not configured");
  const limit=Math.min(30,Math.max(1,Number.isInteger(args?.limit)?args.limit:10));
  const tasks=await env.AGENTZ_DB.prepare("SELECT id,kind,target,priority,status,attempts,created_at,updated_at,last_error FROM agentz_tasks ORDER BY created_at DESC LIMIT ?").bind(limit).all();
  const learnings=await env.AGENTZ_DB.prepare("SELECT task_kind,fingerprint,outcome,strategy,observation,created_at FROM agentz_learnings ORDER BY id DESC LIMIT ?").bind(limit).all();
  return {tasks:tasks.results,learnings:learnings.results};
}
export async function runQueue(env, max=3){
 if(!env.AGENTZ_DB) return {processed:0,reason:"D1 not configured"};
 let processed=0;
 for(let i=0;i<Math.min(max,3);i++){
  const now=new Date().toISOString().replace('T',' ').replace('Z','').slice(0,19);
  const row=await env.AGENTZ_DB.prepare("SELECT id,target,attempts FROM agentz_tasks WHERE status='pending' AND next_run_at <= ? ORDER BY priority DESC,created_at ASC LIMIT 1").bind(now).first();
  if(!row)break;
  const claim=await env.AGENTZ_DB.prepare("UPDATE agentz_tasks SET status='running',attempts=attempts+1,updated_at=? WHERE id=? AND status='pending'").bind(now,row.id).run();
  if(!claim.meta?.changes)continue;
  let outcome="success",detail="",evidenceUrl=null;
  try{
   const target=validTarget(row.target);
   const controller=new AbortController();
   // Cloudflare fetch has no arbitrary redirect following; target is pinned to GitHub.
   const response=await fetch(target,{method:"GET",redirect:"manual",signal:controller.signal,headers:{"accept":"text/html"}});
   if(response.body)await response.body.cancel();
   if(response.status>=300&&response.status<400)throw Error("redirect refused");
   if(!response.ok)throw Error("HTTP "+response.status);
   detail="GitHub public endpoint responded HTTP "+response.status;
   evidenceUrl=target;
  }catch(e){outcome="failure";detail=safe(e.message);}
  const status=outcome==="success"?"succeeded":row.attempts+1>=3?"failed":"pending";
  const nextRun=new Date(Date.now()+Math.min(60,5*(row.attempts+1))*60000).toISOString().replace('T',' ').replace('Z','').slice(0,19);
  await env.AGENTZ_DB.batch([
   env.AGENTZ_DB.prepare("UPDATE agentz_tasks SET status=?,updated_at=?,next_run_at=?,last_error=? WHERE id=?").bind(status,new Date().toISOString().replace('T',' ').replace('Z','').slice(0,19),nextRun,outcome==="failure"?detail:null,row.id),
   env.AGENTZ_DB.prepare("INSERT INTO agentz_task_events(task_id,event_type,outcome,evidence_url,detail) VALUES (?,'public_probe',?,?,?)").bind(row.id,outcome,evidenceUrl,detail)
  ]);
  const event=await env.AGENTZ_DB.prepare("SELECT id FROM agentz_task_events WHERE task_id=? ORDER BY id DESC LIMIT 1").bind(row.id).first();
  if(event)await env.AGENTZ_DB.prepare("INSERT INTO agentz_learnings(task_kind,fingerprint,outcome,strategy,observation,source_event_id) VALUES ('public_probe',?,?,'fixed-github-read-only',?,?)").bind(row.target,outcome,detail,event.id).run();
  processed++;
 }
 return {processed};
}
