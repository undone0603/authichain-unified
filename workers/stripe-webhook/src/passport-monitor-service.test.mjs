import test from 'node:test';
import assert from 'node:assert/strict';
import { passportMonitorService } from './passport-monitor-service.mjs';
import { PASSPORT_MONITOR_PRICE_ID } from './passport-monitor-lifecycle.mjs';
const event = { id:'evt_001',type:'invoice.paid',customerId:'cus_001',subscriptionId:'sub_001',priceId:PASSPORT_MONITOR_PRICE_ID,invoiceId:'in_001',amountPaid:7900,currency:'usd',periodStart:1000,periodEnd:2000 };
// Disposable in-memory serializable store for tests ONLY. This is not a
// production repository and is intentionally not exported.
function fakeAtomicStore() {
  const entries = new Map();const queues = new Map();
  return {
    async transact(id, decide) {
      const prior = queues.get(id) || Promise.resolve();
      let unlock;const current = new Promise(resolve => {unlock=resolve;});
      queues.set(id,current);await prior;
      try {
        const old = entries.get(id) || {state:null,eventIds:new Set()};
        const result=decide({state:old.state,eventIds:new Set(old.eventIds)});
        if(result.commit){
          const nextIds=new Set(old.eventIds);
          if(result.claimedEventId)nextIds.add(result.claimedEventId);
          entries.set(id,{state:result.state,eventIds:nextIds});
        }
        return result;
      } finally { unlock(); }
    },
    peek(id){return entries.get(id);},
  };
}
test('event duplicate is claimed once and not billed or refilled twice',async()=>{
  const db=fakeAtomicStore(),service=passportMonitorService(db);
  const results=await Promise.all(Array.from({length:10},()=>service.applyVerifiedEvent(event)));
  assert.equal(results.filter(x=>x.action==='activated').length,1);
  assert.equal(results.filter(x=>x.action==='duplicate').length,9);
  assert.equal(db.peek('sub_001').eventIds.size,1);
});
test('300 simultaneous verifications spend exactly 300, never 301',async()=>{
  const db=fakeAtomicStore(),service=passportMonitorService(db);await service.applyVerifiedEvent(event);
  const results=await Promise.all(Array.from({length:450},()=>service.consumeVerification('sub_001',1500)));
  assert.equal(results.filter(x=>x.ok).length,300);
  assert.equal(results.filter(x=>!x.ok).length,150);
  assert.equal(db.peek('sub_001').state.used,300);
});
test('failed payment suspends requests and cancellation blocks late invoice',async()=>{
  const db=fakeAtomicStore(),service=passportMonitorService(db);await service.applyVerifiedEvent(event);
  await service.applyVerifiedEvent({...event,id:'evt_002',type:'invoice.payment_failed'});
  assert.equal((await service.consumeVerification('sub_001',1500)).ok,false);
  await service.applyVerifiedEvent({...event,id:'evt_003',type:'customer.subscription.deleted'});
  assert.equal((await service.applyVerifiedEvent({...event,id:'evt_004',invoiceId:'in_004',periodStart:2000,periodEnd:3000})).ok,false);
});
test('rejected price and no repository never permit fulfillment',async()=>{
  assert.throws(()=>passportMonitorService(null),/atomic/);
  const db=fakeAtomicStore(),service=passportMonitorService(db);
  assert.equal((await service.applyVerifiedEvent({...event,priceId:'price_wrong'})).ok,false);
  assert.equal(db.peek('sub_001'),undefined);
  assert.equal((await service.consumeVerification('sub_001',1500)).ok,false);
});
