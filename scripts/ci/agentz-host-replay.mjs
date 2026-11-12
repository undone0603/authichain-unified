/**
 * AgentZ durable replay reservation for independently host-signed receipts.
 * No commercial transition is possible from this gate.
 *
 * The host must provide a durable, transactional claimOnce(key, ttlMs) which
 * inserts a unique key atomically across workers/processes, returning true
 * only for the first claim. An in-memory Set is NOT production safe.
 */
import { createHash } from 'node:crypto';
const valid = x => typeof x === 'string' && x.trim().length > 0;
const hold = code => Object.freeze({status:'HOLD', reason:code, commercialTransitionAuthorized:false});
export function createReplayGuard({ provenanceGate, claimOnce, namespace='agentz-commercial-attestation-v1', ttlMs=172800000 }) {
 if(typeof provenanceGate?.inspect !== 'function') throw Error('host provenance gate required');
 if(typeof claimOnce !== 'function') throw Error('host atomic durable claimOnce required');
 if(!valid(namespace) || !Number.isSafeInteger(ttlMs) || ttlMs < 86400000) throw Error('invalid namespace or TTL');
 return Object.freeze({
  async reserve(request) {
   const checked = provenanceGate.inspect(request);
   if(checked.status !== 'AUTHENTICATED_RECEIPTS_READY_FOR_INDEPENDENT_REVIEW') return hold('provenance_not_authenticated');
   const identifiers = request.receipts.map(r => r.kid+':'+r.signature).sort();
   const key = namespace+':'+createHash('sha256').update(JSON.stringify([
    request.orderId,request.buyerId,request.scopeVersion,request.contentDigest,identifiers
   ])).digest('hex');
   let claimed=false;
   try {claimed = await claimOnce(key,ttlMs) === true;} catch {return hold('durable_replay_store_unavailable');}
   if (!claimed) return hold('receipt_replay_or_claim_unconfirmed');
   return Object.freeze({
    status:'RESERVED_FOR_INDEPENDENT_REVIEW',
    commercialTransitionAuthorized:false,
    replayKeyDigest:'sha256:'+createHash('sha256').update(key).digest('hex')
   });
  }
 });
}
