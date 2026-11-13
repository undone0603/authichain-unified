#!/usr/bin/env node
// Offline x402 settlement-to-fulfillment audit. Never fetches, signs, pays or mutates production.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const HEX = /^0x[a-fA-F0-9]{64}$/;
const ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const CHAIN = 'eip155:8453';
const USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bdA02913'.toLowerCase();
const amount = '10000';
const resource = 'https://signal.authichain.com/api/x402/discovery';
const validDate = x => typeof x === 'string' && !Number.isNaN(Date.parse(x));
const unique = xs => xs.length === new Set(xs).size;
const norm = x => typeof x === 'string' ? x.toLowerCase() : '';
const evidence = x => x && typeof x.source === 'string' && x.source.startsWith('https://') && validDate(x.observedAt);
const ok = x => typeof x === 'string' && x.length > 0;
const key = x => norm(x.txHash) + ':' + x.requestId;

export function reconcile(data) {
  if (!data || !Array.isArray(data.settlements) || !Array.isArray(data.deliveries)) throw Error('Expected settlements and deliveries arrays');
  const deliveries = new Map();
  for (const d of data.deliveries) {
    if (!ok(d.requestId)) throw Error('Missing delivery requestId');
    if (!deliveries.has(d.requestId)) deliveries.set(d.requestId, []);
    deliveries.get(d.requestId).push(d);
  }
  const seenTx = new Set();
  const seenRequest = new Set();
  const results = [];
  for (const s of data.settlements) {
    const reasons = [];
    if (!HEX.test(s.txHash || '')) reasons.push('invalid_tx_hash');
    if (!ok(s.requestId)) reasons.push('missing_request_id');
    if (!ok(s.paymentId)) reasons.push('missing_payment_id');
    if (seenTx.has(norm(s.txHash))) reasons.push('duplicate_tx');
    if (seenRequest.has(s.requestId)) reasons.push('duplicate_request');
    seenTx.add(norm(s.txHash)); seenRequest.add(s.requestId);
    if (s.chain !== CHAIN || norm(s.token) !== USDC || s.amountAtomic !== amount ||
        !ADDRESS.test(s.to || '') || !ADDRESS.test(s.from || '')) reasons.push('incorrect_transfer');
    if (s.confirmed !== true || s.success !== true || !ok(s.blockHash) || !HEX.test(s.blockHash || '') ||
        !Number.isInteger(s.confirmations) || s.confirmations < 1 || !evidence(s.chainEvidence)) reasons.push('unconfirmed_chain');
    if (s.payerClass !== 'external' || s.houseOrTest === true) reasons.push('not_external');
    if (s.refunded !== false || s.disputed !== false) reasons.push('refund_dispute_unknown_or_true');
    const matches = deliveries.get(s.requestId) || [];
    if (matches.length !== 1) reasons.push('delivery_missing_or_ambiguous');
    const d = matches.length === 1 ? matches[0] : null;
    if (d && (norm(d.txHash) !== norm(s.txHash) || d.paymentId !== s.paymentId ||
        d.resource !== resource || d.status !== 200 || d.delivered !== true ||
        !evidence(d.deliveryEvidence) || !ok(d.receiptId))) reasons.push('delivery_not_proven');
    // Source independence: provider receipt alone cannot attest to chain settlement.
    if (d && s.chainEvidence?.source === d.deliveryEvidence?.source) reasons.push('non_independent_evidence');
    results.push({ transaction: HEX.test(s.txHash || '') ? s.txHash.slice(0, 10) + '…' : 'invalid',
      request: ok(s.requestId) ? s.requestId : 'missing',
      verdict: reasons.length ? 'unverified' : 'verified_external_fulfilled',
      reasons });
  }
  const verified = results.filter(r => r.verdict === 'verified_external_fulfilled');
  return { verifiedTransactions: verified.length, verifiedAmountAtomic: String(verified.length * Number(amount)),
    unverifiedTransactions: results.length - verified.length, results };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw Error('Usage: node scripts/growth/x402-reconcile.mjs local-evidence.json');
    console.log(JSON.stringify(reconcile(JSON.parse(readFileSync(process.argv[2], 'utf8'))), null, 2));
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
