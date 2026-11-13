import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcile } from './x402-reconcile.mjs';
const tx = '0x' + 'a'.repeat(64), block = '0x' + 'b'.repeat(64);
const settlement = () => ({
 txHash:tx, requestId:'req-1',paymentId:'pay-1',chain:'eip155:8453',
 token:'0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',amountAtomic:'10000',
 to:'0x5db511706FB6317cd23A7655F67450c5AC6e6AA2',
 from:'0x'+'c'.repeat(40), confirmed:true,success:true,blockHash:block,confirmations:3,
 chainEvidence:{source:'https://basescan.org/tx/'+tx,observedAt:'2026-11-13T20:00:00Z',independentlyValidated:true},
 payerClass:'external',houseOrTest:false,refunded:false,disputed:false
});
const delivery = () => ({requestId:'req-1',paymentId:'pay-1',txHash:tx,
 resource:'https://signal.authichain.com/api/x402/discovery',status:200,delivered:true,
 receiptId:'receipt-1',deliveryEvidence:{source:'https://internal.example.org/receipt/1',
 observedAt:'2026-11-13T20:00:01Z',independentlyValidated:true}});
const audit=(s=[settlement()],d=[delivery()])=>reconcile({settlements:s,deliveries:d});
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
