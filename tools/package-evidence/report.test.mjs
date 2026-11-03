import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildPackageEvidenceReport } from './report.mjs';

const base = () => ({ case_id: 'CASE_001', issuer_authorized: false, files: [], observations: [], qr_observations: [], coa_documents: [] });
const codes = r => r.flags.map(f => f.code);

test('observation-only report never authenticates a sample', async () => {
  const result = await buildPackageEvidenceReport(base());
  assert.equal(result.authentication_status, 'NOT_AUTHENTICATED');
  assert.equal(result.counterfeit_determination, 'NOT_DETERMINED');
  assert.equal(result.intake.ready_to_issue_passport, false);
  assert.ok(codes(result).includes('ISSUER_AUTHORIZATION_REQUIRED'));
  assert.ok(codes(result).includes('COA_REQUIRED'));
  assert.match(result.report_sha256, /^[0-9a-f]{64}$/);
});

test('reports raw media digest, redacts identifiers, and detects hash mismatch', async () => {
  const root = await mkdtemp(join(tmpdir(), 'authi-evidence-'));
  try {
    await writeFile(join(root, 'pouch.jpg'), 'example-media-bytes');
    const i = base();
    i.files = [{ id: 'pouch', kind: 'photo', path: 'pouch.jpg', sha256: '0'.repeat(64) }];
    i.observations = [{ source_id: 'pouch', field: 'package_tracking_id', scope: 'pouch', value: 'PRIVATE-PKG-0123456789' }];
    const r = await buildPackageEvidenceReport(i, { root });
    assert.equal(r.files[0].status, 'HASHED');
    assert.ok(codes(r).includes('FILE_HASH_MISMATCH'));
    assert.equal(r.observations[0].observed, '…6789');
    assert.ok(!JSON.stringify(r).includes('PRIVATE-PKG'));
  } finally { await rm(root, { recursive: true, force: true }); }
});

test('different detached-label identifiers demand reconciliation, not counterfeit verdict', async () => {
  const i = base();
  i.files = [{id:'a',kind:'photo',path:'a.jpg'},{id:'b',kind:'photo',path:'b.jpg'}];
  i.observations = [
    { source_id:'a',field:'package_tracking_id',scope:'pouch',value:'PKG-0256' },
    { source_id:'b',field:'package_tracking_id',scope:'detached_label',value:'PKG-0494' }
  ];
  const r = await buildPackageEvidenceReport(i);
  assert.ok(codes(r).includes('CROSS_SCOPE_RECONCILIATION_REQUIRED'));
  assert.equal(r.counterfeit_determination, 'NOT_DETERMINED');
});

test('QR URL cannot confer issuer authentication', async () => {
  const i = base();
  i.qr_observations = [{ source_id: 'pouch', decoded_payload: 'https://example.org/verify?id=untrusted' }];
  const r = await buildPackageEvidenceReport(i);
  assert.ok(codes(r).includes('QR_NOT_AUTHORITY'));
  assert.equal(r.qr[0].issuer_verified, false);
  assert.equal(r.qr[0].scheme, 'https');
  assert.ok(!JSON.stringify(r).includes('untrusted'));
});

test('issuer permission and supplied CoA still do not constitute signed issuance', async () => {
  const i = base(); i.issuer_authorized = true; i.coa_documents = ['COA_001'];
  const r = await buildPackageEvidenceReport(i);
  assert.equal(r.intake.coa_supplied, true);
  assert.equal(r.intake.ready_to_issue_passport, false);
  assert.equal(r.issuer_attestation_verified, false);
});

test('rejects invalid or duplicate source IDs and path traversal', async () => {
  await assert.rejects(buildPackageEvidenceReport({ ...base(), case_id: '../bad' }), /Invalid case_id/);
  await assert.rejects(buildPackageEvidenceReport({ ...base(), files: [{id:'x',path:'a'}, {id:'x',path:'b'}] }), /duplicate/);
  const r = await buildPackageEvidenceReport({ ...base(), files: [{id:'x',path:'../secret'}] });
  assert.ok(codes(r).includes('FILE_UNAVAILABLE'));
});
