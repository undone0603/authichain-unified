import {test} from 'node:test';
import assert from 'node:assert/strict';
import {runAgentZEvidenceAction} from './authichain-m2m.mjs';

test('default AgentZ evidence task is offline',async()=>{
  let called=false;
  const r=await runAgentZEvidenceAction({fetchImpl:()=>{called=true;throw Error('network')} });
  assert.equal(called,false);assert.equal(r.mode,'dry_run');assert.equal(r.status,'dry_run');
});
test('only published demo ID can be used',async()=>{
  await assert.rejects(()=>runAgentZEvidenceAction({recordId:'customer-seal'}),/only_published_demo_record_allowed/);
});
test('no authority or audit persistence implied',async()=>{
  const r=await runAgentZEvidenceAction();
  assert.equal(r.action,'READ_EVIDENCE');assert.equal(r.authority.productionSendAuthorized,false);
  assert.equal(r.audit.signedByAgent,false);assert.equal(r.audit.persisted,false);
  assert.equal(r.nextActions.promoteToProduction,false);
});
test('live network failure is inconclusive, never proof',async()=>{
  const r=await runAgentZEvidenceAction({live:true,fetchImpl:async()=>{throw Error('no_network')}});
  assert.equal(r.status,'inconclusive');assert.equal(r.evidence.paymentAttempted,false);
  assert.equal(r.authority.subjectAuthenticated,false);
});
test('never introduces payment rights',async()=>{
  const r=await runAgentZEvidenceAction();
  assert.equal(r.authority.paymentAuthorized,false);
  assert.equal(r.nextActions.pay,false);
});
