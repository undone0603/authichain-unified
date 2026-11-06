/**
 * Exact-source, zero-dependency tests for the final DPP grant boundary.
 *
 * Run: node --test src/lib/dpp-fulfill-plan.offline.test.mjs
 *
 * This tests the early Stripe SKU/payment/mode/plan guards without invoking
 * provisioning, Stripe, Supabase, webhooks, or email. It cannot establish a
 * persisted entitlement or replace complete Vitest/integration testing.
 */
import assert from "node:assert/strict";
import {readFileSync} from "node:fs";
import test from "node:test";

const source=readFileSync(new URL("./dpp-fulfill-checkout.ts",import.meta.url),"utf8");
const begin=source.indexOf("  const md = session.metadata || {};");
const end=source.indexOf("  const visitId =",begin);
assert.ok(begin>=0 && end>begin,"DPP grant guard changed; review extraction");
assert.match(source,/const plan = "dpp_readiness";/,"Trusted SKU must fix entitlement plan");
const snippet=source.slice(begin,end);
assert.match(snippet,/session\.mode !== "payment"/);
assert.match(snippet,/md\.plan !== "dpp_readiness"/);
const run=new Function("session","priceId","DPP_PRICE_ID","toId",snippet+"\nreturn {handled:true};");
const toId=x=>!x?null:typeof x==="string"?x:x.id;
const sku="price_1TwmD8GqTruSqV8TpAF8dfyA";
const base={
 id:"cs_test_DPP",status:"complete",payment_status:"paid",
 mode:"payment",subscription:null,
 metadata:{offer:"dpp_readiness",plan:"dpp_readiness"},
};
for(const [label,delta,price,allow] of [
 ["single paid one-time canonical DPP",{},sku,true],
 ["no price evidence",{},undefined,false],
 ["incorrect price",{},"price_other_299",false],
 ["unpaid",{payment_status:"unpaid"},sku,false],
 ["open checkout",{status:"open"},sku,false],
 ["missing mode",{mode:undefined},sku,false],
 ["recurring mode",{mode:"subscription"},sku,false],
 ["setup mode",{mode:"setup"},sku,false],
 ["subscription id",{subscription:"sub_unexpected"},sku,false],
 ["subscription expanded object",{subscription:{id:"sub_unexpected"}},sku,false],
 ["contradictory plan",{metadata:{plan:"starter",stripe_price_id:sku}},sku,false],
 ["empty optional metadata",{metadata:{}},sku,true],
 ["only descriptive offer",{metadata:{offer:"dpp_readiness"}},sku,true],
 ["spoofed metadata without trusted price",{metadata:{plan:"dpp_readiness",stripe_price_id:sku}},null,false],
]){
 test(label,()=>{
  const result=run({...base,...delta},price,sku,toId);
  assert.equal(result.handled,allow);
 });
}
