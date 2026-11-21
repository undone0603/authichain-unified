import {test} from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,writeFile,symlink,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {activeDeployment,verifyTransition,hashBundle,makeReceipt} from './worker-release-receipt.mjs';
const SHA='a'.repeat(40),id=n=>'00000000-0000-0000-0000-'+String(n).padStart(12,'0');
const before={id:id(1),version_id:id(2),captured_at:new Date(Date.now()-5000).toISOString()};
const after={id:id(3),version_id:id(4)};
const deployment=x=>({success:true,result:[{id:x.id,versions:[{version_id:x.version_id,percentage:100}]}]});
const version={success:true,result:{id:after.version_id,metadata:{source:'wrangler',created_on:new Date().toISOString()}}};
test('only a single 100% Cloudflare deployment is valid',()=>{
 assert.deepEqual(activeDeployment(deployment(after)),after);
 assert.throws(()=>activeDeployment({success:false,result:[{}]}),/unavailable/);
 assert.throws(()=>activeDeployment({success:true,result:[{...deployment(after).result[0],
  versions:[{version_id:id(4),percentage:50}]}]}),/100%/);
});
test('rejects unchanged, forged and stale Worker versions',()=>{
 assert.equal(verifyTransition({before,after,version,now:before.captured_at}),true);
 assert.throws(()=>verifyTransition({before:after,after,version,now:before.captured_at}),/no new/);
 assert.throws(()=>verifyTransition({before,after,version:{...version,
  result:{...version.result,id:id(7)}},now:before.captured_at}),/independently/);
 assert.throws(()=>verifyTransition({before,after,version:{...version,
  result:{...version.result,metadata:{source:'api',created_on:new Date().toISOString()}}},
  now:before.captured_at}),/Wrangler/);
 assert.throws(()=>verifyTransition({before,after,version:{...version,
  result:{...version.result,metadata:{source:'wrangler',created_on:new Date(0).toISOString()}}},
  now:before.captured_at}),/fresh/);
});
test('hashes exact bundle bytes deterministically; rejects symlinks',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'worker-receipt-'));
 try{
  await writeFile(join(dir,'index.js'),'export default {}\n');
  const a=await hashBundle(dir),b=await hashBundle(dir);
  assert.equal(a.manifest_sha256,b.manifest_sha256);
  await writeFile(join(dir,'index.js'),'export default {fetch(){}}\n');
  assert.notEqual((await hashBundle(dir)).manifest_sha256,a.manifest_sha256);
  await symlink(join(dir,'index.js'),join(dir,'unsafe.js'));
  await assert.rejects(hashBundle(dir),/symlink/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
test('receipt links exact SHA/run to the API version without claiming remote byte equality',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'worker-receipt-'));
 try{
  await writeFile(join(dir,'index.js'),'export default {}\n');
  const result=await makeReceipt({baseline:before,accountId:'b'.repeat(32),token:'test-token',
   bundleDir:dir,sourceSha:SHA,runId:'12345',fetchImpl:async target=>({ok:true,
   json:async()=>target.endsWith('deployments')?deployment(after):version})});
  assert.equal(result.receipt.source_sha,SHA);
  assert.equal(result.receipt.version_id,after.version_id);
  assert.match(result.receipt.bundle_manifest_sha256,/^[a-f0-9]{64}$/);
  assert.match(result.receipt.verification,/remote-code-bytes-not-compared/);
  await assert.rejects(makeReceipt({baseline:before,accountId:'b'.repeat(32),token:'test-token',
   bundleDir:dir,sourceSha:'bogus',runId:'12345'}),/missing pinned/);
 }finally{await rm(dir,{recursive:true,force:true});}
});
