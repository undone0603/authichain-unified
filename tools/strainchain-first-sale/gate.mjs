/**
 * StrainChain first independently funded $49 passport — conservative evidence gate.
 * Pure and offline. DOES NOT retrieve/validate Stripe signatures, provide
 * processor approval, grant entitlement, sign records, or expose buyer PII.
 * Inputs are only trustworthy when independently obtained by the caller.
 */
import {createHash} from 'node:crypto';

export const PASSPORT_PRICE_ID = 'price_1UHjCZGqTruSqV8T35M6AmoJ';
export const PASSPORT_AMOUNT_CENTS = 4900;
const sha = value => createHash('sha256').update(String(value ?? '')).digest('hex');
const truthyRef = (v, prefix) => typeof v === 'string' && v.startsWith(prefix) && v.length > prefix.length + 6;
const digest = v => typeof v === 'string' && /^[0-9a-f]{64}$/i.test(v);
const trimmedEmail = v => typeof v === 'string' ? v.trim().toLowerCase() : '';
const founder = (email, values) => {
  const list = Array.isArray(values) ? values : [];
  return list.some(v => {
    const f = trimmedEmail(v);
    return f === email || (f.startsWith('@') && email.endsWith(f));
  });
};

/**
 * Returns a diagnostic report, NOT a permission token to issue or charge.
 * Only signed-provider/approved-review evidence is eligible as input.
 * An independent reviewer must inspect original source receipts and approval.
 */
export function assessFirstPassportSale(input = {}) {
  const s = input.session ?? {};
  const c = input.charge ?? {};
  const items = Array.isArray(input.lineItems) ? input.lineItems : [];
  const buyer = input.buyer ?? {};
  const processor = input.processor ?? {};
  const issuer = input.issuer ?? {};
  const coa = input.coaReview ?? {};
  const record = input.issuedRecord ?? {};
  const access = input.access ?? {};
  const checks = [];
  const check = (name, pass, needed) => checks.push({name, pass:pass === true, needed});

  check('stripe_session_paid',
    /^cs_live_[A-Za-z0-9]+$/.test(s.id ?? '') && s.livemode === true &&
    s.status === 'complete' && s.payment_status === 'paid' && s.mode === 'payment' &&
    !s.subscription && s.amount_total === PASSPORT_AMOUNT_CENTS &&
    String(s.currency ?? '').toLowerCase() === 'usd',
    'Completed positive-amount Stripe live payment-mode session for exactly $49');
  const price = items[0]?.price;
  check('stripe_exact_price', items.length === 1 && items[0]?.quantity === 1 &&
    price?.id === PASSPORT_PRICE_ID && price?.unit_amount === PASSPORT_AMOUNT_CENTS &&
    String(price?.currency ?? '').toLowerCase() === 'usd',
    'Provider-fetched line item: one exact canonical $49 passport price');
  check('stripe_charge_settled', /^ch_[A-Za-z0-9]+$/.test(c.id ?? '') &&
    typeof s.payment_intent === 'string' && c.payment_intent === s.payment_intent &&
    c.status === 'succeeded' && c.paid === true && c.captured === true &&
    c.refunded !== true && c.disputed !== true && (c.amount_refunded ?? 0) === 0 &&
    c.amount === PASSPORT_AMOUNT_CENTS && String(c.currency ?? '').toLowerCase() === 'usd',
    'Provider-fetched succeeded/captured $49 charge matching session payment intent');
  const email = trimmedEmail(s.customer_details?.email ?? s.customer_email);
  check('buyer_identity', email.includes('@') && !founder(email, input.founderEmails),
    'Real buyer identity must be obtained from Stripe and excluded from founder list');
  check('independent_buyer', buyer.authority_reviewed === true &&
    truthyRef(buyer.evidence_ref, 'private:'),
    'Independent buyer authority checked by human against private evidence');
  check('processor_clearance', processor.written_clearance_reviewed === true &&
    truthyRef(processor.evidence_ref, 'private:'),
    'Written payment-processor eligibility reviewed for this U.S. cannabis SaaS offer');
  check('issuer_permission', issuer.approved === true &&
    truthyRef(issuer.evidence_ref, 'private:') &&
    typeof issuer.name === 'string' && issuer.name.trim().length >= 3,
    'Authorized issuer consent, signer and publishable fields reviewed');
  check('coa_source_review', coa.reviewed === true &&
    Array.isArray(coa.source_sha256) && coa.source_sha256.length > 0 &&
    coa.source_sha256.every(digest) && truthyRef(coa.evidence_ref, 'private:'),
    'Original CoAs, sample/cultivar linkage and panel values reviewed privately');
  check('issuer_signed_passport', record.verifier_result === 'valid-unanchored' ||
    record.verifier_result === 'verified',
    'Existing independent verifier accepted authorized issuer record signature');
  // A known public fixture is not an authorized customer credential.
  const demonstration = /polygon-anchor-1|\/protocol\/examples\//i.test(String(record.subject_id ?? ''));
  check('not_protocol_demo', !demonstration && typeof record.subject_id === 'string' &&
    record.subject_id.startsWith('https://') && digest(record.sha256) &&
    record.issuer_evidence_ref === issuer.evidence_ref &&
    record.customer_order_ref === sha(s.id),
    'Unique signed customer passport, correct issuer approval and session binding');
  check('buyer_access_confirmed', access.confirmed_by_buyer === true &&
    access.subject_id === record.subject_id && truthyRef(access.evidence_ref, 'private:'),
    'Buyer independently opened and confirmed the delivered public verifier URL');

  const payment = checks.slice(0,3).every(x => x.pass);
  const complete = checks.every(x => x.pass);
  return {
    schema: 'strainchain-first-sale-evidence/1',
    session_ref: typeof s.id === 'string' && s.id ? sha(s.id) : null,
    state: !payment ? 'PAYMENT_NOT_VERIFIED'
      : !checks[3].pass ? 'BUYER_IDENTITY_REVIEW'
      : complete ? 'EVIDENCE_COMPLETE_NEEDS_FINAL_INDEPENDENT_AUDIT'
      : 'PAID_HUMAN_REVIEW_REQUIRED',
    customer_sale_verified: false,
    automatic_issuance_allowed: false,
    next_missing: checks.filter(x => !x.pass).map(x => x.name),
    checks,
    caution: 'Policy-only evidence checklist. Verify all original external sources and durable receipt/issuance/activation records before counting customer revenue.',
  };
}
