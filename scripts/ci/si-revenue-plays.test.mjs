import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, run, url } from '../growth/si-revenue-plays.mjs';
const now = new Date('2026-11-12T12:00:00Z');
const official = () => ({ id:'dpp-fact', lane:'passport', kind:'official', review:'source_checked',
  claim:'EU DPP battery timing requires checking product scope',
  source:'https://single-market-economy.ec.europa.eu/single-market/digital-product-passport_en',
  observed:'2026-11-12', support:[] });
test('source-reviewed DPP yields a drafted free check, not an actual sale', () => {
  const a=evaluate(official(),now);
  assert.equal(a.next,'draft_source_cited_DPP_guide');
  assert.match(a.cta,/authichain\.com\/dpp-check/);
  assert.equal(a.sent,0);assert.equal(a.verified_customers,0);
});
test('AI-only claims stay quarantined even when read by the operator', () => {
  const a=evaluate({...official(),kind:'ai_generated',review:'source_checked'},now);
  assert.equal(a.next,'fact_check_only');assert.equal(a.evidence_gate,'research_only');
});
test('AI claim promotion still explicitly carries self-attested review', () => {
  const a=evaluate({...official(),kind:'ai_generated',review:'independently_reproduced',support:['https://eur-lex.europa.eu/eli/reg/2024/1781/oj']},now);
  assert.equal(a.review_is_self_attested,true);
});
test('public tenders never imply email consent', () => {
  assert.throws(()=>evaluate({...official(),buyer:{type:'published_tender',url:'https://ted.europa.eu/en/notice/123',opt_in:true}},now),/cannot imply consent/);
  const a=evaluate({...official(),buyer:{type:'published_tender',url:'https://ted.europa.eu/en/notice/123',opt_in:false}},now);
  assert.equal(a.next,'review_public_tender_no_contact');
});
test('inbound opt-in only permits a reply DRAFT', () => {
  const a=evaluate({...official(),buyer:{type:'inbound_opt_in',url:'https://authichain.com/dpp-check',opt_in:true}},now);
  assert.equal(a.next,'draft_consent_based_reply');assert.equal(a.sent,0);
});
test('existing x402 and QRON offer paths do not make paid calls', () => {
  for (const [lane,host] of [['agent','signal.authichain.com'],['qron','authichain.com']]) {
    const a=evaluate({...official(),lane},now);assert.equal(new URL(a.cta).hostname,host);assert.equal(a.paid_calls,0);
  }
});
test('stale sources fail the promotion gate',()=>{
  const a=evaluate({...official(),observed:'2025-01-01'},now);assert.equal(a.evidence_gate,'research_only');
});
test('unsafe URLs and invalid opt-in are rejected',()=>{
  for(const x of ['http://example.org','https://localhost/','https://127.0.0.1/','https://a:b@example.org/','https://example.org/?api_key=secret'])assert.throws(()=>url(x));
});
test('ranked report has stable SHA and no fabricated revenue',()=>{
  const x=run({version:1,signals:[{...official(),id:'second',kind:'ai_generated'},official()]},now);
  assert.equal(x.actions[0].id,'dpp-fact');assert.match(x.actions[0].sha256,/^[a-f0-9]{64}$/);
  assert.deepEqual(x.totals,{reviewed_drafts:1,research_holds:1,paid_customers:0,sends:0,charges:0});
  assert.throws(()=>run({version:1,signals:[official(),official()]},now),/Duplicate/);
});
