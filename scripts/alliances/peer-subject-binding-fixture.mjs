/**
 * Offline peer fixture: maps pre-verified *synthetic* assertions into distinct
 * interoperability outcomes. Does NOT perform cryptographic verification,
 * HTTP, payment, chain lookup, or production entitlement mutation.
 */
import { timingSafeEqual } from 'node:crypto';

function equalDigest(a, b) {
  if (typeof a !== 'string' || typeof b !== 'string' ||
      !/^[a-f0-9]{64}$/i.test(a) || !/^[a-f0-9]{64}$/i.test(b)) return false;
  return timingSafeEqual(Buffer.from(a.toLowerCase(), 'hex'), Buffer.from(b.toLowerCase(), 'hex'));
}
function sameSubject(a, b) {
  return typeof a === 'string' && typeof b === 'string' &&
    a.length > 0 && a.length <= 256 && a === b;
}

/** Inputs are trusted *fixture declarations*, never evidence of real signatures or payments. */
export function evaluatePeerFixture(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) throw new TypeError('fixture object required');
  const { requestedSubject, requestedDigest, record, work, settlement } = input;
  if (!record || typeof record !== 'object' || !work || typeof work !== 'object' ||
      !settlement || typeof settlement !== 'object') throw new TypeError('record, work and settlement objects required');
  const integrity = record.syntheticSignatureValid === true;
  const subjectMatched = sameSubject(requestedSubject, record.subject) &&
    equalDigest(requestedDigest, record.digest);
  const workAccepted = integrity && subjectMatched &&
    work.syntheticSignedReceiptValid === true && work.explicitlyAccepted === true &&
    sameSubject(requestedSubject, work.subject) && equalDigest(requestedDigest, work.digest);
  // This synthetic flag models the *absence/presence* of an independently checked
  // settlement receipt; it cannot be inferred from a signed work receipt.
  const settlementConfirmed = workAccepted && settlement.syntheticIndependentConfirmation === true &&
    sameSubject(requestedSubject, settlement.subject) &&
    equalDigest(requestedDigest, settlement.digest);
  return Object.freeze({
    RECORD_INTEGRITY_VALID: integrity,
    SUBJECT_MATCHED: subjectMatched,
    WORK_ACCEPTED: workAccepted,
    SETTLEMENT_CONFIRMED: settlementConfirmed,
    DELIVERY_VERIFIED: workAccepted,
    PAYMENT_SETTLED: settlementConfirmed,
    fixtureOnly: true,
    independentMcpIntegrationAccepted: false,
    externalPaidAdoptionCounted: false,
  });
}
