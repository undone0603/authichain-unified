import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { readFileSync } from 'node:fs';
import { enqueue, runQueue, recoverLeases, expirePending } from './memory.mjs';

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
 constructor(){this.db = new DatabaseSync(':memory:');this.db.exec('PRAGMA foreign_keys=ON;'+schema);this.db.exec(readFileSync(new URL('./migrations/0002_lease_recovery.sql',import.meta.url),'utf8'));this.db.exec(readFileSync(new URL('./migrations/0003_scheduler_recovery.sql',import.meta.url),'utf8'));}
 prepare(sql){const db=this.db;return {bind(...args){const exec=(which)=>db.prepare(sql)[which](...args);return {run:async()=>({meta:{changes:exec('run').changes}}),first:async()=>exec('get')??null,all:async()=>({results:exec('all')})};}};}
 async batch(statements){this.db.exec('BEGIN');try{let r=[];for(const statement of statements){r.push(await statement.run());}this.db.exec('COMMIT');return r;}catch(e){this.db.exec('ROLLBACK');throw e;}}
 rows(sql){return this.db.prepare(sql).all().map(row => ({...row}));}
}
const target='https://github.com/undone0603/authichain-unified/pull/2534';
const ok={ok:true,status:200,body:null};
const fail={ok:false,status:502,body:null};
const setup=()=>({AGENTZ_DB:new FakeD1()});
const failFetch=async()=>fail;
const MIN=60000;

test('per-task max_attempts=1 fails terminally after one failure, with completed_at',async()=>{
 const e=setup();await enqueue(e,{target,max_attempts:1});
 const r=await runQueue(e,3,{clock:()=>Date.now()+2000,fetch:failFetch});
 assert.equal(r.processed,1);
 const [row]=e.AGENTZ_DB.rows('SELECT status,attempts,max_attempts,completed_at FROM agentz_tasks');
 assert.equal(row.status,'failed');assert.equal(row.attempts,1);assert.equal(row.max_attempts,1);assert.ok(row.completed_at);
});

test('default max_attempts keeps the old three-try behaviour and leaves completed_at empty while pending',async()=>{
 const e=setup();await enqueue(e,{target});
 await runQueue(e,1,{clock:()=>Date.now()+2000,fetch:failFetch});
 const [row]=e.AGENTZ_DB.rows('SELECT status,max_attempts,completed_at FROM agentz_tasks');
 assert.equal(row.max_attempts,3);assert.equal(row.status,'pending');assert.equal(row.completed_at,null);
});

test('expired pending task is closed with an expired event and never fetched',async()=>{
 const e=setup();const now=Date.now();
 await enqueue(e,{target,expires_in_minutes:1,now});
 let fetched=0;
 const r=await runQueue(e,3,{clock:()=>now+2*MIN,fetch:async()=>{fetched++;return ok;}});
 assert.equal(fetched,0);assert.equal(r.expired,1);assert.equal(r.processed,0);
 const [row]=e.AGENTZ_DB.rows('SELECT status,last_error,completed_at FROM agentz_tasks');
 assert.equal(row.status,'failed');assert.match(row.last_error,/expired/);assert.ok(row.completed_at);
 assert.deepEqual(e.AGENTZ_DB.rows("SELECT event_type,outcome FROM agentz_task_events"),[{event_type:'expired',outcome:'expired'}]);
 assert.deepEqual(await expirePending(e,3,()=>now+3*MIN),{expired:0});
});

test('unexpired task with an expiry still runs',async()=>{
 const e=setup();const now=Date.now();
 await enqueue(e,{target,expires_in_minutes:60,now});
 const r=await runQueue(e,3,{clock:()=>now+2000,fetch:async()=>ok});
 assert.equal(r.processed,1);assert.equal(r.expired,0);
 assert.equal(e.AGENTZ_DB.rows('SELECT status FROM agentz_tasks')[0].status,'succeeded');
});

test('lease recovery honours per-task max_attempts',async()=>{
 const e=setup();await enqueue(e,{target,max_attempts:1});
 e.AGENTZ_DB.db.exec("UPDATE agentz_tasks SET status='running',attempts=1,claim_id='c1',lease_expires_at='2000-01-01 00:00:00'");
 assert.deepEqual(await recoverLeases(e,3,()=>Date.now()),{recovered:1});
 const [row]=e.AGENTZ_DB.rows('SELECT status,completed_at FROM agentz_tasks');
 assert.equal(row.status,'failed');assert.ok(row.completed_at);
});

test('enqueue validates max_attempts and expiry',async()=>{
 const e=setup();
 await assert.rejects(enqueue(e,{target,max_attempts:0}),/max_attempts/);
 await assert.rejects(enqueue(e,{target,max_attempts:11}),/max_attempts/);
 await assert.rejects(enqueue(e,{target,expires_in_minutes:0}),/expires_in_minutes/);
 await assert.rejects(enqueue(e,{target,expires_in_minutes:7*24*60+1}),/expires_in_minutes/);
});

test('0003 recovers legacy running rows that have no lease, once',()=>{
 const db=new DatabaseSync(':memory:');db.exec('PRAGMA foreign_keys=ON;'+schema);
 db.exec(readFileSync(new URL('./migrations/0002_lease_recovery.sql',import.meta.url),'utf8'));
 db.exec("INSERT INTO agentz_tasks(id,kind,target,status,attempts) VALUES ('a','public_probe','"+target+"','running',1),('b','public_probe','"+target+"','running',3)");
 db.exec(readFileSync(new URL('./migrations/0003_scheduler_recovery.sql',import.meta.url),'utf8'));
 const rows=db.prepare('SELECT id,status,completed_at IS NOT NULL AS done FROM agentz_tasks ORDER BY id').all().map(r=>({...r}));
 assert.deepEqual(rows,[{id:'a',status:'pending',done:0},{id:'b',status:'failed',done:1}]);
 const events=db.prepare("SELECT task_id,event_type,outcome FROM agentz_task_events ORDER BY task_id").all().map(r=>({...r}));
 assert.deepEqual(events,[{task_id:'a',event_type:'lease_recovered',outcome:'unknown'},{task_id:'b',event_type:'lease_recovered',outcome:'unknown'}]);
});

test('only read_only_public authorization class can exist',()=>{
 const e=setup();
 assert.throws(()=>e.AGENTZ_DB.db.exec("INSERT INTO agentz_tasks(id,kind,target,authorization_class) VALUES ('x','public_probe','"+target+"','write')"),/CHECK/);
});
