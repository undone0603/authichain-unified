/** AgentZ pure, read-only sales-to-WIN evidence gates. No connectors, charge, send, or CRM writes. */
import { createHash } from 'node:crypto';
const okText = x => typeof x === 'string' && !!x.trim();
const evidence = x => x && okText(x.id) && /^https:\/\//.test(x.evidenceUrl || '') && Number.isFinite(Date.parse(x.observedAt)) && x.verifiedBy !== 'agent_claim_only';
export const PRICES = Object.freeze({ mcp_connect:150000, a2a_connect:150000, mcp_a2a_launch:250000 });
export function qualifyBuyer(b = {}) {
 const missing = [];
 if (!okText(b.buyerCompany) || !okText(b.buyerContact)) missing.push('identified_buyer');
 if (!evidence(b.humanReply) || b.humanReply.kind !== 'human' || b.humanReply.expressedNeed !== true) missing.push('human_expressed_need');
 if (!evidence(b.budgetEvidence) || b.budgetEvidence.approved !== true || b.budgetEvidence.currency !== 'USD' || !Number.isInteger(b.budgetEvidence.approvedCents) || b.budgetEvidence.approvedCents < 150000) missing.push('approved_budget');
 if (!evidence(b.authorityEvidence) || b.authorityEvidence.canCommit !== true) missing.push('authorized_purchaser');
 if (!okText(b.suppressionCheckedAt) || !Number.isFinite(Date.parse(b.suppressionCheckedAt)) || b.doNotContact !== false) missing.push('contact_eligibility');
 return { status: missing.length ? 'UNVERIFIED' : 'EVIDENCE_CONSISTENT_UNATTESTED', missing:missing.length?missing:['authoritative_buyer_confirmation_required'], sendAuthorized:false, paymentAuthorized:false };
}
export function quoteReadiness(q = {}) {
 const missing = [...qualifyBuyer(q.buyerEvidence).missing];
 if (!PRICES[q.packageId] || q.priceCents !== PRICES[q.packageId]) missing.push('package_price');
 if (!evidence(q.sowAcceptance) || q.sowAcceptance.accepted !== true || q.sowAcceptance.scopeVersion !== q.scopeVersion) missing.push('accepted_sow');
 if (q.operatorHoldReleased !== true || q.productionSendEnabled !== true) missing.push('outbound_authorization');
 return { status:'HOLD', missing:missing.length?missing:['independently_authenticated_authorization_required'], createsCharge:false };
}
export function reconcilePaidFulfillment(x = {}) {
 const missing=[]; const expected=PRICES[x.packageId];
 if (!expected) missing.push('known_offer');
 if (!evidence(x.buyerAuthorization) || x.buyerAuthorization.accepted !== true) missing.push('buyer_authorization');
 if (!evidence(x.checkoutEvidence) || x.checkoutEvidence.status !== 'complete' || x.checkoutEvidence.payment_status !== 'paid' || x.checkoutEvidence.amount_total !== expected || !okText(x.checkoutEvidence.payment_intent)) missing.push('nonzero_checkout_linked_to_pi');
 if (!evidence(x.paymentIntentEvidence) || x.paymentIntentEvidence.id !== x.checkoutEvidence?.payment_intent || x.paymentIntentEvidence.status !== 'succeeded' || x.paymentIntentEvidence.amount_received !== expected) missing.push('succeeded_payment_intent');
 if (!evidence(x.balanceTransactionEvidence) || x.balanceTransactionEvidence.source !== x.paymentIntentEvidence?.latest_charge || x.balanceTransactionEvidence.status !== 'available' || !(x.balanceTransactionEvidence.amount > 0)) missing.push('available_balance');
 if (!evidence(x.nonFounderEvidence) || x.nonFounderEvidence.independentBuyer !== true || x.nonFounderEvidence.buyerId !== x.buyerAuthorization?.buyerId) missing.push('outside_buyer');
 if (!evidence(x.fulfillmentEvidence) || x.fulfillmentEvidence.accepted !== true || !/^sha256:[0-9a-f]{64}$/.test(x.fulfillmentEvidence.artifactSha256 || '')) missing.push('accepted_fulfillment_digest');
 if (!evidence(x.payoutEvidence) || x.payoutEvidence.status !== 'paid' || x.payoutEvidence.reconciledToBank !== true || !(x.payoutEvidence.amount > 0)) missing.push('reconciled_bank_payout');
 // Input evidence may be wholly fabricated by the caller; only an independent authenticated verifier can attest a WIN.\n return { status:missing.length?'UNVERIFIED':'EVIDENCE_CONSISTENT_UNATTESTED', win:false, missing:missing.length?missing:['authoritative_source_and_bank_attestation_required'], automaticCrmClose:false };
}
export const evidenceDigest = value => 'sha256:' + createHash('sha256').update(JSON.stringify(value)).digest('hex');
