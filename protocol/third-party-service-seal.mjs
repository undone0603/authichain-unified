/**
 * Fail-closed, offline verification and narrowly scoped interpretation of a
 * third-party SEAL Standard v9 Service SEAL. This is NOT a complete v9 schema
 * validator or AuthiChain's own SEAL issuance. No network access or secrets.
 *
 * A valid EdDSA signature verifies the named issuer's statement; it does not
 * mean the issuer is trusted, that a service is safe, or that payments worked.
 * You MUST supply the externally trusted issuer/subject and a pinned JWKS.
 * SPDX-License-Identifier: Apache-2.0
 */
import { createPublicKey, verify } from 'node:crypto';

const b64url = x => Buffer.from(x).toString('base64url');
function decode64(x, max = 32768) {
  if (typeof x !== 'string' || !/^[A-Za-z0-9_-]+$/.test(x)) throw Error('bad_encoding');
  const raw = Buffer.from(x, 'base64url');
  if (raw.length > max || b64url(raw) !== x) throw Error('bad_encoding');
  return raw;
}
function obj(x) { return x !== null && typeof x === 'object' && !Array.isArray(x) && Object.getPrototypeOf(x) === Object.prototype; }
function check(ok, why) { if (!ok) throw Error(why); }
function uint(x) { return Number.isSafeInteger(x) && x >= 0; }
function noExtraKey(objValue, allowed) { return Object.keys(objValue).every(x => allowed.has(x)); }
const kinds = new Set(['mcp', 'x402']);
const statuses = new Set(['verified', 'unverified']);
const ownerMethods = new Set(['email', 'card', 'file', 'dns', 'house']);
const ratings = new Set(['none', 'bronze', 'silver', 'gold']);

/**
 * Validate the issuer-signed Service SEAL's basic scope, not the unimplemented
 * full v9 trust standing policy. Any standing shown is issuer-reported.
 */
export function inspectServiceSealV9(credential, pinnedJwks, { expectedIssuer, expectedSubject, now = Math.floor(Date.now()/1000) } = {}) {
  try {
    check(typeof credential === 'string' && credential.length < 65536, 'bad_credential');
    check(typeof expectedIssuer === 'string' && /^[a-z0-9.-]+$/.test(expectedIssuer) && expectedIssuer.includes('.'), 'issuer_not_pinned');
    check(typeof expectedSubject === 'string' && /^[A-Za-z0-9_-]{20,128}$/.test(expectedSubject), 'subject_not_pinned');
    check(uint(now), 'clock_invalid');
    const parts = credential.split('.'); check(parts.length === 3, 'bad_jws');
    const header = JSON.parse(decode64(parts[0], 2048).toString('utf8'));
    const payload = JSON.parse(decode64(parts[1]).toString('utf8'));
    check(obj(header) && header.alg === 'EdDSA' && typeof header.kid === 'string' && /^[A-Za-z0-9._-]{1,128}$/.test(header.kid), 'bad_header');
    check(noExtraKey(header, new Set(['alg', 'kid', 'typ'])), 'bad_header');
    check(obj(payload) && payload.iss === expectedIssuer && payload.sub === expectedSubject, 'wrong_issuer_or_subject');
    check(payload.ver === 9 && obj(payload.subject) && payload.subject.kind === 'service', 'unsupported_standard_or_kind');
    check(Array.isArray(payload.subject.interfaces) && payload.subject.interfaces.length > 0 && payload.subject.interfaces.length <= 2 &&
      new Set(payload.subject.interfaces).size === payload.subject.interfaces.length && payload.subject.interfaces.every(x => kinds.has(x)), 'bad_interfaces');
    check(typeof payload.subject.paid === 'boolean' && (payload.subject.interfaces.includes('x402') ? payload.subject.paid : !payload.subject.paid), 'bad_paid_flag');
    check(ratings.has(payload.level), 'bad_level');
    check(uint(payload.iat) && uint(payload.exp) && payload.exp > payload.iat && payload.exp - payload.iat <= 86400, 'bad_expiry');
    check(now + 300 >= payload.iat && now < payload.exp, 'expired_or_future');
    check(obj(payload.owner) && statuses.has(payload.owner.status), 'bad_owner_status');
    if (payload.owner.status === 'verified') check(ownerMethods.has(payload.owner.method) && typeof payload.owner.verified_at === 'string' && !Number.isNaN(Date.parse(payload.owner.verified_at)), 'bad_owner_proof');
    else check(Object.keys(payload.owner).length === 1, 'unverified_owner_with_proof');
    check(obj(payload.listing) && typeof payload.listing.card_url === 'string' && payload.listing.card_url.startsWith('https://') && typeof payload.listing.domain_key === 'string', 'bad_listing');
    check(Array.isArray(payload.evidence) && payload.evidence.length === 1, 'bad_evidence');
    const ev = payload.evidence[0];
    check(obj(ev) && (payload.subject.interfaces.includes('x402') ? ev.type === 'x402_check' : ev.type === 'mcp_check'), 'evidence_interface_mismatch');
    if (ev.type === 'x402_check') {
      check(ev.unpaid_only === true && uint(ev.checks_total) && uint(ev.challenge_valid) && ev.challenge_valid <= ev.checks_total, 'invalid_x402_evidence');
      check(obj(ev.wallet) && typeof ev.wallet.proven === 'boolean' && obj(ev.price), 'invalid_x402_scoping');
    } else {
      check(ev.no_tool_calls === true && uint(ev.checks_total) && uint(ev.checks_ok) && ev.checks_ok <= ev.checks_total, 'invalid_mcp_evidence');
    }
    check(obj(pinnedJwks) && Array.isArray(pinnedJwks.keys) && pinnedJwks.keys.length > 0 && pinnedJwks.keys.length <= 16, 'no_pinned_keys');
    const matching = pinnedJwks.keys.filter(k => obj(k) && k.kid === header.kid && k.kty === 'OKP' && k.crv === 'Ed25519' && k.alg === 'EdDSA' && !('d' in k));
    check(matching.length === 1 && decode64(matching[0].x, 64).length === 32, 'missing_or_untrusted_key');
    const key = createPublicKey({ key: {kty: 'OKP', crv: 'Ed25519', x: matching[0].x}, format: 'jwk'});
    check(verify(null, Buffer.from(parts[0] + '.' + parts[1]), key, decode64(parts[2], 128)), 'bad_signature');
    // Do not convert issuer's Bronze/Gold to an AuthiChain-issued credential.
    return {
      signature_valid: true,
      issuer: payload.iss,
      subject_id: payload.sub,
      signed_at: payload.iat,
      expires_at: payload.exp,
      owner_verified_claim: payload.owner.status === 'verified',
      issuer_reported_level: payload.level,
      kind: 'service',
      interface: ev.type === 'mcp_check' ? 'mcp' : 'x402',
      observed_checks: ev.checks_total,
      declared_unpaid_only: ev.type === 'x402_check',
      declared_no_tool_calls: ev.type === 'mcp_check',
      wallet_proven_claim: ev.type === 'x402_check' ? ev.wallet.proven : null,
      limitations: 'Only signature and narrow evidence scope checked; no independent audit, no paid response/tool execution or full SEAL v9 schema/standing conformance.'
    };
  } catch(e) {
    return {signature_valid:false,reason:e?.message||'invalid',limitations:'Fail closed; do not publish issuer standing or verified badge.'};
  }
}
