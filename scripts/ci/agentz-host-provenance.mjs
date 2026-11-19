/**
 * AuthiChain / AgentZ host-controlled provenance boundary (nonfinancial).
 *
 * Caller data cannot choose trust roots, authentication context, or switch on
 * commercial state transitions. The host must provision independent public
 * keys out-of-band and verify original provider data before signing a receipt.
 * A valid signature attests to a host assertion, not necessarily to the
 * correctness of an upstream provider, banking or buyer record.
 */
import { createHash, createPublicKey, verify, KeyObject } from 'node:crypto';
const sha = v => createHash('sha256').update(v).digest('hex');
const roles = ['buyer', 'payment', 'bank', 'fulfillment'];
const valid = v => typeof v === 'string' && v.length > 0;
function canonical(value) {
 if (value === null || typeof value !== 'object') return JSON.stringify(value);
 if (Array.isArray(value)) return '[' + value.map(canonical).join(',') + ']';
 return '{' + Object.keys(value).sort().map(k => JSON.stringify(k)+':'+canonical(value[k])).join(',') + '}';
}
export const payloadDigest = value => 'sha256:' + sha(canonical(value));
const fail = (reason) => Object.freeze({ status: 'HOLD', reason, commercialTransitionAuthorized: false });
/**
 * Keys are trusted only if supplied to this constructor by the authenticated
 * runtime, NOT by an inbound request, CRM field or tool response.
 * Each key binding has { key: PEM public key, role: role, issuer: stable id }.
 * The host must keep the binding inaccessible to customer-supplied payloads.
 */
export function createHostProvenanceGate({ trustedKeys, audience, maxAgeMs = 86400000, clock = () => Date.now() }) {
 if (!trustedKeys || typeof trustedKeys !== 'object' || !valid(audience)) throw Error('missing trusted host configuration');
 const keyMap = new Map();
 for (const [kid, entry] of Object.entries(trustedKeys)) {
  if (!valid(kid) || !roles.includes(entry?.role) || !valid(entry?.issuer) || !valid(entry?.key)) throw Error('invalid trust binding');
  const key = createPublicKey(entry.key);
  if (!(key instanceof KeyObject) || key.asymmetricKeyType !== 'ed25519') throw Error('Ed25519 public key required');
  keyMap.set(kid, Object.freeze({ key, role: entry.role, issuer: entry.issuer }));
 }
 if (keyMap.size < roles.length || new Set([...keyMap.values()].map(v => v.role)).size !== roles.length) throw Error('one trusted signing key per role required');
 return Object.freeze({
  inspect({ orderId, buyerId, scopeVersion, contentDigest, receipts }) {
   if (![orderId,buyerId,scopeVersion].every(valid) || !/^sha256:[a-f0-9]{64}$/.test(contentDigest || '')) return fail('missing_order_binding');
   if (!Array.isArray(receipts) || receipts.length !== roles.length) return fail('missing_attestation_roles');
   const seen = new Set(); const seenIssuer = new Set();
   for (const envelope of receipts) {
    const { kid, payload, signature } = envelope || {};
    const binding = keyMap.get(kid);
    if (!binding || !payload || !valid(signature) || typeof payload !== 'object') return fail('untrusted_receipt');
    const { role, issuer, audience: aud, orderId: oid, buyerId: bid, scopeVersion: ver, contentDigest: cd, issuedAt } = payload;
    if (role !== binding.role || issuer !== binding.issuer || aud !== audience) return fail('issuer_role_or_audience_mismatch');
    if (seen.has(role) || seenIssuer.has(issuer)) return fail('duplicate_role_or_issuer');
    seen.add(role); seenIssuer.add(issuer);
    if (oid !== orderId || bid !== buyerId || ver !== scopeVersion || cd !== contentDigest) return fail('cross_source_binding_mismatch');
    if (!Number.isSafeInteger(issuedAt) || issuedAt > clock() + 300000 || clock() - issuedAt > maxAgeMs) return fail('expired_or_future_attestation');
    if (!/^([A-Za-z0-9_-]+)$/.test(signature)) return fail('bad_signature');
    const bytes = Buffer.from(signature, 'base64url');
    if (!verify(null, Buffer.from(canonical(payload)), binding.key, bytes)) return fail('invalid_signature');
    if (!valid(payload.providerRecordId) || !/^sha256:[a-f0-9]{64}$/.test(payload.providerRecordDigest||'')) return fail('missing_provider_record');
   }
   if (seen.size !== roles.length) return fail('missing_roles');
   return Object.freeze({
    status: 'AUTHENTICATED_RECEIPTS_READY_FOR_INDEPENDENT_REVIEW',
    receiptRoles: [...seen].sort(),
    contentDigest,
    // An independent authorized operator must verify original provider and
    // bank evidence; cryptographic receipts alone never issue a commercial WIN.
    commercialTransitionAuthorized: false
   });
  }
 });
}
