import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluatePeerFixture } from './peer-subject-binding-fixture.mjs';

const A = 'a'.repeat(64), B = 'b'.repeat(64);
function fixture() {
  return {
    requestedSubject: 'demo:subject:A', requestedDigest: A,
    record: { syntheticSignatureValid: true, subject: 'demo:subject:A', digest: A },
    work: { syntheticSignedReceiptValid: true, explicitlyAccepted: true, subject: 'demo:subject:A', digest: A },
    settlement: { syntheticIndependentConfirmation: false, subject: 'demo:subject:A', digest: A },
  };
}
test('known-good synthetic subject + digest can accept work, never infer payment', () => {
  const v = evaluatePeerFixture(fixture());
  assert.equal(v.RECORD_INTEGRITY_VALID, true);
  assert.equal(v.SUBJECT_MATCHED, true);
  assert.equal(v.WORK_ACCEPTED, true);
  assert.equal(v.DELIVERY_VERIFIED, true);
  assert.equal(v.SETTLEMENT_CONFIRMED, false);
  assert.equal(v.PAYMENT_SETTLED, false);
  assert.equal(v.independentMcpIntegrationAccepted, false);
});
test('cryptographically-valid *declared* record with wrong subject cannot verify delivery', () => {
  const f = fixture(); f.record.subject = 'demo:subject:B';
  const v = evaluatePeerFixture(f);
  assert.equal(v.RECORD_INTEGRITY_VALID, true);
  assert.equal(v.SUBJECT_MATCHED, false);
  assert.equal(v.DELIVERY_VERIFIED, false);
  assert.equal(v.PAYMENT_SETTLED, false);
});
test('valid declared signature with wrong digest cannot verify delivery', () => {
  const f = fixture(); f.record.digest = B;
  const v = evaluatePeerFixture(f);
  assert.equal(v.RECORD_INTEGRITY_VALID, true);
  assert.equal(v.SUBJECT_MATCHED, false);
  assert.equal(v.WORK_ACCEPTED, false);
});
test('matching subject but unsigned record cannot accept work', () => {
  const f = fixture(); f.record.syntheticSignatureValid = false;
  assert.equal(evaluatePeerFixture(f).WORK_ACCEPTED, false);
});
test('signed work receipt without explicit acceptance cannot verify delivery', () => {
  const f = fixture(); f.work.explicitlyAccepted = false;
  assert.equal(evaluatePeerFixture(f).DELIVERY_VERIFIED, false);
});
test('work receipt for a different subject cannot verify delivery', () => {
  const f = fixture(); f.work.subject = 'demo:subject:B';
  assert.equal(evaluatePeerFixture(f).DELIVERY_VERIFIED, false);
});
test('synthetic settlement confirmation for wrong digest cannot settle', () => {
  const f = fixture(); f.settlement.syntheticIndependentConfirmation = true; f.settlement.digest = B;
  assert.equal(evaluatePeerFixture(f).PAYMENT_SETTLED, false);
});
test('all four synthetic predicates must be separately true for synthetic settlement', () => {
  const f = fixture(); f.settlement.syntheticIndependentConfirmation = true;
  const v = evaluatePeerFixture(f);
  assert.equal(v.PAYMENT_SETTLED, true);
  assert.equal(v.externalPaidAdoptionCounted, false);
  assert.equal(v.fixtureOnly, true);
});
test('unrecognized digest encoding fails closed', () => {
  const f = fixture(); f.requestedDigest = 'not-a-digest';
  assert.equal(evaluatePeerFixture(f).SUBJECT_MATCHED, false);
});
test('missing fixture objects reject rather than defaulting to success', () => {
  assert.throws(() => evaluatePeerFixture({}), TypeError);
});
