import test from "node:test";
import assert from "node:assert/strict";
import {evaluateNegotiation, NegotiationInputError} from "./negotiation-engine.mjs";
const example=()=>({
 objective:"Buy a replacement part, no order is authorized",
 issues:[
  {key:"price_usd",direction:"minimize",target:80,walkAway:120,weight:5,unit:"USD"},
  {key:"delivery_days",direction:"minimize",target:2,walkAway:10,weight:4,unit:"days"},
  {key:"warranty_months",direction:"maximize",target:24,walkAway:6,weight:2,unit:"months"},
 ],
 counterpartOffers:[
  {id:"supplier_a",terms:{price_usd:105,delivery_days:4,warranty_months:12}},
  {id:"supplier_b",terms:{price_usd:125,delivery_days:3,warranty_months:24}},
 ],
 outsideOption:{terms:{price_usd:110,delivery_days:8,warranty_months:12}}
});
test("reports best alternatives without inventing independent BATNA evidence",()=>{
 const r=evaluateNegotiation(example());
 assert.equal(r.batna.declared,true);
 assert.equal(r.batna.verifiedByIndependentSource,false);
 assert.equal(r.zopa.status,"UNKNOWN");
 assert.equal(r.counterpartOffers[0].id,"supplier_a");
 assert.equal(r.counterpartOffers[1].status,"OUTSIDE_DECLARED_LIMITS");
});
test("creates comparable multi-issue alternatives that obey walk-away limits",()=>{
 const r=evaluateNegotiation(example());
 assert.ok(r.proposals.length>=3);
 const multi=r.proposals.filter(x=>x.id!=="opening_target");
 assert.ok(multi.every(x=>x.score.withinWalkAway));
 assert.ok(multi.every(x=>Math.abs(x.score.weightedUtility-0.75)<0.01));
});
test("no side effects, automatic contracts, emails, purchases, or signing",()=>{
 const r=evaluateNegotiation(example());
 assert.equal(r.status,"PROPOSALS_ONLY");
 assert.equal(r.decision,"NO_AGREEMENT_OR_AUTHORIZATION");
 assert.equal(r.humanApprovalRequired,true);
 assert.equal(r.sideEffectsPerformed,0);
 for(const k of ["sendMessage","acceptOffer","purchase","issuePayment","sign","counterpropose","createAccount"])assert.equal(r.allowedActions[k],false);
});
test("one dimensional negotiation cannot falsely claim MESO tradeoffs",()=>{
 const i=example();i.issues=i.issues.slice(0,1);
 delete i.counterpartOffers;delete i.outsideOption;
 const r=evaluateNegotiation(i);
 assert.equal(r.proposals.length,1);
 assert.equal(r.batna.declared,false);
});
test("never accepts duplicate or malformed terms",()=>{
 const i=example();i.issues[1].key="price_usd";
 assert.throws(()=>evaluateNegotiation(i),NegotiationInputError);
 const j=example();j.counterpartOffers[0].terms.price_usd=Infinity;
 assert.throws(()=>evaluateNegotiation(j),NegotiationInputError);
});
test("rejects invalid reservation value orientation",()=>{
 const i=example();i.issues[0].target=130;
 assert.throws(()=>evaluateNegotiation(i),NegotiationInputError);
 const j=example();j.issues[2].target=3;
 assert.throws(()=>evaluateNegotiation(j),NegotiationInputError);
});
test("rejects excessive issue and offer counts",()=>{
 const i=example();i.issues=Array.from({length:9},(_,x)=>({key:"item_"+x,direction:"minimize",target:0,walkAway:10,weight:1}));
 assert.throws(()=>evaluateNegotiation(i),NegotiationInputError);
 const j=example();j.counterpartOffers=Array.from({length:9},(_,x)=>({id:"seller_"+x,terms:example().counterpartOffers[0].terms}));
 assert.throws(()=>evaluateNegotiation(j),NegotiationInputError);
});
test("untrusted counterpart offers do not get mistaken for a verified contract",()=>{
 const i=example();i.counterpartOffers[0].terms.price_usd=70;
 const r=evaluateNegotiation(i);
 assert.equal(r.counterpartOffers[0].source,"caller_supplied_unverified");
 assert.equal(r.allowedActions.acceptOffer,false);
});

test("inbound contract request returns a separate non-authorizing readiness check",()=>{
 const i=example();
 i.inboundContract={
  contract:{id:"customer_contract_001",supplier:"AuthiChain",role:"service_provider",
    sku:"mcp_a2a_build",incomingTotalCents:150000,currency:"usd"},
  cashFlow:{maxOutboundCents:0,requiredActions:[],noProcurement:true,noVendorPayments:true}
 };
 const result=evaluateNegotiation(i);
 assert.equal(result.status,"PROPOSALS_ONLY");
 assert.equal(result.inboundContractReadiness.status,"BLOCKED");
 assert.equal(result.inboundContractReadiness.accepted,false);
 assert.equal(result.inboundContractReadiness.automaticSpendAuthorized,false);
 assert.ok(result.inboundContractReadiness.missing.includes("agentz_reproducible_fulfillment"));
});
