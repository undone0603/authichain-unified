import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { enqueue, recent, runQueue } from './memory.mjs';

const schema = `
CREATE TABLE agentz_tasks (
 id TEXT PRIMARY KEY, kind TEXT NOT NULL CHECK(kind IN ('public_probe')),
 target TEXT NOT NULL, priority INTEGER NOT NULL DEFAULT 50 CHECK(priority BETWEEN 0 AND 100),
 status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','running','succeeded','failed')),
 attempts INTEGER NOT NULL DEFAULT 0, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, next_run_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, last_error TEXT
);
CREATE INDEX idx_agentz_tasks_queue ON agentz_tasks(status,next_run_at,priority DESC);
CREATE TABLE agentz_task_events (id INTEGER PRIMARY KEY AUTOINCREMENT,task_id TEXT NOT NULL,event_type TEXT NOT NULL,outcome TEXT NOT NULL,evidence_url TEXT,detail TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,FOREIGN KEY(task_id) REFERENCES agentz_tasks(id));
CREATE TABLE agentz_learnings (id INTEGER PRIMARY KEY AUTOINCREMENT,task_kind TEXT NOT NULL,fingerprint TEXT NOT NULL,outcome TEXT NOT NULL CHECK(outcome IN ('success','failure')),strategy TEXT NOT NULL,observation TEXT NOT NULL,source_event_id INTEGER NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,UNIQUE(task_kind,fingerprint,outcome,strategy,source_event_id),FOREIGN KEY(source_event_id) REFERENCES agentz_task_events(id));
`;
class FakeD1 {
 constructor(){this.db = new DatabaseSync(':memory:');this.db.exec('PRAGMA foreign_keys=ON;'+schema);this.db.exec(readFileSync(new URL('./migrations/0002_lease_recovery.sql',import.meta.url),'utf8'));}
 prepare(sql){const db=this.db;return {bind(...args){const exec=(which)=>db.prepare(sql)[which](...args);return {run:async()=>({meta:{changes:exec('run').changes}}),first:async()=>exec('get')??null,all:async()=>({results:exec('all')})};}};}
 async batch(statements){this.db.exec('BEGIN');try{let r=[];for(const statement of statements){r.push(await statement.run());}this.db.exec('COMMIT');return r;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 rows(sql){return this.db.prepare(sql).all().map(row => ({...row}));}
}
const target='https://github.com/undone0603/authichain-unified/pull/2534';
const ok={ok:true,status:200,body:null};
const fail={ok:false,status:502,body:null};
const setup=()=>({AGENTZ_DB:new FakeD1()});

test('idempotent enqueue returns same task; rejects conflicting replay and unsupported URL',async()=>{
 const e=setup();const first=await enqueue(e,{target,idempotency_key:'github-pr-2534',priority:80});
 const second=await enqueue(e,{target,idempotency_key:'github-pr-2534',priority:80});
 assert.equal(second.id,first.id);assert.equal(second.deduplicated,true);
 assert.equal(e.AGENTZ_DB.rows('SELECT * FROM agentz_tasks').length,1);
 await assert.rejects(enqueue(e,{target:target+'?different=yes',idempotency_key:'github-pr-2534',priority:80}),/idempotency key reused/);
 await assert.rejects(enqueue(e,{target:'http://127.0.0.1/admin'}),/allowlisted/);
 await assert.rejects(enqueue(e,{target:'https://github.com.evil.test/undone0603/authichain-unified'}),/allowlisted/);
});
test('successful probe emits exactly one linked event and learning',async()=>{
 const e=setup();await enqueue(e,{target});
 const result=await runQueue(e,3,{clock:()=>Date.now()+2000,fetch:async()=>ok});
 assert.equal(result.processed,1);
 const rows=e.AGENTZ_DB.rows('SELECT status,attempts FROM agentz_tasks');assert.deepEqual(rows,[{status:'succeeded',attempts:1}]);
 const events=e.AGENTZ_DB.rows('SELECT event_type,outcome,evidence_url FROM agentz_task_events');
 assert.deepEqual(events,[{event_type:'public_probe',outcome:'success',evidence_url:target}]);
 const learn=e.AGENTZ_DB.rows('SELECT outcome,source_event_id FROM agentz_learnings');assert.equal(learn.length,1);assert.equal(learn[0].outcome,'success');
 assert.equal((await recent(e,{limit:3})).events.length,1);
});
test('simultaneous cron invocations claim one task once',async()=>{
 const e=setup();await enqueue(e,{target});
 let release;const held=new Promise(resolve=>release=resolve);
 let entered;const started=new Promise(resolve=>entered=resolve);
 const now=Date.now()+2000;
 const first=runQueue(e,1,{clock:()=>now,fetch:async()=>{entered();await held;return ok;}});
 await started;
 const second=await runQueue(e,1,{clock:()=>now,fetch:async()=>{throw Error('double execution');}});
 release();await first;
 assert.equal(second.processed,0);
 assert.equal(e.AGENTZ_DB.rows('SELECT * FROM agentz_task_events').length,1);
});
test('expired lease is unknown, retried, and late old response is fenced off',async()=>{
 const e=setup();await enqueue(e,{target});
 let release;const held=new Promise(resolve=>release=resolve);
 let entered;const started=new Promise(resolve=>entered=resolve);
 let now=Date.now()+2000;
 const first=runQueue(e,1,{clock:()=>now,fetch:async()=>{entered();await held;return ok;}});
 await started;
 now+=40000;
 const recovered=await runQueue(e,1,{clock:()=>now,fetch:async()=>ok});
 assert.equal(recovered.recovered,1);assert.equal(recovered.processed,0); // retry is delayed
 now+=6*60000;
 const replay=await runQueue(e,1,{clock:()=>now,fetch:async()=>ok});
 assert.equal(replay.processed,1);
 release();assert.equal((await first).processed,0);
 const state=e.AGENTZ_DB.rows('SELECT status,attempts FROM agentz_tasks')[0];
 assert.deepEqual(state,{status:'succeeded',attempts:2});
 const events=e.AGENTZ_DB.rows('SELECT event_type,outcome FROM agentz_task_events ORDER BY id');
 assert.deepEqual(events,[{event_type:'lease_recovered',outcome:'unknown'},{event_type:'public_probe',outcome:'success'}]);
 assert.equal(e.AGENTZ_DB.rows('SELECT * FROM agentz_learnings').length,1);
});
test('failed public probe respects bounded retry and does not call it success',async()=>{
 const e=setup();await enqueue(e,{target});let now=Date.now()+2000;
 for(let i=0;i<3;i++){const r=await runQueue(e,1,{clock:()=>now,fetch:async()=>fail});assert.equal(r.processed,1);now+=6*60000;}
 assert.deepEqual(e.AGENTZ_DB.rows('SELECT status,attempts FROM agentz_tasks'),[{status:'failed',attempts:3}]);
 assert.equal(e.AGENTZ_DB.rows("SELECT * FROM agentz_task_events WHERE outcome='success'").length,0);
 assert.equal(e.AGENTZ_DB.rows("SELECT * FROM agentz_learnings WHERE outcome='failure'").length,3);
});
test('missing D1 stays fail-closed',async()=>{
 assert.deepEqual(await runQueue({},3),{processed:0,reason:'D1 not configured'});
 await assert.rejects(enqueue({},{target}),/D1 not configured/);
});
