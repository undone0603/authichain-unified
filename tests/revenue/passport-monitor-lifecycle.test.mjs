import test from "node:test";
import assert from "node:assert/strict";
import {transition,consumeOne,canVerify,PASSPORT_MONITOR_PRICE_ID} from "./passport-monitor-lifecycle.mjs";
const base={id:"evt_paid001",type:"invoice.paid",customerId:"cus_buyer001",subscriptionId:"sub_buyer001",priceId:PASSPORT_MONITOR_PRICE_ID,invoiceId:"in_paid001",amountPaid:7900,currency:"usd",periodStart:1000,periodEnd:2000};
const paid=()=>transition(null,base);
test("paid invoice activates 300-verification window; zero and unpaid rejected",()=>{
  const a=paid();assert.equal(a.ok,true);assert.equal(a.state.status,"active");assert.equal(canVerify(a.state,1000),true);
  assert.equal(transition(null,{...base,amountPaid:0}).ok,false);
  assert.equal(transition(null,{...base,amountPaid:-1}).ok,false);
  assert.equal(transition(null,{...base,priceId:"price_other"}).ok,false);
});
test("quota hard cap of 300, no access after expiry",()=>{
  let s=paid().state;for(let i=0;i<300;i++){const r=consumeOne(s,1500);assert.equal(r.ok,true);s=r.state;}
  assert.equal(s.used,300);assert.equal(canVerify(s,1500),false);assert.equal(consumeOne(s,1500).ok,false);
  assert.equal(canVerify(paid().state,2000),false);
});
test("duplicate and same-period adjustments cannot reset usage",()=>{
  let s=consumeOne(paid().state,1500).state;
  const duplicate=transition(s,base);assert.equal(duplicate.action,"unchanged");assert.equal(duplicate.state.used,1);
  const adjustment=transition(s,{...base,id:"evt_adjust002",invoiceId:"in_adjust002"});assert.equal(adjustment.action,"unchanged");assert.equal(adjustment.state.used,1);
});
test("new paid renewal resets usage once and stale invoice cannot reset",()=>{
  let s=consumeOne(paid().state,1500).state;
  const renewal={...base,id:"evt_renew002",invoiceId:"in_renew002",periodStart:2000,periodEnd:3000};
  const r=transition(s,renewal);assert.equal(r.ok,true);assert.equal(r.state.used,0);
  assert.equal(transition(r.state,base).reason,"stale_invoice");
  assert.equal(transition(r.state,renewal).action,"unchanged");
});
test("failed invoice suspends access; paid renewal restores",()=>{
  let s=paid().state;
  s=transition(s,{...base,id:"evt_fail002",type:"invoice.payment_failed"}).state;
  assert.equal(s.status,"past_due");assert.equal(canVerify(s,1500),false);
  const renewed=transition(s,{...base,id:"evt_renew003",invoiceId:"in_renew003",periodStart:2000,periodEnd:3000});
  assert.equal(renewed.state.status,"active");
});
test("cancellation terminal; later paid invoice cannot reactivate",()=>{
  const s=transition(paid().state,{...base,id:"evt_cancel002",type:"customer.subscription.deleted"}).state;
  assert.equal(canVerify(s,1500),false);
  assert.equal(transition(s,{...base,id:"evt_renew004",invoiceId:"in_renew004",periodStart:2000,periodEnd:3000}).reason,"cancelled_terminal");
});
test("cross-customer and cross-subscription event fails closed",()=>{
  assert.equal(transition(paid().state,{...base,id:"evt_new002",customerId:"cus_foreign"}).reason,"customer_mismatch");
  assert.equal(transition(paid().state,{...base,id:"evt_new002",subscriptionId:"sub_foreign"}).reason,"subscription_mismatch");
});
test("same-period payment retry restores without resetting quota",()=>{
  let s=consumeOne(paid().state,1500).state;
  s=transition(s,{...base,id:"evt_failure_11",type:"invoice.payment_failed"}).state;
  const restored=transition(s,{...base,id:"evt_retry_12",invoiceId:"in_retry_12"});
  assert.equal(restored.action,"restored");assert.equal(restored.state.status,"active");
  assert.equal(restored.state.used,1);assert.equal(canVerify(restored.state,1500),true);
});
test("malformed and unsupported events cannot create subscription",()=>{
  assert.equal(transition(null,{...base,id:"bad id"}).reason,"invalid_identity");
  assert.equal(transition(null,{...base,type:"customer.subscription.deleted"}).reason,"subscription_not_active");
  assert.equal(transition(null,{...base,type:"customer.subscription.updated"}).reason,"subscription_not_active");
  assert.equal(transition(null,{...base,periodEnd:999}).reason,"unsettled_or_invalid_invoice");
  assert.equal(transition(null,{...base,currency:"eur"}).reason,"unsettled_or_invalid_invoice");
});

test("old-period failure cannot suspend a newly paid renewal",()=>{
  const renewal={...base,id:"evt_renew999",invoiceId:"in_renew999",periodStart:2000,periodEnd:3000};
  const active=transition(paid().state,renewal).state;
  assert.equal(active.status,"active");
  const late=transition(active,{...base,id:"evt_fail999",type:"invoice.payment_failed"});
  assert.equal(late.ok,false);assert.equal(late.reason,"stale_or_unknown_failed_period");
  assert.equal(active.status,"active");
  assert.equal(canVerify(active,2200),true);
  const invalid=transition(active,{...base,id:"evt_failbad",type:"invoice.payment_failed",periodEnd:null});
  assert.equal(invalid.reason,"invalid_failed_period");
});
