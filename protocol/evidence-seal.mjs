/**
 * AuthiChain Evidence Credential (AEC) v0.1 — zero-dependency Node reference.
 *
 * This format is NOT SealKeeper's SEAL Standard v9. AEC uses separate keys,
 * a separate schema and a separate trust policy. It is an evidence receipt,
 * NOT a safety, payment, customer, product authenticity or compliance badge.
 *
 * Only independently reviewable evidence references may be placed in a
 * receipt; a signature proves issuer control and content integrity, not the
 * truth of any supplied observation. No online signing endpoint is provided.
 *
 * SPDX-License-Identifier: Apache-2.0
 */
import { createHash, createPublicKey, createPrivateKey, sign, verify } from 'node:crypto';

export const SCHEMA = 'authichain:evidence-credential:v0.1';
export const JWS_TYP = 'AC-EVIDENCE+JWS';
export const POLICY = 'authichain:evidence-boundary:v0.1';
export const MAX_AGE_SECONDS = 86400;
export const MAX_RECEIPT_BYTES = 65536;
const VALID_KINDS = new Set(['mcp_discovery', 'x402_unpaid_challenge', 'signed_record_check']);
const VALID_DECISIONS = new Set(['observed', 'indeterminate']);

function plain(v) { return v !== null && typeof v === 'object' && !Array.isArray(v) && Object.getPrototypeOf(v) === Object.prototype; }
function assert(ok, reason) { if (!ok) throw new Error(reason); }
function isInteger(v) { return Number.isSafeInteger(v) && v >= 0; }
function validSha(s) { return typeof s === 'string' && /^[a-f0-9]{64}$/.test(s); }
function safeUrl(s) {
  if (typeof s !== 'string' || s.length > 2048) return false;
  try { const u = new URL(s); return u.protocol === 'https:' && !!u.hostname && !u.username && !u.password && !u.hash && u.hostname !== 'localhost' && !/^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2[0-9]|3[01])\.)/.test(u.hostname) && ![...u.searchParams.keys()].some(k=>/token|secret|password|api.?key|auth|session|code/i.test(k)); } catch { return false; }
}
function issuerDomain(s) {
  if (!safeUrl(s)) return false;
  const u = new URL(s);
  return u.pathname === '/' && u.search === '';
}
function limitString(s, n=256) { return typeof s === 'string' && s.length > 0 && s.length <= n && !/[\x00-\x1f]/.test(s); }
function b64(bytes) { return Buffer.from(bytes).toString('base64url'); }
function unb64(s) {
  assert(typeof s === 'string' && /^[A-Za-z0-9_-]+$/.test(s), 'malformed_base64url');
  const out = Buffer.from(s, 'base64url');
  assert(b64(out) === s, 'malformed_base64url');
  return out;
}
export function sha256Hex(input) { return createHash('sha256').update(input).digest('hex'); }
export function canonicalize(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number') { assert(Number.isFinite(value) && !Object.is(value, -0), 'non_canonical_number'); return JSON.stringify(value); }
  if (Array.isArray(value)) return '[' + value.map(canonicalize).join(',') + ']';
  assert(plain(value), 'invalid_json_value');
  return '{' + Object.keys(value).sort().map(k => JSON.stringify(k)+':'+canonicalize(value[k])).join(',') + '}';
}
function parseCanonical(encoded) {
  const bytes = unb64(encoded);
  assert(bytes.length < MAX_RECEIPT_BYTES, 'payload_too_large');
  const value = JSON.parse(bytes.toString('utf8'));
  assert(b64(Buffer.from(canonicalize(value))) === encoded, 'non_canonical_json');
  return value;
}
export function validatePayload(p) {
  assert(plain(p) && p.schema === SCHEMA && p.policy === POLICY, 'unsupported_schema');
  assert(Object.keys(p).sort().join(',') === ['schema','policy','iss','sub','jti','iat','exp','issuer_relationship','decision','evidence','limitations'].sort().join(','), 'unexpected_payload_fields');
  assert(issuerDomain(p.iss), 'invalid_issuer');
  assert(safeUrl(p.sub), 'invalid_subject');
  assert(limitString(p.jti, 160) && /^urn:uuid:[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(p.jti), 'invalid_receipt_id');
  assert(isInteger(p.iat) && isInteger(p.exp) && p.exp > p.iat && p.exp - p.iat <= MAX_AGE_SECONDS, 'invalid_lifetime');
  assert(p.issuer_relationship === 'self', 'unverified_independent_claim');
  assert(VALID_DECISIONS.has(p.decision), 'invalid_decision');
  assert(Array.isArray(p.evidence) && p.evidence.length > 0 && p.evidence.length <= 16, 'missing_or_excess_evidence');
  const seen = new Set();
  for (const e of p.evidence) {
    assert(plain(e) && VALID_KINDS.has(e.kind), 'unknown_evidence_kind');
    assert(Object.keys(e).sort().join(',') === ['id','kind','url','sha256','observed_at','collector','scope'].sort().join(','), 'unexpected_evidence_fields');
    assert(limitString(e.id) && !seen.has(e.id), 'invalid_evidence_id'); seen.add(e.id);
    assert(safeUrl(e.url) && validSha(e.sha256), 'invalid_evidence_reference');
    assert(isInteger(e.observed_at) && e.observed_at <= p.iat && p.iat - e.observed_at <= 86400, 'stale_or_future_evidence');
    assert(e.collector === 'issuer', 'unverified_independent_claim');
    assert(e.scope === 'read_only', 'payment_or_side_effect_not_authorized');
  }
  assert(Array.isArray(p.limitations) && p.limitations.length >= 2 && p.limitations.length <= 8, 'missing_limitations');
  assert(p.limitations.every(x=>limitString(x, 300)), 'invalid_limitations');
  assert(p.limitations.some(x=>/self.assert|issuer.assert|self.report/i.test(x)), 'missing_issuer_disclosure');
  assert(p.limitations.some(x=>/not.*(safety|paid|authentic|certif|execution)|do(es)? not prove/i.test(x)), 'missing_scope_disclosure');
  return p;
}
function publicKeys(doc) {
  assert(plain(doc) && Array.isArray(doc.keys) && doc.keys.length <= 16 && doc.keys.length > 0, 'untrusted_or_empty_jwks');
  const seen = new Set();
  return doc.keys.map(k=>{
    assert(plain(k) && limitString(k.kid) && !seen.has(k.kid), 'invalid_or_duplicate_kid');
    seen.add(k.kid);
    assert(k.kty === 'OKP' && k.crv === 'Ed25519' && k.alg === 'EdDSA' && k.use === 'sig', 'invalid_key_type');
    assert(typeof k.x === 'string' && unb64(k.x).length === 32, 'invalid_public_key');
    assert(!('d' in k) && !('key_ops' in k), 'private_key_disclosure');
    return k;
  });
}
export function publicJwks(publicKey, kid) {
  assert(limitString(kid, 80), 'invalid_kid');
  const k = (publicKey?.type === 'public' ? publicKey : createPublicKey(publicKey)).export({format:'jwk'});
  assert(k.kty === 'OKP' && k.crv === 'Ed25519' && typeof k.x === 'string', 'invalid_public_key_type');
  const doc = {keys:[{kty:'OKP',crv:'Ed25519',x:k.x,kid,use:'sig',alg:'EdDSA'}]};
  publicKeys(doc);
  return doc;
}
export function issueEvidenceCredential(payload, {privateKey, kid, jwks}={}) {
  validatePayload(payload);
  assert(limitString(kid, 80), 'invalid_kid');
  assert(privateKey, 'missing_private_key');
  // Fail closed if signer's private key does not match the explicitly pinned public JWKS.
  const keys = publicKeys(jwks);
  const selected = keys.find(k => k.kid === kid);
  assert(selected, 'untrusted_signing_kid');
  const signer = privateKey?.type === 'private' ? privateKey : createPrivateKey(privateKey);
  const pub = createPublicKey(signer).export({format:'jwk'});
  assert(pub.x === selected.x, 'signer_key_mismatch');
  const header = {alg:'EdDSA',kid,typ:JWS_TYP};
  const input = b64(Buffer.from(canonicalize(header)))+'.'+b64(Buffer.from(canonicalize(payload)));
  const signature = sign(null, Buffer.from(input), signer);
  return input+'.'+b64(signature);
}
export function verifyEvidenceCredential(credential, jwks, {expectedIssuer, expectedSubject, now=Math.floor(Date.now()/1000), revokedIds=new Set()}={}) {
  try {
    assert(typeof credential === 'string' && credential.length <= MAX_RECEIPT_BYTES, 'malformed_receipt');
    assert(issuerDomain(expectedIssuer) && safeUrl(expectedSubject), 'missing_expected_identity');
    assert(isInteger(now), 'invalid_clock');
    const p = credential.split('.'); assert(p.length === 3, 'malformed_receipt');
    const header = parseCanonical(p[0]);
    assert(plain(header) && header.alg === 'EdDSA' && header.typ === JWS_TYP && limitString(header.kid), 'invalid_protected_header');
    assert(Object.keys(header).sort().join(',') === 'alg,kid,typ', 'invalid_protected_header');
    const payload = parseCanonical(p[1]); validatePayload(payload);
    assert(payload.iss === expectedIssuer && payload.sub === expectedSubject, 'wrong_issuer_or_subject');
    const key = publicKeys(jwks).find(k=>k.kid === header.kid);
    assert(key, 'unknown_kid');
    const sig=unb64(p[2]); assert(sig.length===64, 'invalid_signature');
    assert(verify(null, Buffer.from(p[0]+'.'+p[1]), createPublicKey({key,format:'jwk'}), sig), 'invalid_signature');
    assert(now + 300 >= payload.iat, 'not_yet_valid');
    assert(now < payload.exp, 'expired');
    assert(!revokedIds.has(payload.jti), 'revoked');
    return {valid:true,reason:null,cryptographic_status:'valid',evidence_verification:'not_performed',issuer_relationship:'self',payload};
  } catch(e) {
    return {valid:false,reason:e?.message ?? 'invalid',cryptographic_status:'invalid_or_untrusted',evidence_verification:'not_performed',payload:null};
  }
}
