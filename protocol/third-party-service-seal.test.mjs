import test from 'node:test';
import assert from 'node:assert/strict';
import { generateKeyPairSync, sign } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { inspectServiceSealV9 } from './third-party-service-seal.mjs';

const { publicKey, privateKey } = generateKeyPairSync('ed25519');
const pub = publicKey.export({ format: 'jwk' });
const keys = { keys: [{ kid: 'test-v9', kty: 'OKP', crv: 'Ed25519', alg: 'EdDSA', x: pub.x }] };
const iss = 'peer.example', sub = 'test-service-sub-1234567890', iat = 1794000000;
const base = {
  iss, sub, ver: 9, iat, exp: iat + 3600, agent_version: '1',
  subject: { kind: 'service', interfaces: ['x402'], paid: true },
  level: 'bronze', scores: {}, counts: {}, counted: {}, fingerprint: null,
  routine_fingerprint: null, state: 'matches', trust: 0, top_categories: [],
  operator: { verified: false }, identity: [], last_active: null, dormant_days: null,
  owner: { status: 'unverified' },
  listing: { handle: 'peer.example/example', domain_key: 'peer.example', card_url: 'https://peer.example/.well-known/x402' },
  evidence: [{ type: 'x402_check', unpaid_only: true, checks_total: 6, challenge_valid: 6, wallet: { proven: false }, price: {} }]
};
const enc = x => Buffer.from(JSON.stringify(x)).toString('base64url');
function signed(payload = base, header = { alg: 'EdDSA', kid: 'test-v9' }) {
  const signingInput = enc(header) + '.' + enc(payload);
  return signingInput + '.' + sign(null, Buffer.from(signingInput), privateKey).toString('base64url');
}
const run = (payload = base, opts = {}) => inspectServiceSealV9(signed(payload), keys, { expectedIssuer: iss, expectedSubject: sub, now: iat + 1, ...opts });
test('pinned signature proves only issuer-reported unpaid x402 check', () => {
  const x = run();
  assert.equal(x.signature_valid, true);
  assert.equal(x.declared_unpaid_only, true);
  assert.equal(x.wallet_proven_claim, false);
  assert.match(x.limitations, /no paid response/);
});
test('wrong or missing expected issuer and subject fail closed', () => {
  assert.equal(run(base, { expectedIssuer: 'attacker.example' }).signature_valid, false);
  assert.equal(run(base, { expectedSubject: 'other-service-sub-123456789' }).signature_valid, false);
  assert.equal(inspectServiceSealV9(signed(), keys, { expectedSubject: sub, now: iat + 1 }).signature_valid, false);
});
test('expiry, future issuance, and excessive lifetime rejected', () => {
  assert.equal(run(base, { now: iat + 3600 }).signature_valid, false);
  assert.equal(run(base, { now: iat - 301 }).signature_valid, false);
  assert.equal(run({ ...base, exp: iat + 86401 }).signature_valid, false);
});
test('tampered payload and invalid signature rejected', () => {
  const parts = signed().split('.');
  const modified = { ...base, owner: { status: 'verified', method: 'dns', verified_at: '2026-11-01T00:00:00Z' } };
  parts[1] = enc(modified);
  assert.equal(inspectServiceSealV9(parts.join('.'), keys, { expectedIssuer: iss, expectedSubject: sub, now: iat+1 }).signature_valid, false);
  parts[1] = signed().split('.')[1]; parts[2] = Buffer.alloc(64).toString('base64url');
  assert.equal(inspectServiceSealV9(parts.join('.'), keys, { expectedIssuer: iss, expectedSubject: sub, now: iat+1 }).signature_valid, false);
});
test('wrong algorithm, remote key discovery, and missing kid rejected', () => {
  const opts = { expectedIssuer: iss, expectedSubject: sub, now: iat+1 };
  assert.equal(inspectServiceSealV9(signed(base, { alg: 'HS256', kid: 'test-v9' }), keys, opts).signature_valid, false);
  assert.equal(inspectServiceSealV9(signed(base, { alg: 'EdDSA', kid: 'test-v9', jku: 'https://attacker.example' }), keys, opts).signature_valid, false);
  assert.equal(inspectServiceSealV9(signed(), { keys: [] }, opts).signature_valid, false);
});
test('unpaid-only and MCP no-tool-call limits enforced', () => {
  assert.equal(run({ ...base, evidence: [{ ...base.evidence[0], unpaid_only: false }] }).signature_valid, false);
  assert.equal(run({ ...base, subject: { kind: 'service', interfaces: ['x402'], paid: false } }).signature_valid, false);
  const mcp = { ...base, subject: { kind: 'service', interfaces: ['mcp'], paid: false },
    evidence: [{ type: 'mcp_check', no_tool_calls: true, checks_total: 2, checks_ok: 2 }] };
  assert.equal(run(mcp).signature_valid, true);
  assert.equal(run({ ...mcp, evidence: [{ ...mcp.evidence[0], no_tool_calls: false }] }).signature_valid, false);
});
test('no invented independent certification based on signed owner field', () => {
  const x = run({ ...base, owner: { status: 'verified', method: 'email', verified_at: '2026-11-01T00:00:00Z' } });
  assert.equal(x.signature_valid, true);
  assert.equal(x.owner_verified_claim, true);
  assert.match(x.limitations, /no independent audit/);
});
test('public, third-party SealKeeper snapshot verifies historically but not after expiry', () => {
  const fixture = JSON.parse(readFileSync(new URL('./fixtures/sealkeeper-x402-public-snapshot-20261107.json', import.meta.url), 'utf8'));
  const subject = 'nzfO6WZVv2Adb_YNv9rJTcavydNDE-T9ybHAyubvrYc';
  const atIssuance = inspectServiceSealV9(fixture.credential, fixture.jwks,
    { expectedIssuer: 'sealkeeper.run', expectedSubject: subject, now: 1794013749 });
  assert.equal(atIssuance.signature_valid, true);
  assert.equal(atIssuance.declared_unpaid_only, true);
  assert.equal(atIssuance.wallet_proven_claim, false);
  const afterExpiry = inspectServiceSealV9(fixture.credential, fixture.jwks,
    { expectedIssuer: 'sealkeeper.run', expectedSubject: subject, now: 1794100148 });
  assert.equal(afterExpiry.signature_valid, false);
});
