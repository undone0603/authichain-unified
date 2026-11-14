#!/usr/bin/env node
// Offline x402 settlement-to-fulfillment audit. Never fetches, signs, pays or mutates production.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const HEX = /^0x[a-fA-F0-9]{64}$/;
const ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const CHAIN = 'eip155:8453';
const USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bdA02913'.toLowerCase();
const LEGACY_AMOUNT = '10000';
const recipient = '0x5db511706fb6317cd23a7655f67450c5ac6e6aa2';
const resource = 'https://signal.authichain.com/api/x402/discovery';
const validDate = x => typeof x === 'string' && !Number.isNaN(Date.parse(x));
const norm = x => typeof x === 'string' ? x.toLowerCase() : '';
const evidence = x => x && typeof x.source === 'string' && x.source.startsWith('https://') && validDate(x.observedAt);
const ok = x => typeof x === 'string' && x.length > 0;

export function reconcile(data) {
  if (!data || !Array.isArray(data.settlements) || !Array.isArray(data.deliveries)) throw Error('Expected settlements and deliveries arrays');
  // A dated offer snapshot is mandatory. This is still a self-attested offline audit,
  // not independent chain or merchant authentication.
  const offer = data.offerEvidence;
  const offerValid = offer && ok(offer.version) && evidence(offer) &&
    validDate(offer.validFrom) && validDate(offer.validUntil) &&
    Date.parse(offer.validFrom) <= Date.parse(offer.observedAt) &&
    Date.parse(offer.observedAt) <= Date.parse(offer.validUntil) &&
    Date.parse(offer.validFrom) < Date.parse(offer.validUntil) &&
    offer.chain === CHAIN && norm(offer.token) === USDC &&
    /^\\d+$/.test(offer.amountAtomic || '') && BigInt(offer.amountAtomic || '0') > 0n &&
    ADDRESS.test(offer.recipient || '') && ok(offer.resource);
  const deliveries = new Map();
  for (const d of data.deliveries) {
    if (!ok(d.requestId)) throw Error('Missing delivery requestId');
    if (!deliveries.has(d.requestId)) deliveries.set(d.requestId, []);
    deliveries.get(d.requestId).push(d);
  }
  const seenTx = new Set();
  const seenRequest = new Set();
  const seenPayment = new Set();
  const seenReceipt = new Set();
  const results = [];
  for (const s of data.settlements) {
    const reasons = [];
    if (!HEX.test(s.txHash || '')) reasons.push('invalid_tx_hash');
    if (!ok(s.requestId)) reasons.push('missing_request_id');
    if (!ok(s.paymentId)) reasons.push('missing_payment_id');
    if (seenTx.has(norm(s.txHash))) reasons.push('duplicate_tx');
    if (seenRequest.has(s.requestId)) reasons.push('duplicate_request');
    if (seenPayment.has(s.paymentId)) reasons.push('duplicate_payment_id');
    seenTx.add(norm(s.txHash)); seenRequest.add(s.requestId); seenPayment.add(s.paymentId);
    if (!offerValid || !validDate(s.occurredAt) ||
        Date.parse(s.occurredAt) < Date.parse(offer.validFrom) ||
        Date.parse(s.occurredAt) > Date.parse(offer.validUntil)) reasons.push('missing_stale_or_unknown_offer');
    if (s.chain !== CHAIN || norm(s.token) !== USDC || !offerValid ||
        s.amountAtomic !== offer.amountAtomic || norm(s.to) !== norm(offer.recipient) ||
        !ADDRESS.test(s.from || '')) reasons.push('incorrect_transfer');
    if (s.confirmed !== true || s.success !== true || !ok(s.blockHash) || !HEX.test(s.blockHash || '') ||
        !Number.isInteger(s.confirmations) || s.confirmations < 1 || !evidence(s.chainEvidence)) reasons.push('unconfirmed_chain');
    if (s.chainEvidence?.independentlyValidated !== true) reasons.push('chain_not_independently_validated');
    if (s.payerClass !== 'external' || s.houseOrTest === true) reasons.push('not_external');
    if (s.refunded !== false || s.disputed !== false) reasons.push('refund_dispute_unknown_or_true');
    const matches = deliveries.get(s.requestId) || [];
    if (matches.length !== 1) reasons.push('delivery_missing_or_ambiguous');
    const d = matches.length === 1 ? matches[0] : null;
    if (d && ok(d.receiptId)) {
      if (seenReceipt.has(d.receiptId)) reasons.push('duplicate_delivery_receipt');
      seenReceipt.add(d.receiptId);
    }
    if (d && (norm(d.txHash) !== norm(s.txHash) || d.paymentId !== s.paymentId ||
        (!offerValid || d.resource !== offer.resource) || d.status !== 200 || d.delivered !== true ||
        !evidence(d.deliveryEvidence) || d.deliveryEvidence.independentlyValidated !== true || !ok(d.receiptId))) reasons.push('delivery_not_proven');
    // Source independence: provider receipt alone cannot attest to chain settlement.
    if (d && s.chainEvidence?.source === d.deliveryEvidence?.source) reasons.push('non_independent_evidence');
    results.push({ transaction: HEX.test(s.txHash || '') ? s.txHash.slice(0, 10) + '…' : 'invalid',
      request: ok(s.requestId) ? s.requestId : 'missing',
      verdict: reasons.length ? 'unverified' : 'verified_external_fulfilled',
      reasons });
  }
  const verified = results.filter(r => r.verdict === 'verified_external_fulfilled');
  return { verifiedTransactions: verified.length, verifiedAmountAtomic: offerValid ? String(BigInt(verified.length) * BigInt(offer.amountAtomic)) : '0',
    unverifiedTransactions: results.length - verified.length, results };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw Error('Usage: node scripts/growth/x402-reconcile.mjs local-evidence.json');
    console.log(JSON.stringify(reconcile(JSON.parse(readFileSync(process.argv[2], 'utf8'))), null, 2));
  } catch (e) { console.error(e.message); process.exitCode = 1; }
}
