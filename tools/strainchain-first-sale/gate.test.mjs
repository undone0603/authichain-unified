import test from 'node:test';
import assert from 'node:assert/strict';
import {assessFirstPassportSale, PASSPORT_PRICE_ID} from './gate.mjs';
const privateRef = 'private:reviewed-document-001';
const hash = 'a'.repeat(64);
const base = () => ({
  session:{id:'cs_live_sample001',livemode:true,status:'complete',payment_status:'paid',mode:'payment',subscription:null,amount_total:4900,currency:'usd',payment_intent:'pi_123',customer_details:{email:'buyer@independent.example'}},
  lineItems:[{quantity:1,price:{id:PASSPORT_PRICE_ID,unit_amount:4900,currency:'usd'}}],
  charge:{id:'ch_sample001',payment_intent:'pi_123',amount:4900,currency:'usd',status:'succeeded',paid:true,captured:true,refunded:false,disputed:false,amount_refunded:0},
  founderEmails:['founder@authichain.example','@founder.example'],
  buyer:{authority_reviewed:true,evidence_ref:privateRef},
  processor:{written_clearance_reviewed:true,evidence_ref:privateRef},
  issuer:{approved:true,evidence_ref:privateRef,name:'Authorized Cultivar LLC'},
  coaReview:{reviewed:true,evidence_ref:privateRef,source_sha256:[hash]},
  issuedRecord:{verifier_result:'valid-unanchored',subject_id:'https://issuer.example/record/001',sha256:hash,issuer_evidence_ref:privateRef,customer_order_ref:''},
  access:{confirmed_by_buyer:true,subject_id:'https://issuer.example/record/001',evidence_ref:privateRef}
});
const check=(r,name)=>r.checks.find(x=>x.name===name)?.pass;
test('empty evidence always holds, never grants',()=>{
 const r=assessFirstPassportSale();assert.equal(r.state,'PAYMENT_NOT_VERIFIED');assert.equal(r.automatic_issuance_allowed,false);assert.equal(r.customer_sale_verified,false);
});
test('valid format payment still needs issuer and delivery evidence',()=>{
 const i=base();delete i.issuer;delete i.coaReview;
 const r=assessFirstPassportSale(i);assert.equal(r.state,'PAID_HUMAN_REVIEW_REQUIRED');assert.ok(r.next_missing.includes('issuer_permission'));
});
test('rejects unpaid checkout',()=>{const i=base();i.session.payment_status='unpaid';assert.equal(check(assessFirstPassportSale(i),'stripe_session_paid'),false)});
test('rejects zero dollar or discount checkout',()=>{const i=base();i.session.amount_total=0;assert.equal(check(assessFirstPassportSale(i),'stripe_session_paid'),false)});
test('rejects wrong SKU',()=>{const i=base();i.lineItems[0].price.id='price_other';assert.equal(check(assessFirstPassportSale(i),'stripe_exact_price'),false)});
test('rejects multiple item purchase',()=>{const i=base();i.lineItems[0].quantity=2;assert.equal(check(assessFirstPassportSale(i),'stripe_exact_price'),false)});
test('rejects mismatched charge and intent',()=>{const i=base();i.charge.payment_intent='pi_different';assert.equal(check(assessFirstPassportSale(i),'stripe_charge_settled'),false)});
test('rejects refunds, disputes, and incomplete capture',()=>{
 for(const field of ['refunded','disputed']){const i=base();i.charge[field]=true;assert.equal(check(assessFirstPassportSale(i),'stripe_charge_settled'),false)}
 const i=base();i.charge.captured=false;assert.equal(check(assessFirstPassportSale(i),'stripe_charge_settled'),false);
});
test('rejects founder email and domain',()=>{
 const i=base();i.session.customer_details.email='ceo@founder.example';assert.equal(check(assessFirstPassportSale(i),'buyer_identity'),false);
});
test('requires explicit independent buyer proof',()=>{const i=base();i.buyer={};assert.equal(check(assessFirstPassportSale(i),'independent_buyer'),false)});
test('requires processor eligibility review for cannabis SaaS',()=>{const i=base();i.processor={};assert.equal(check(assessFirstPassportSale(i),'processor_clearance'),false)});
test('requires reviewed CoAs and authorized issuer',()=>{
 const i=base();i.coaReview.source_sha256=[];i.issuer.approved=false;const r=assessFirstPassportSale(i);
 assert.equal(check(r,'coa_source_review'),false);assert.equal(check(r,'issuer_permission'),false);
});
test('public protocol demonstration cannot be a buyer passport',()=>{
 const i=base();i.issuedRecord.subject_id='https://authichain.com/protocol/examples/polygon-anchor-1';i.access.subject_id=i.issuedRecord.subject_id;
 assert.equal(check(assessFirstPassportSale(i),'not_protocol_demo'),false);
});
test('buyer must confirm matching independent verifier link',()=>{
 const i=base();i.access.subject_id='https://attacker.example/other';assert.equal(check(assessFirstPassportSale(i),'buyer_access_confirmed'),false);
});
test('all unverified submitted booleans still cannot directly grant or count revenue',()=>{
 const i=base();i.issuedRecord.customer_order_ref='';const r=assessFirstPassportSale(i);
 assert.equal(r.automatic_issuance_allowed,false);assert.equal(r.customer_sale_verified,false);
 assert.ok(r.next_missing.includes('not_protocol_demo'));
});
