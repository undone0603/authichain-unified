/**
 * Real PostgreSQL integration, opt-in ONLY on an isolated disposable database.
 * Example:
 *   AGENTZ_DISPOSABLE_PG_URL=postgres://ci:ci@127.0.0.1:5432/agentz_disposable_ci \
 *   AGENTZ_DISPOSABLE_PG_TESTS=1 node --test scripts/ci/agentz-postgres-real.integration.test.mjs
 * Never accepts production credentials, cloud hosts, or implicit DATABASE_URL.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import pg from 'pg';
import { createPostgresClaimOnce } from './agentz-postgres-claim.mjs';
import { createReplayGuard } from './agentz-host-replay.mjs';
const { Client } = pg;
const allow = process.env.AGENTZ_DISPOSABLE_PG_TESTS === '1';
const rawUrl = process.env.AGENTZ_DISPOSABLE_PG_URL;
const checkConfig = () => {
 if (!allow || !rawUrl) return null;
 const url = new URL(rawUrl);
 if (!['postgres:','postgresql:'].includes(url.protocol)) throw Error('PostgreSQL URL required');
 if (!['localhost','127.0.0.1','::1'].includes(url.hostname)) throw Error('local disposable PostgreSQL host required');
 if (!/^\/agentz_disposable_[a-z0-9_]+$/.test(url.pathname)) throw Error('dedicated disposable database name required');
 if (url.searchParams.has('sslmode')) throw Error('unexpected SSL mode');
 return url.toString();
};
const conn = checkConfig();
const request = {orderId:'pg-real-order',buyerId:'pg-real-buyer',scopeVersion:'v1',contentDigest:'sha256:'+'a'.repeat(64),receipts:[{kid:'buyer',signature:'a'},{kid:'payment',signature:'b'},{kid:'bank',signature:'c'},{kid:'fulfillment',signature:'d'}]};
const verifier = {inspect:()=>({status:'AUTHENTICATED_RECEIPTS_READY_FOR_INDEPENDENT_REVIEW',commercialTransitionAuthorized:false})};
const ddl = `CREATE TABLE IF NOT EXISTS agentz_commercial_replay_claims (claim_sha256 text PRIMARY KEY CHECK(claim_sha256 ~ '^[0-9a-f]{64}$'), first_seen_at timestamptz NOT NULL DEFAULT now(), minimum_retain_until timestamptz NOT NULL)`;
const query = client => async (sql,params)=>client.query(sql,params);
const claim = client=>createPostgresClaimOnce({query:query(client)});
const guard = client=>createReplayGuard({provenanceGate:verifier,claimOnce:claim(client)});
test('real isolated PostgreSQL rejects replay concurrently and across reconnects', {skip:!conn}, async () => {
 const c1=new Client({connectionString:conn,application_name:'agentz-disposable-replay-ci'});
 const c2=new Client({connectionString:conn,application_name:'agentz-disposable-replay-ci'});
 await c1.connect();await c2.connect();
 try {
  const id = await c1.query('SELECT current_database() AS db, current_user AS role');
  assert.match(id.rows[0].db,/^agentz_disposable_/);
  assert.notMatch(id.rows[0].role,/^(postgres|supabase_admin|service_role)$/i);
  // Run only after the restricted role and named disposable DB have been proven.
  await c1.query(ddl);
  const results=await Promise.all([guard(c1).reserve(request),guard(c2).reserve(request)]);
  assert.deepEqual(results.map(x=>x.status).sort(),['HOLD','RESERVED_FOR_INDEPENDENT_REVIEW']);
  assert.equal(results.find(x=>x.status==='RESERVED_FOR_INDEPENDENT_REVIEW').commercialTransitionAuthorized,false);
  await c2.end();
  const c3=new Client({connectionString:conn,application_name:'agentz-disposable-replay-ci'});
  await c3.connect();
  try {
   assert.equal((await guard(c3).reserve(request)).reason,'receipt_replay_or_claim_unconfirmed');
   const count=await c3.query('SELECT count(*)::int AS n FROM agentz_commercial_replay_claims');
   assert.equal(count.rows[0].n,1);
  } finally {await c3.end();}
 } finally {await c1.end();if(!c2._ending)await c2.end();}
});
