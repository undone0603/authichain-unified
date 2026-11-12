import test from 'node:test';
import assert from 'node:assert/strict';
import {createReplayGuard} from './agentz-host-replay.mjs';

const request={orderId:'order-1',buyerId:'buyer-1',scopeVersion:'v1',contentDigest:'sha256:'+'a'.repeat(64),receipts:[{kid:'buyer',signature:'signed-buyer'},{kid:'payment',signature:'signed-payment'},{kid:'bank',signature:'signed-bank'},{kid:'fulfillment',signature:'signed-fulfillment'}]};
const authenticated=Object.freeze({inspect:()=>({status:'AUTHENTICATED_RECEIPTS_READY_FOR_INDEPENDENT_REVIEW',commercialTransitionAuthorized:false})});
const untrusted=Object.freeze({inspect:()=>({status:'HOLD',reason:'invalid_signature',commercialTransitionAuthorized:false})});

test('requires durable store injection',()=>assert.throws(()=>createReplayGuard({provenanceGate:authenticated})));
test('requires host verifier',()=>assert.throws(()=>createReplayGuard({claimOnce:async()=>true})));
test('rejects weak TTL',()=>assert.throws(()=>createReplayGuard({provenanceGate:authenticated,claimOnce:async()=>true,ttlMs:1000})));
test('unverified receipts never touch durable store',async()=>{let calls=0;const g=createReplayGuard({provenanceGate:untrusted,claimOnce:async()=>{calls++;return true}});const r=await g.reserve(request);assert.equal(r.status,'HOLD');assert.equal(calls,0)});
test('one successful reservation is review-only; replay is held',async()=>{const seen=new Set();const g=createReplayGuard({provenanceGate:authenticated,claimOnce:async k=>{if(seen.has(k))return false;seen.add(k);return true}});const one=await g.reserve(request);const two=await g.reserve(request);assert.equal(one.status,'RESERVED_FOR_INDEPENDENT_REVIEW');assert.equal(one.commercialTransitionAuthorized,false);assert.equal(two.reason,'receipt_replay_or_claim_unconfirmed')});
test('durable failure holds closed',async()=>{const g=createReplayGuard({provenanceGate:authenticated,claimOnce:async()=>{throw Error('database offline')}});assert.equal((await g.reserve(request)).reason,'durable_replay_store_unavailable')});
test('uncertain claim result is held',async()=>{const g=createReplayGuard({provenanceGate:authenticated,claimOnce:async()=>undefined});assert.equal((await g.reserve(request)).status,'HOLD')});
test('concurrent duplicate requests: only first reservation succeeds',async()=>{const seen=new Set();const g=createReplayGuard({provenanceGate:authenticated,claimOnce:async k=>{if(seen.has(k))return false;seen.add(k);return true}});const r=await Promise.all([g.reserve(request),g.reserve(request)]);assert.deepEqual(r.map(x=>x.status).sort(),['HOLD','RESERVED_FOR_INDEPENDENT_REVIEW'])});
