import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtempSync, writeFileSync, symlinkSync, rmSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { validatePhysicalEvidenceIntake as check, EVIDENCE_ONLY } from './physical-evidence-intake.mjs';
const hash = b => createHash('sha256').update(b).digest('hex');
function fixture(t) {
  const rootDir = mkdtempSync(path.join(tmpdir(), 'trumark-gate-'));
  t.after(() => rmSync(rootDir, { recursive: true, force: true }));
  const capture = Buffer.from('SYNTHETIC NONCE MEDIA; NOT A REAL PHYSICAL OBJECT');
  const report = Buffer.from('SYNTHETIC EXAMINER REPORT; NOT A REAL ASSAY');
  writeFileSync(path.join(rootDir, 'capture.bin'), capture);
  writeFileSync(path.join(rootDir, 'report.bin'), report);
  const manifest = {
    schemaVersion: 'authichain.trumark.physical-evidence-intake.v0.1',
    observationId: 'urn:authichain:pilot:synthetic-unit-0001',
    challenge: { id: 'synthetic-challenge-001', nonce: 'TRM-0123456789ABCDEF0123456789ABCDEF', nonceObserved: 'TRM-0123456789ABCDEF0123456789ABCDEF', issuedAt: '2026-11-20T20:00:00Z', expiresAt: '2026-11-23T20:00:00Z', capturedAt: '2026-11-21T20:00:00Z', media: { file: 'capture.bin', sha256: hash(capture) } },
    examiner: { business: 'SYNTHETIC TEST EXAMINER — NOT REAL', person: 'Synthetic Examiner', attributionReference: 'https://example.invalid/synthetic', examinedAt: '2026-11-21T21:00:00Z' },
    method: { name: 'synthetic optics', instrument: 'synthetic device', packagingState: 'sealed', scope: 'synthetic external surface only', limitations: 'no elemental identity measurement' },
    report: { claimedIssuer: 'Synthetic Examiner', scope: 'synthetic', limitations: 'not material proof', findings: 'Synthetic only', evidence: { file: 'report.bin', sha256: hash(report) } },
    status: EVIDENCE_ONLY,
  };
  return { manifest, rootDir };
}
const validate = (m, r) => check(m, { rootDir: r, now: '2026-11-22T00:00:00Z' });
test('complete synthetic intake accepts byte integrity but never physical authenticity', t => {
  const { manifest, rootDir } = fixture(t); const res = validate(manifest, rootDir);
  assert.equal(res.accepted, true); assert.equal(res.status, EVIDENCE_ONLY);
  assert.equal(res.physicalAuthenticity, 'NOT_ESTABLISHED'); assert.equal(res.examinerAuthority, 'UNREVIEWED');
  assert.equal(res.nextGate, 'INDEPENDENT_EXAMINER_AND_ISSUER_REVIEW');
});
test('modified examiner report bytes are rejected', t => {
  const { manifest, rootDir } = fixture(t); writeFileSync(path.join(rootDir,'report.bin'), 'tampered');
  assert.ok(validate(manifest, rootDir).errors.includes('report_sha256_mismatch'));
});
test('modified capture bytes are rejected', t => {
  const { manifest, rootDir } = fixture(t); writeFileSync(path.join(rootDir,'capture.bin'), 'tampered');
  assert.ok(validate(manifest, rootDir).errors.includes('capture_sha256_mismatch'));
});
test('nonce substitution is rejected', t => {
  const { manifest, rootDir } = fixture(t); manifest.challenge.nonceObserved = 'TRM-FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF';
  assert.ok(validate(manifest, rootDir).errors.includes('capture_nonce_not_reported'));
});
test('expired and pre-issuance captures are rejected', t => {
  const { manifest, rootDir } = fixture(t);
  manifest.challenge.capturedAt = '2026-11-25T00:00:00Z';
  assert.ok(validate(manifest, rootDir).errors.includes('challenge_time_order_invalid'));
  manifest.challenge.capturedAt = '2026-11-18T00:00:00Z';
  assert.ok(validate(manifest, rootDir).errors.includes('challenge_time_order_invalid'));
});
test('date and schema manipulation fail closed', t => {
  const { manifest, rootDir } = fixture(t);
  manifest.challenge.issuedAt = 'tomorrow'; manifest.schemaVersion = 'garbage';
  const res = validate(manifest, rootDir); assert.ok(res.errors.includes('issued_time_invalid')); assert.ok(res.errors.includes('invalid_schema'));
});
test('self-authenticated claim and forged verified status rejected', t => {
  const { manifest, rootDir } = fixture(t);
  manifest.manufacturerAuthenticated = true; manifest.status = 'VERIFIED';
  const res = validate(manifest, rootDir);
  assert.ok(res.errors.includes('self_authentication_forbidden')); assert.ok(res.errors.includes('verification_status_forbidden'));
});
test('report cannot self-authorize examiner or physical authenticity', t => {
  const { manifest, rootDir } = fixture(t); manifest.report.physicalAuthenticityProven = true;
  assert.ok(validate(manifest, rootDir).errors.includes('self_authentication_forbidden'));
});
test('missing examiner and methodology fail closed', t => {
  const { manifest, rootDir } = fixture(t); manifest.examiner.person = ''; manifest.method.limitations = '';
  const res = validate(manifest, rootDir); assert.ok(res.errors.includes('examiner_person_required')); assert.ok(res.errors.includes('method_limitations_required'));
});
test('missing report bytes are rejected', t => {
  const { manifest, rootDir } = fixture(t); rmSync(path.join(rootDir,'report.bin'));
  assert.ok(validate(manifest, rootDir).errors.some(e => e.startsWith('report_file_')));
});
test('path traversal is rejected, even with a fabricated matching hash', t => {
  const { manifest, rootDir } = fixture(t); manifest.report.evidence.file = '../outside.txt';
  assert.ok(validate(manifest, rootDir).errors.includes('report_file_unsafe_relative_path'));
});
test('symlink escape is rejected', t => {
  const { manifest, rootDir } = fixture(t); symlinkSync('/etc/hosts', path.join(rootDir,'escape.txt'));
  manifest.report.evidence.file = 'escape.txt';
  assert.ok(validate(manifest, rootDir).errors.includes('report_file_file_outside_evidence_root'));
});
test('distinct report and capture evidence required', t => {
  const { manifest, rootDir } = fixture(t); manifest.report.evidence.file = 'capture.bin';
  assert.ok(validate(manifest, rootDir).errors.includes('evidence_paths_must_be_distinct'));
});
test('untrusted missing or wrong-shape manifest fails closed', t => {
  const { rootDir } = fixture(t);
  for (const m of [null, undefined, [], false]) { const res = validate(m, rootDir); assert.equal(res.accepted, false); assert.equal(res.status, EVIDENCE_ONLY); }
});
test('does not echo raw serials or private report text', t => {
  const { manifest, rootDir } = fixture(t); manifest.privateSerial = 'DO_NOT_DISCLOSE_012345';
  const s = JSON.stringify(validate(manifest, rootDir));
  assert.ok(!s.includes('DO_NOT_DISCLOSE')); assert.ok(!s.includes('Synthetic Examiner'));
});
test('examiner claim without report limitations is not accepted', t => {
  const { manifest, rootDir } = fixture(t); manifest.report.limitations = '';
  assert.ok(validate(manifest, rootDir).errors.includes('report_limitations_required'));
});
