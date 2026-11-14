import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcile } from './x402-reconcile.mjs';
const tx = '0x' + 'a'.repeat(64), block = '0x' + 'b'.repeat(64);
const settlement = () => ({
 txHash:tx, requestId:'req-1',paymentId:'pay-1',chain:'eip155:8453',
 token:'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',amountAtomic:'10000',
 to:'0x5db511706FB6317cd23A7655F67450c5AC6e6AA2',
 from:'0x'+'c'.repeat(40), occurredAt:'2026-11-13T20:00:00Z', confirmed:true,success:true,blockHash:block,confirmations:3,
 chainEvidence:{source:'https://basescan.org/tx/'+tx,observedAt:'2026-11-13T20:00:00Z',independentlyValidated:true},
 payerClass:'external',houseOrTest:false,refunded:false,disputed:false
});
const delivery = () => ({requestId:'req-1',paymentId:'pay-1',txHash:tx,
 resource:'https://signal.authichain.com/api/x402/discovery',status:200,delivered:true,
 receiptId:'receipt-1',deliveryEvidence:{source:'https://internal.example.org/receipt/1',
 observedAt:'2026-11-13T20:00:01Z',independentlyValidated:true}});
const offerEvidence = () => ({version:'signal-discovery-2026-11-13',source:'https://signal.authichain.com/offer',
 observedAt:'2026-11-13T19:00:00Z',validFrom:'2026-11-13T00:00:00Z',validUntil:'2026-11-14T00:00:00Z',
 chain:'eip155:8453',token:'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',amountAtomic:'10000',
 recipient:'0x5db511706FB6317cd23A7655F67450c5AC6e6AA2',resource:'https://signal.authichain.com/api/x402/discovery'});
const audit=(s=[settlement()],d=[delivery()],o=offerEvidence())=>reconcile({settlements:s,deliveries:d,offerEvidence:o});
test('missing offer evidence fails closed',()=>assert.equal(audit(undefined,undefined,null).verifiedTransactions,0));
test('stale offer evidence fails closed',()=>assert.equal(audit(undefined,undefined,{...offerEvidence(),validUntil:'2026-11-12T00:00:00Z'}).verifiedTransactions,0));
test('unknown offer terms fail closed',()=>assert.equal(audit(undefined,undefined,{...offerEvidence(),amountAtomic:'20000'}).verifiedTransactions,0));
test('settlement outside offer validity fails closed',()=>assert.equal(audit([{...settlement(),occurredAt:'2026-11-15T00:00:00Z'}]).verifiedTransactions,0));
test('requires independent matching settlement and fulfillment',()=>assert.equal(audit().verifiedTransactions,1));
test('no receipt is not revenue',()=>assert.equal(audit(undefined,[]).verifiedTransactions,0));
test('unconfirmed transfer is not revenue',()=>assert.equal(audit([{...settlement(),confirmed:false}]).verifiedTransactions,0));
test('unvalidated evidence is not revenue',()=>assert.equal(audit([{...settlement(),chainEvidence:{...settlement().chainEvidence,independentlyValidated:false}}]).verifiedTransactions,0));
test('wrong payee is not revenue',()=>assert.equal(audit([{...settlement(),to:'0x'+'d'.repeat(40)}]).verifiedTransactions,0));
test('house payment is not revenue',()=>assert.equal(audit([{...settlement(),payerClass:'house'}]).verifiedTransactions,0));
test('refund is not revenue',()=>assert.equal(audit([{...settlement(),refunded:true}]).verifiedTransactions,0));
test('mismatched payment id is not revenue',()=>assert.equal(audit(undefined,[{...delivery(),paymentId:'other'}]).verifiedTransactions,0));
test('duplicate tx cannot count twice',()=>assert.equal(audit([settlement(),{...settlement(),requestId:'req-2'}],[delivery(),{...delivery(),requestId:'req-2'}]).verifiedTransactions,1));
test('missing delivery independent validation is not revenue',()=>assert.equal(audit(undefined,[{...delivery(),deliveryEvidence:{...delivery().deliveryEvidence,independentlyValidated:false}}]).verifiedTransactions,0));

test('reused delivery receipt cannot certify a second payment', () => {
 const second = {...settlement(), txHash:'0x'+'d'.repeat(64),requestId:'req-2',paymentId:'pay-2'};
 const otherDelivery = {...delivery(),txHash:second.txHash,requestId:'req-2',paymentId:'pay-2'};
 const result = audit([settlement(),second],[delivery(),otherDelivery]);
 assert.equal(result.verifiedTransactions,1);
 assert.ok(result.results[1].reasons.includes('duplicate_delivery_receipt'));
});

test('reused payment identifier cannot certify a second distinct settlement', () => {
 const second = {...settlement(),txHash:'0x'+'d'.repeat(64),requestId:'req-2'};
 const otherDelivery = {...delivery(),txHash:second.txHash,requestId:'req-2'};
 const result = audit([settlement(),second],[delivery(),otherDelivery]);
 assert.equal(result.verifiedTransactions,1);
 assert.ok(result.results[1].reasons.includes('duplicate_payment_id'));
});
