import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcile } from './x402-reconcile.mjs';
const tx='0x'+'a'.repeat(64), payTo='0x'+'b'.repeat(40), token='0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913';
function fixture() { return {
  requests:[{requestId:'req-1',txHash:tx,network:'eip155:8453',token,payTo,amount:'10000',resource:'/api/x402/discovery',payerClass:'external',payerClassEvidence:'independently_verified',authorized:true}],
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
