#!/usr/bin/env node
// Offline, read-only x402 reconciliation. No network, wallet, signing, writes or secret access.
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
const HASH = /^0x[a-fA-F0-9]{64}$/;
const ADDRESS = /^0x[a-fA-F0-9]{40}$/;
const BASE = 'eip155:8453';
const USDC = '0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const reject = reason => ({ status: 'unverified', reason });
function validId(x) { return typeof x === 'string' && /^[a-zA-Z0-9:_-]{1,128}$/.test(x); }
export function reconcile(input) {
  if (!input || !Array.isArray(input.requests) || !Array.isArray(input.transfers) ||
      !Array.isArray(input.deliveries) || input.requests.length > 10000 ||
      input.transfers.length > 10000 || input.deliveries.length > 10000) throw Error('Invalid bounded evidence manifest');
  const transfers = new Map(), deliveries = new Map();
  for (const t of input.transfers) {
    if (!HASH.test(t.txHash || '')) continue;
    const key = t.txHash.toLowerCase();
    if (!transfers.has(key)) transfers.set(key, []);
    transfers.get(key).push(t);
  }
  for (const d of input.deliveries) {
    if (!validId(d.requestId)) continue;
    if (!deliveries.has(d.requestId)) deliveries.set(d.requestId, []);
    deliveries.get(d.requestId).push(d);
  }
  const seenRequests = new Set(), usedTransactions = new Set();
  const rows = input.requests.map(r => {
    const id = r?.requestId;
    if (!validId(id)) return { requestId: null, ...reject('invalid_request_id') };
    if (seenRequests.has(id)) return { requestId: id, ...reject('duplicate_request_id') };
    seenRequests.add(id);
    const tx = r.txHash;
    if (!HASH.test(tx || '')) return { requestId: id, ...reject('missing_valid_tx_hash') };
    const key = tx.toLowerCase();
    if (usedTransactions.has(key)) return { requestId: id, ...reject('transaction_reused') };
    // Reserve even failed transactions: one transaction cannot qualify a second request.
    usedTransactions.add(key);
    const matches = transfers.get(key) || [], delivered = deliveries.get(id) || [];
    if (matches.length !== 1) return { requestId: id, ...reject('transfer_missing_or_ambiguous') };
    if (delivered.length !== 1) return { requestId: id, ...reject('delivery_missing_or_ambiguous') };
    const t = matches[0], d = delivered[0];
    if (r.payerClass !== 'external' || r.payerClassEvidence !== 'independently_verified' ||
        r.test === true || t.test === true || d.test === true) return { requestId: id, ...reject('external_payer_not_verified') };
    if (r.authorized !== true) return { requestId: id, ...reject('authorization_unverified') };
    if (r.network !== BASE || t.network !== BASE || String(t.token).toLowerCase() !== USDC ||
        String(r.token).toLowerCase() !== USDC || !ADDRESS.test(t.to || '') ||
        String(t.to).toLowerCase() !== String(r.payTo).toLowerCase()) return { requestId: id, ...reject('network_asset_or_recipient_mismatch') };
    if (!/^[1-9][0-9]*$/.test(String(r.amount)) || String(t.amount) !== String(r.amount) ||
        t.confirmed !== true || t.success !== true || t.source !== 'independent_chain_rpc' ||
        !Number.isInteger(t.blockNumber) || t.blockNumber < 1) return { requestId: id, ...reject('settlement_not_independently_confirmed') };
    if (d.txHash?.toLowerCase() !== key || d.requestId !== id || d.status !== 'fulfilled' ||
        d.httpStatus !== 200 || d.resource !== r.resource || d.receiptVerified !== true ||
        d.source !== 'server_delivery_log') return { requestId: id, ...reject('delivery_not_correlated') };
    if (r.refunded === true || t.reversed === true || d.refunded === true ||
        r.disputed === true || d.disputed === true) return { requestId: id, ...reject('refunded_or_disputed') };
    return { requestId: id, status: 'verified_external_fulfilled', txHash: key, amountAtomic: String(t.amount) };
  });
  const verified = rows.filter(x => x.status === 'verified_external_fulfilled');
  return { rows, totals: { verifiedExternalFulfilled: verified.length,
    verifiedAtomicUSDC: verified.reduce((n, x) => n + BigInt(x.amountAtomic), 0n).toString(),
    unverified: rows.length - verified.length },
    disclosure: 'Offline evidence join only. Input assertions, independent RPC provenance, and delivery logs must be authenticated separately; this tool never fetches or validates chain state.' };
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    if (process.argv.length !== 3) throw Error('Usage: node scripts/growth/x402-reconcile.mjs redacted-evidence.json');
    console.log(JSON.stringify(reconcile(JSON.parse(readFileSync(process.argv[2], 'utf8'))), null, 2));
  } catch (e) { console.error('X402_RECONCILIATION_HOLD: ' + e.message); process.exitCode = 1; }
}
