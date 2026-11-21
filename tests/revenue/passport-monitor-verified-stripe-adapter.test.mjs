import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac,timingSafeEqual} from 'node:crypto';
import {createDormantPassportMonitorWebhook,mapVerifiedStripeEvent,MONITOR_PRICE} from './passport-monitor-verified-stripe-adapter.mjs';
const secret='whsec_disposable_fixture';
const t=Math.floor(Date.now()/1000);
const baseInvoice={id:'in_test_01',status:'paid',paid:true,amount_paid:7900,amount_remaining:0,currency:'usd',
  customer:'cus_test_01',parent:{subscription_details:{subscription:'sub_test_01'}},
  lines:{has_more:false,data:[{pricing:{price_details:{price:MONITOR_PRICE}},period:{start:1000,end:2000}}]}};
const evt=(type='invoice.paid',o=baseInvoice)=>({id:'evt_test_01',livemode:false,type,data:{object:o}});
const payload=x=>JSON.stringify(x);
const header=x=>{const signed=t+'.'+x;return 't='+t+',v1='+createHmac('sha256',secret).update(signed).digest('hex');};
function fixture(){
  const calls=[];
  const stripe={webhooks:{async constructEventAsync(raw,sig,key){
    if(key!==secret)throw new Error('invalid endpoint secret');
    const actual=header(raw);const a=Buffer.from(actual),b=Buffer.from(sig);
    if(a.length!==b.length || !timingSafeEqual(a,b))throw new Error('invalid signature');
    return JSON.parse(raw);
  }}};
  const supabase={async rpc(name,args){calls.push({name,args});return {data:{ok:true,action:'activated'},error:null};}};
  return {calls,process:createDormantPassportMonitorWebhook({stripe,supabase,endpointSecret:secret})};
}
test('signed paid invoice reaches only restricted entitlement RPC with exact price',async()=>{
  const f=fixture(),raw=payload(evt());
  const result=await f.process(raw,header(raw));
  assert.equal(result.ok,true);assert.equal(f.calls.length,1);
  assert.equal(f.calls[0].name,'passport_monitor_apply_verified_event');
  assert.equal(f.calls[0].args.p_event.priceId,MONITOR_PRICE);
});
test('unsigned and tampered payloads fail before database access',async()=>{
  const f=fixture(),raw=payload(evt());
  await assert.rejects(f.process(raw,'t=0,v1=bad'),/invalid signature/);
  await assert.rejects(f.process(raw.replace('7900','8000'),header(raw)),/invalid signature/);
  assert.equal(f.calls.length,0);
});
test('wrong account mode, price, missing subscription or manual out-of-band payment denied',async()=>{
  const f=fixture();
  const cases=[
    evt('invoice.paid',{...baseInvoice,paid_out_of_band:true}),
    evt('invoice.paid',{...baseInvoice,lines:{has_more:false,data:[{pricing:{price_details:{price:'price_other'}},period:{start:1000,end:2000}}]}}),
    evt('invoice.paid',{...baseInvoice,parent:null}),
    {...evt(),livemode:true},
    evt('invoice.paid',{...baseInvoice,amount_paid:0}),
    evt('invoice.paid',{...baseInvoice,lines:{...baseInvoice.lines,has_more:true}})
  ];
  for(const e of cases){const raw=payload(e);assert.equal((await f.process(raw,header(raw))).ok,false);}
  assert.equal(f.calls.length,0);
});
test('signed failed-payment event maps only its billed period',async()=>{
  const mapped=mapVerifiedStripeEvent(evt('invoice.payment_failed',{...baseInvoice,status:'open',paid:false,amount_paid:0}),false);
  assert.equal(mapped.ok,true);assert.equal(mapped.value.periodStart,1000);
  assert.equal(mapped.value.type,'invoice.payment_failed');
});
test('canceled subscription event requires correct state and price',async()=>{
  const o={id:'sub_test_01',status:'canceled',customer:'cus_test_01',items:{data:[{price:{id:MONITOR_PRICE}}]}};
  assert.equal(mapVerifiedStripeEvent(evt('customer.subscription.deleted',o),false).ok,true);
  assert.equal(mapVerifiedStripeEvent(evt('customer.subscription.deleted',{...o,status:'active'}),false).ok,false);
  assert.equal(mapVerifiedStripeEvent(evt('customer.subscription.deleted',{...o,items:{data:[]}}),false).ok,false);
});
test('RPC error is raised for a retry, not silently acknowledged',async()=>{
  const stripe={webhooks:{async constructEventAsync(raw){return JSON.parse(raw)}}};
  const supabase={async rpc(){return {data:null,error:new Error('database unavailable')}}};
  const process=createDormantPassportMonitorWebhook({stripe,supabase,endpointSecret:secret});
  await assert.rejects(process(payload(evt()),'signed-fixture'),/database unavailable/);
});
test('unknown event and oversized body never call RPC',async()=>{
  const f=fixture(),raw=payload(evt('customer.created'));
  assert.equal((await f.process(raw,header(raw))).ok,false);
  assert.equal((await f.process('x'.repeat(65537),'bogus')).reason,'invalid_webhook_transport');
  assert.equal(f.calls.length,0);
});
