import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createTestSqliteStore } from './passport-monitor-sqlite-test-store.mjs';
import { passportMonitorService } from './passport-monitor-service.mjs';
import { PASSPORT_MONITOR_PRICE_ID } from './passport-monitor-lifecycle.mjs';
const paid={id:'evt_sqli001',type:'invoice.paid',customerId:'cus_buyer001',subscriptionId:'sub_buyer001',priceId:PASSPORT_MONITOR_PRICE_ID,invoiceId:'in_buyer001',amountPaid:7900,currency:'usd',periodStart:1000,periodEnd:2000};
function fixture() {
  const dir=mkdtempSync(join(tmpdir(),'passport-monitor-db-'));
  return {file:join(dir,'isolated.sqlite'),cleanup:()=>rmSync(dir,{recursive:true,force:true})};
}
test('SQLite restart keeps paid entitlement and event ledger durable',async t=>{
  const f=fixture();t.after(f.cleanup);
  let db=createTestSqliteStore(f.file);let service=passportMonitorService(db);
  assert.equal((await service.applyVerifiedEvent(paid)).action,'activated');
  assert.equal((await service.consumeVerification('sub_buyer001',1500)).ok,true);
  db.close();db=createTestSqliteStore(f.file);service=passportMonitorService(db);
  assert.equal(db.read('sub_buyer001').used,1);
  assert.equal((await service.applyVerifiedEvent(paid)).action,'duplicate');
  assert.equal(db.eventCount(),1);
  db.close();
});
test('SQLite 450 concurrent requests use only 300 total credits',async t=>{
  const f=fixture();t.after(f.cleanup);
  const db=createTestSqliteStore(f.file),service=passportMonitorService(db);
  await service.applyVerifiedEvent(paid);
  const results=await Promise.all(Array.from({length:450},()=>service.consumeVerification('sub_buyer001',1500)));
  assert.equal(results.filter(x=>x.ok).length,300);
  assert.equal(results.filter(x=>!x.ok).length,150);
  assert.equal(db.read('sub_buyer001').used,300);
  db.close();
});
test('duplicate, late failure, renewal, and cancellation survive restart',async t=>{
  const f=fixture();t.after(f.cleanup);
  let db=createTestSqliteStore(f.file),service=passportMonitorService(db);
  await service.applyVerifiedEvent(paid);
  await service.consumeVerification('sub_buyer001',1500);
  const renew={...paid,id:'evt_sqli002',invoiceId:'in_buyer002',periodStart:2000,periodEnd:3000};
  assert.equal((await service.applyVerifiedEvent(renew)).action,'activated');
  assert.equal(db.read('sub_buyer001').used,0);
  const late={...paid,id:'evt_sqli003',type:'invoice.payment_failed'};
  assert.equal((await service.applyVerifiedEvent(late)).reason,'stale_or_unknown_failed_period');
  const cancelled={...renew,id:'evt_sqli004',type:'customer.subscription.deleted'};
  assert.equal((await service.applyVerifiedEvent(cancelled)).action,'cancelled');
  db.close();db=createTestSqliteStore(f.file);service=passportMonitorService(db);
  assert.equal(db.read('sub_buyer001').status,'cancelled');
  assert.equal((await service.consumeVerification('sub_buyer001',2200)).ok,false);
  assert.equal((await service.applyVerifiedEvent({...renew,id:'evt_sqli005'})).ok,false);
  assert.equal(db.eventCount(),3);
  db.close();
});
test('SQLite rejects cross-buyer events and does not claim denied events',async t=>{
  const f=fixture();t.after(f.cleanup);
  const db=createTestSqliteStore(f.file),service=passportMonitorService(db);
  await service.applyVerifiedEvent(paid);
  assert.equal((await service.applyVerifiedEvent({...paid,id:'evt_sqli006',customerId:'cus_intruder'})).reason,'customer_mismatch');
  assert.equal((await service.applyVerifiedEvent({...paid,id:'evt_sqli007',priceId:'price_wrong'})).reason,'unmapped_price');
  assert.equal(db.eventCount(),1);
  db.close();
});
