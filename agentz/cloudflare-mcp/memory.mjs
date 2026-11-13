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
const MAX_QUEUE_SIZE = 3;
const LEASE_MILLISECONDS = 30000;
const TASK_TTL_MILLISECONDS = 24*60*60*1000;
const timestamp = (date = new Date()) => date.toISOString().replace("T"," ").replace("Z","").slice(0,19);

export async function enqueue(env, args) {
  if (!env.AGENTZ_DB) throw Error("D1 not configured");
  const target=validTarget(args?.target);
  const priority=Number.isInteger(args?.priority)?args.priority:50;
  if(priority<0||priority>100)throw Error("priority out of range");
  const id=crypto.randomUUID();
  const expiresAt=timestamp(new Date(Date.now()+TASK_TTL_MILLISECONDS));
  await env.AGENTZ_DB.prepare("INSERT INTO agentz_tasks(id,kind,target,priority,expires_at) VALUES (?,'public_probe',?,?,?)").bind(id,target,priority,expiresAt).run();
  return {id,status:"pending",target,priority};
}
export async function recent(env,args){
  if(!env.AGENTZ_DB)throw Error("D1 not configured");
  const limit=Math.min(30,Math.max(1,Number.isInteger(args?.limit)?args.limit:10));
  const tasks=await env.AGENTZ_DB.prepare("SELECT id,kind,target,priority,status,attempts,created_at,updated_at,expires_at,completed_at,last_error,(SELECT event_type FROM agentz_task_events WHERE task_id=agentz_tasks.id ORDER BY id DESC LIMIT 1) AS last_event_type,(SELECT outcome FROM agentz_task_events WHERE task_id=agentz_tasks.id ORDER BY id DESC LIMIT 1) AS last_event_outcome,(SELECT evidence_url FROM agentz_task_events WHERE task_id=agentz_tasks.id ORDER BY id DESC LIMIT 1) AS last_evidence_url,(SELECT detail FROM agentz_task_events WHERE task_id=agentz_tasks.id ORDER BY id DESC LIMIT 1) AS last_execution_detail FROM agentz_tasks ORDER BY created_at DESC LIMIT ?").bind(limit).all();
  const learnings=await env.AGENTZ_DB.prepare("SELECT task_kind,fingerprint,outcome,strategy,observation,created_at FROM agentz_learnings ORDER BY id DESC LIMIT ?").bind(limit).all();
  return {tasks:tasks.results,learnings:learnings.results};
}
export async function runQueue(env, max=3){
 if(!env.AGENTZ_DB) throw new Error("D1 not configured");
 const summary={processed:0,succeeded:0,failed_retryable:0,failed_terminal:0,recovered:0,skipped_expired:0};
 const db=env.AGENTZ_DB;
 const now=timestamp();
 const expiredTasks=await db.prepare("SELECT id FROM agentz_tasks WHERE status='pending' AND expires_at <= ? ORDER BY expires_at LIMIT 100").bind(now).all();
 for(const row of expiredTasks.results||[]){
  const detail="task expired before execution";
  await db.batch([
   db.prepare("UPDATE agentz_tasks SET status='failed',updated_at=?,last_error=?,completed_at=? WHERE id=? AND status='pending' AND expires_at <= ?").bind(now,detail,now,row.id,now),
   db.prepare("INSERT OR IGNORE INTO agentz_task_events(task_id,event_type,outcome,detail,event_key) SELECT id,'task_expired','skipped_policy',?,'task-expired:'||id FROM agentz_tasks WHERE id=? AND status='failed' AND updated_at=? AND last_error=?").bind(detail,row.id,now,detail)
  ]);
  const expiredEvent=await db.prepare("SELECT id FROM agentz_task_events WHERE event_key=?").bind(`task-expired:${row.id}`).first();
  if(expiredEvent)summary.skipped_expired++;
 }
 const expired=await db.prepare("SELECT id,attempts,max_attempts,expires_at FROM agentz_tasks WHERE status='running' AND lease_expires_at <= ? ORDER BY lease_expires_at LIMIT 100").bind(now).all();
 for(const row of expired.results||[]){
  const skipped=row.expires_at<=now;
  const failed=!skipped&&row.attempts>=row.max_attempts;
  const status=failed?"failed":"pending";
  const detail=skipped?"task expired during interruption":"worker lease expired";
  const nextStatus=failed||skipped?"failed":"pending";
  await db.batch([
   db.prepare("UPDATE agentz_tasks SET status=?,updated_at=?,lease_expires_at=NULL,lease_token=NULL,last_error=?,completed_at=? WHERE id=? AND status='running' AND lease_expires_at <= ?").bind(nextStatus,now,detail,failed||skipped?now:null,row.id,now),
   db.prepare("INSERT OR IGNORE INTO agentz_task_events(task_id,event_type,outcome,detail,event_key) SELECT id,'lease_recovery',?,?, 'lease-expired:'||id||':'||attempts FROM agentz_tasks WHERE id=? AND status=? AND updated_at=? AND lease_expires_at IS NULL AND last_error=?").bind(skipped?"skipped_policy":failed?"failed":"requeued",detail,row.id,nextStatus,now,detail)
  ]);
  const recoveryEvent=await db.prepare("SELECT id FROM agentz_task_events WHERE event_key=?").bind(`lease-expired:${row.id}:${row.attempts}`).first();
  if(recoveryEvent){
   summary.recovered++;
   if(failed)summary.failed_terminal++;
   if(skipped)summary.skipped_expired++;
  }
 }
 for(let i=0;i<Math.min(max,MAX_QUEUE_SIZE);i++){
  const queuedAt=timestamp();
  const row=await db.prepare("SELECT id,target,attempts,max_attempts,authorization_class FROM agentz_tasks WHERE status='pending' AND kind='public_probe' AND authorization_class='read_only_public' AND next_run_at <= ? AND expires_at > ? ORDER BY priority DESC,created_at ASC LIMIT 1").bind(queuedAt,queuedAt).first();
  if(!row)break;
  const attempt=row.attempts+1;
  const leaseToken=crypto.randomUUID();
  const leaseExpiresAt=timestamp(new Date(Date.now()+LEASE_MILLISECONDS));
  const claim=await db.prepare("UPDATE agentz_tasks SET status='running',attempts=attempts+1,updated_at=?,lease_expires_at=?,lease_token=? WHERE id=? AND status='pending' AND kind='public_probe' AND authorization_class='read_only_public'").bind(queuedAt,leaseExpiresAt,leaseToken,row.id).run();
  if(!claim.meta?.changes)continue;
  let outcome="success",detail="",evidenceUrl=null;
  try{
   const target=validTarget(row.target);
   // Abort slow upstream reads rather than occupying the hourly queue indefinitely.
   const response=await fetch(target,{method:"GET",redirect:"manual",signal:AbortSignal.timeout(8000),headers:{"accept":"text/html"}});
   if(response.body)await response.body.cancel();
   if(response.status>=300&&response.status<400)throw Error("redirect refused");
   if(!response.ok)throw Error("HTTP "+response.status);
   detail="GitHub public endpoint responded HTTP "+response.status;
   evidenceUrl=target;
  }catch(e){outcome="failure";detail=safe(e instanceof Error?e.message:e);}
  const terminal=outcome==="failure"&&attempt>=row.max_attempts;
  const status=outcome==="success"?"succeeded":terminal?"failed":"pending";
  const finishedAt=timestamp();
  const backoffMinutes=Math.min(60,5*2**Math.max(0,attempt-1));
  const nextRun=timestamp(new Date(Date.now()+backoffMinutes*60000));
  const eventKey=`task:${row.id}:${attempt}`;
  await db.batch([
   db.prepare("UPDATE agentz_tasks SET status=?,updated_at=?,next_run_at=?,last_error=?,lease_expires_at=NULL,lease_token=NULL,completed_at=? WHERE id=? AND status='running' AND lease_token=?").bind(status,finishedAt,nextRun,outcome==="failure"?detail:null,status==="pending"?null:finishedAt,row.id,leaseToken),
   db.prepare("INSERT OR IGNORE INTO agentz_task_events(task_id,event_type,outcome,evidence_url,detail,event_key) SELECT ?,'public_probe',?,?,?,? WHERE EXISTS(SELECT 1 FROM agentz_tasks WHERE id=? AND status=? AND attempts=? AND updated_at=? AND lease_token IS NULL)").bind(row.id,outcome,evidenceUrl,detail,eventKey,row.id,status,attempt,finishedAt)
  ]);
  const event=await db.prepare("SELECT id FROM agentz_task_events WHERE event_key=?").bind(eventKey).first();
  if(!event)throw new Error("task lease lost before durable completion evidence");
  await db.prepare("INSERT INTO agentz_learnings(task_kind,fingerprint,outcome,strategy,observation,source_event_id) VALUES ('public_probe',?,?,'fixed-github-read-only',?,?)").bind(row.target,outcome,detail,event.id).run();
  summary.processed++;
  if(outcome==="success")summary.succeeded++;
  else if(terminal)summary.failed_terminal++;
  else summary.failed_retryable++;
 }
 return summary;
}
