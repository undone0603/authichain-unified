/** Disposable SQLite durability fixture; DOES NOT replace PostgreSQL integration validation. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { createReplayGuard } from './agentz-host-replay.mjs';
import { createPostgresClaimOnce } from './agentz-postgres-claim.mjs';
const request={orderId:'order1',buyerId:'buyer1',scopeVersion:'v1',contentDigest:'sha256:'+'a'.repeat(64),receipts:[{kid:'buyer',signature:'buyer-sig'},{kid:'payment',signature:'payment-sig'},{kid:'bank',signature:'bank-sig'},{kid:'fulfillment',signature:'fulfillment-sig'}]};
const provenanceGate={inspect:()=>({status:'AUTHENTICATED_RECEIPTS_READY_FOR_INDEPENDENT_REVIEW',commercialTransitionAuthorized:false})};
function open(path){const db=new DatabaseSync(path);db.exec('CREATE TABLE IF NOT EXISTS replay (claim_sha256 TEXT PRIMARY KEY, minimum_retain_until INTEGER NOT NULL)');return db}
function claim(db){return createPostgresClaimOnce({query:async(_sql,[digest,ttl])=>{const result=db.prepare('INSERT INTO replay(claim_sha256,minimum_retain_until) VALUES (?,?) ON CONFLICT(claim_sha256) DO NOTHING').run(digest,Date.now()+ttl);return {rows:result.changes===1?[{claim_sha256:digest}]:[]}}})}
test('durable claim survives reopen and independent connection',async()=>{const dir=mkdtempSync(join(tmpdir(),'agentz-test-'));const file=join(dir,'claims.sqlite');let db1,db2;try{db1=open(file);db2=open(file);const g1=createReplayGuard({provenanceGate,claimOnce:claim(db1)});const g2=createReplayGuard({provenanceGate,claimOnce:claim(db2)});assert.equal((await g1.reserve(request)).status,'RESERVED_FOR_INDEPENDENT_REVIEW');assert.equal((await g2.reserve(request)).status,'HOLD');db1.close();db1=null;db2.close();db2=null;const db3=open(file);try{const g3=createReplayGuard({provenanceGate,claimOnce:claim(db3)});assert.equal((await g3.reserve(request)).reason,'receipt_replay_or_claim_unconfirmed');assert.equal(db3.prepare('SELECT COUNT(*) AS n FROM replay').get().n,1)}finally{db3.close()}}finally{db1?.close();db2?.close();rmSync(dir,{recursive:true,force:true})}});
test('concurrent reservations preserve uniqueness',async()=>{const dir=mkdtempSync(join(tmpdir(),'agentz-race-'));const db=open(join(dir,'claims.sqlite'));try{const g=createReplayGuard({provenanceGate,claimOnce:claim(db)});const r=await Promise.all([g.reserve(request),g.reserve(request)]);assert.deepEqual(r.map(x=>x.status).sort(),['HOLD','RESERVED_FOR_INDEPENDENT_REVIEW']);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM replay').get().n,1)}finally{db.close();rmSync(dir,{recursive:true,force:true})}});
