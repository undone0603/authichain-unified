import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcile } from './x402-reconcile.mjs';
const tx='0x'+'a'.repeat(64), payTo='0x'+'b'.repeat(40), token='0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
function fixture() { return {
  offerEvidence:{version:'signal-2026-11-13',source:'https://signal.authichain.com/offer',
    observedAt:'2026-11-13T19:00:00Z',validFrom:'2026-11-13T00:00:00Z',
    validUntil:'2026-11-14T00:00:00Z',network:'eip155:8453',token,
    amount:'10000',payTo,resource:'/api/x402/discovery'},
  requests:[{requestId:'req-1',txHash:tx,network:'eip155:8453',token,payTo,amount:'10000',resource:'/api/x402/discovery',payerClass:'external',payerClassEvidence:'independently_verified',authorized:true,occurredAt:'2026-11-13T20:00:00Z'}],
  transfers:[{txHash:tx,network:'eip155:8453',token,to:payTo,amount:'10000',confirmed:true,success:true,source:'independent_chain_rpc',blockNumber:100}],
  deliveries:[{requestId:'req-1',txHash:tx,status:'fulfilled',httpStatus:200,resource:'/api/x402/discovery',receiptVerified:true,source:'server_delivery_log'}]
}; }
test('offline manifest consistency cannot qualify outside revenue',()=>{const x=reconcile(fixture());assert.equal(x.totals.verifiedExternalFulfilled,0);assert.equal(x.totals.verifiedAtomicUSDC,'0');assert.equal(x.totals.manifestConsistentClaims,1);assert.equal(x.totals.manifestConsistentAtomicUSDC,'10000');assert.equal(x.totals.unverified,1);assert.equal(x.rows[0].status,'manifest_consistent_claim');});
test('no evidence is zero revenue',()=>{const x=reconcile({requests:[],transfers:[],deliveries:[]});assert.equal(x.totals.verifiedExternalFulfilled,0);});
for(const [label,mutate] of [
  ['missing delivery',x=>x.deliveries=[]],['wrong transaction receipt',x=>x.deliveries[0].txHash='0x'+'c'.repeat(64)],
  ['unconfirmed chain',x=>x.transfers[0].confirmed=false],['self-attested payer',x=>x.requests[0].payerClassEvidence='self_attested'],
  ['house payer',x=>x.requests[0].payerClass='house'],['refund',x=>x.requests[0].refunded=true],
  ['wrong amount',x=>x.transfers[0].amount='9999'],['wrong network',x=>x.transfers[0].network='eip155:1'],
  ['duplicate delivery',x=>x.deliveries.push({...x.deliveries[0]})],['missing authorization',x=>x.requests[0].authorized=false],
  ['wrong token',x=>x.transfers[0].token='0x'+'0'.repeat(40)],['failed HTTP',x=>x.deliveries[0].httpStatus=402],
  ['missing independent RPC source',x=>x.transfers[0].source='public_counter']
]) test('fails closed: '+label,()=>{const x=fixture();mutate(x);assert.equal(reconcile(x).totals.manifestConsistentClaims,0);});
test('duplicate requests and reused transaction cannot double count',()=>{const x=fixture();x.requests.push({...x.requests[0],requestId:'req-2'});const result=reconcile(x);assert.equal(result.totals.manifestConsistentClaims,1);assert.equal(result.totals.verifiedExternalFulfilled,0);});
test('rejects malformed manifest',()=>assert.throws(()=>reconcile({requests:[],transfers:[]})));

for (const [label, mutate] of [
  ['missing', x => delete x.offerEvidence],
  ['expired', x => x.offerEvidence.validUntil='2026-11-12T00:00:00Z'],
  ['unknown terms', x => x.offerEvidence.amount='20000'],
  ['wrong payee', x => x.offerEvidence.payTo='0x'+'c'.repeat(40)],
  ['wrong resource', x => x.offerEvidence.resource='/other'],
  ['outside validity', x => x.requests[0].occurredAt='2026-11-15T00:00:00Z'],
  ['invalid timestamp', x => x.offerEvidence.observedAt='not-a-date'],
  ['missing version', x => delete x.offerEvidence.version]
]) test('dated offer fails closed: '+label, () => {
  const x=fixture(); mutate(x);
  assert.equal(reconcile(x).totals.manifestConsistentClaims,0);
  assert.equal(reconcile(x).totals.verifiedExternalFulfilled,0);
});
