import test from 'node:test';
import assert from 'node:assert/strict';
import { createReplayGuard } from './agentz-host-replay.mjs';

const verifier = { inspect: () => ({ status: 'AUTHENTICATED_RECEIPTS_READY_FOR_INDEPENDENT_REVIEW', commercialTransitionAuthorized: false }) };
const request = { orderId: 'order-123', buyerId: 'buyer-456', scopeVersion: 'v1', contentDigest: 'sha256:' + 'a'.repeat(64), receipts: [{kid:'buyer',signature:'a'}, {kid:'payment',signature:'b'}, {kid:'bank',signature:'c'}, {kid:'fulfillment',signature:'d'}] };
test('renewed evidence for same immutable order cannot create second reservation', async () => {
 const used = new Set();
 const guard = createReplayGuard({ provenanceGate: verifier, claimOnce: async key => { if (used.has(key)) return false; used.add(key); return true; } });
 assert.equal((await guard.reserve(request)).status, 'RESERVED_FOR_INDEPENDENT_REVIEW');
 const altered = structuredClone(request);
 altered.receipts[0].signature = 'new-valid-host-signature';
 altered.contentDigest = 'sha256:' + 'b'.repeat(64);
 assert.equal((await guard.reserve(altered)).reason, 'receipt_replay_or_claim_unconfirmed');
 assert.equal(used.size, 1);
});
test('missing canonical order id cannot reach claim store', async () => {
 let called = false;
 const guard = createReplayGuard({ provenanceGate: verifier, claimOnce: async () => { called = true; return true; } });
 assert.equal((await guard.reserve({...request, orderId: ''})).reason, 'missing_canonical_order_id');
 assert.equal(called, false);
});
