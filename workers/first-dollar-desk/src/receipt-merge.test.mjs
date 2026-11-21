import assert from 'node:assert/strict';
import { test } from 'node:test';
import { sameReceiptIdentity, mergeReceiptEvidence, upsertLedgerReceipt } from './receipt-merge.mjs';

const tx = `0x${'a'.repeat(64)}`;
const tx2 = `0x${'b'.repeat(64)}`;
const payer = '0xBuyer';
const x402 = { id: `x402_${tx}`, txHash: tx, rail: 'agent', network: 'eip155:8453', wallet: payer, amountCents: 5, status: 'qualified', metadata: { x402: '1', facilitator: 'payai' } };
const chain = { id: `base_usdc_${tx}`, txHash: tx, rail: 'agent', network: 'eip155:8453', wallet: payer, amountCents: 5, status: 'pending', metadata: { from: payer, contract: 'USDC' } };

test('exact Base tx links raw observation and facilitator result', () => {
  assert.equal(sameReceiptIdentity(x402, chain), true);
  assert.equal(sameReceiptIdentity(chain, x402), true);
});
test('later chain scan cannot erase x402 provenance or qualified status', () => {
  const merged = mergeReceiptEvidence(x402, chain);
  assert.deepEqual(merged, x402);
  assert.equal(merged.metadata.facilitator, 'payai');
});
test('facilitator evidence promotes an earlier raw chain observation', () => {
  assert.deepEqual(mergeReceiptEvidence(chain, x402), x402);
});
test('case-insensitive transaction hashes are treated as the same', () => {
  const upper = `0x${'A'.repeat(64)}`;
  assert.equal(sameReceiptIdentity(x402, {...chain, txHash: upper}), true);
  assert.deepEqual(mergeReceiptEvidence(x402, {...chain, txHash: upper}), x402);
});
test('different tx hashes do not identify the same receipt', () => {
  assert.equal(sameReceiptIdentity(x402, {...chain, txHash: tx2, id: 'other'}), false);
});
test('testnet transfer never identifies a mainnet transfer solely by hash', () => {
  assert.equal(sameReceiptIdentity(x402, {...chain, network: 'eip155:84532', id: 'other'}), false);
});
test('unverified malformed tx hashes never match solely by tx', () => {
  assert.equal(sameReceiptIdentity({...x402, id:'old',txHash:'not-a-hash'}, {...chain,id:'new',txHash:'not-a-hash'}), false);
});
test('existing Stripe payment identities still match', () => {
  assert.equal(sameReceiptIdentity({id:'one',stripePaymentIntentId:'pi_a'}, {id:'two',stripePaymentIntentId:'pi_a'}),true);
  assert.equal(sameReceiptIdentity({id:'one',stripeCheckoutSessionId:'cs_a'}, {id:'two',stripeCheckoutSessionId:'cs_a'}),true);
  assert.equal(sameReceiptIdentity({id:'one',stripeChargeId:'ch_a'}, {id:'two',stripeChargeId:'ch_a'}),true);
});
test('same receipt ID still matches without transaction', () => {
  assert.equal(sameReceiptIdentity({id:'same'},{id:'same'}),true);
  assert.equal(sameReceiptIdentity({},{}),false);
});
test('ordinary Stripe record update merges rather than discarding incoming fields', () => {
  assert.deepEqual(mergeReceiptEvidence({id:'same',status:'pending',metadata:{ok:true}},{id:'same',status:'qualified'}),{id:'same',status:'qualified',metadata:{ok:true}});
});
test('second x402 receipt id cannot overwrite first linked transaction', () => {
  assert.deepEqual(mergeReceiptEvidence(x402,{...x402,id:'attempt_2',status:'qualified'}),x402);
});
test('same x402 receipt cannot be demoted from qualified to pending by retry', () => {
  assert.deepEqual(mergeReceiptEvidence(x402,{...x402,status:'pending'}),x402);
});
test('explicit rejected_self_pay reclassification is not suppressed by retry protection', () => {
  assert.equal(mergeReceiptEvidence(x402,{...x402,status:'rejected_self_pay'}).status,'rejected_self_pay');
});
test('helpers behave safely with nulls', () => {
  assert.equal(sameReceiptIdentity(null,x402),false);
  assert.deepEqual(mergeReceiptEvidence(null,x402),x402);
  assert.deepEqual(mergeReceiptEvidence(x402,null),x402);
});

test('full ledger upsert preserves x402 after later chain scan', () => {
  const ledger = upsertLedgerReceipt(upsertLedgerReceipt([], x402), chain);
  assert.equal(ledger.length, 1);
  assert.deepEqual(ledger[0], x402);
});
test('full ledger upsert promotes raw chain into x402 with same tx', () => {
  const ledger = upsertLedgerReceipt(upsertLedgerReceipt([], chain), x402);
  assert.equal(ledger.length, 1);
  assert.deepEqual(ledger[0], x402);
});
test('repeated raw scans do not create another payment record', () => {
  let ledger = upsertLedgerReceipt([], chain);
  ledger = upsertLedgerReceipt(ledger, {...chain, id:'new_scan_index'});
  assert.equal(ledger.length, 1);
  assert.equal(ledger[0].status, 'pending');
});
test('same transaction hash on different networks is not collapsed by ledger upsert', () => {
  const otherChain = {...chain, id:'testnet_scan', network:'eip155:84532'};
  const ledger = upsertLedgerReceipt(upsertLedgerReceipt([], x402),otherChain);
  assert.equal(ledger.length,2);
});
test('different x402 receipt IDs on one transaction cannot overwrite the first', () => {
  let ledger=upsertLedgerReceipt([],x402);
  ledger=upsertLedgerReceipt(ledger,{...x402,id:'different_attempt',name:'different'});
  assert.equal(ledger.length,1);
  assert.deepEqual(ledger[0],x402);
});
test('Stripe receipt updates still merge on stable payment identity', () => {
  let ledger=upsertLedgerReceipt([],{id:'initial',stripePaymentIntentId:'pi_a',status:'pending'});
  ledger=upsertLedgerReceipt(ledger,{id:'received',stripePaymentIntentId:'pi_a',status:'qualified'});
  assert.equal(ledger.length,1);
  assert.equal(ledger[0].status,'qualified');
});
