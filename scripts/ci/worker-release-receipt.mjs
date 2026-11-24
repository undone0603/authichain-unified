#!/usr/bin/env node
/** Fail-closed release-run receipt for the output of wrangler deploy --outdir.
 * This associates same-run bundle hashes with an API-confirmed Worker version.
 * It does NOT prove the remote script bytes equal the local bundle.
 */
import {createHash} from 'node:crypto';
import {readFile,readdir,lstat,mkdir,writeFile} from 'node:fs/promises';
import {resolve,relative,join} from 'node:path';
import {pathToFileURL} from 'node:url';

const SCRIPT='authichain-app',SHA=/^[a-f0-9]{40}$/,ID=/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/;
const hash=x=>createHash('sha256').update(x).digest('hex');
function guard(value,why){if(!value)throw Error('Worker release receipt: '+why)}
export function activeDeployment(body){
 const list=Array.isArray(body?.result)?body.result:body?.result?.deployments;
 guard(body?.success===true&&Array.isArray(list)&&list.length>0,'deployment inventory unavailable');
 const top=list[0];
 guard(ID.test(top?.id||'')&&Array.isArray(top.versions)&&top.versions.length===1&&
   top.versions[0].percentage===100&&ID.test(top.versions[0].version_id||''),'deployment not a single 100% version');
 return {id:top.id,version_id:top.versions[0].version_id};
}
export function verifyTransition({before,after,version,now}){
 guard(before?.id!==after?.id&&before?.version_id!==after?.version_id,'no new deployment/version');
 guard(ID.test(after?.version_id||'')&&ID.test(after?.id||''),'invalid new Cloudflare identity');
 guard(version?.success===true&&version?.result?.id===after.version_id&&
   version?.result?.metadata?.source==='wrangler','version not independently confirmed as Wrangler upload');
 const time=Date.parse(version.result.metadata.created_on||''),start=Date.parse(now||'');
 guard(Number.isFinite(time)&&Number.isFinite(start)&&time>=start-120000,'version creation is not fresh');
 return true;
}
export async function hashBundle(root){
 const base=resolve(root),entries=[];
 async function walk(dir){
  for(const item of (await readdir(dir,{withFileTypes:true})).sort((a,b)=>a.name.localeCompare(b.name,'en'))){
   const pathname=join(dir,item.name),stats=await lstat(pathname);
   guard(!stats.isSymbolicLink(),'symlink in bundle');
   if(stats.isDirectory())await walk(pathname);
   else {
    guard(stats.isFile(),'unexpected bundle node');
    const bytes=await readFile(pathname),name=relative(base,pathname).split('\\').join('/');
    guard(!name.includes('..')&&name.length>0,'invalid bundle member');
    entries.push({path:name,bytes:bytes.length,sha256:hash(bytes)});
   }
  }
 }
 await walk(base);
 guard(entries.length>0&&entries.some(e=>/\.(?:js|mjs)$/.test(e.path)),'compiled Worker JavaScript missing');
 entries.sort((a,b)=>a.path.localeCompare(b.path,'en'));
 const manifest=entries.map(e=>e.sha256+'  '+e.path+'\n').join('');
 return {entries,manifest,manifest_sha256:hash(manifest)};
}
export async function cloudflareGet(path,{accountId,token,fetchImpl=fetch}){
 guard(/^[a-f0-9]{32}$/.test(accountId||'')&&token?.length>0,'Cloudflare identity missing');
 const response=await fetchImpl('https://api.cloudflare.com/client/v4/accounts/'+accountId+
  '/workers/scripts/'+SCRIPT+'/'+path,{method:'GET',headers:{Authorization:'Bearer '+token},redirect:'error',cache:'no-store'});
 guard(response.ok,'Cloudflare read failed');
 const body=await response.json();guard(body?.success===true,'Cloudflare response failed');return body;
}
export async function makeBaseline({accountId,token,fetchImpl=fetch,now=new Date()}){
 const before=activeDeployment(await cloudflareGet('deployments',{accountId,token,fetchImpl}));
 return {...before,captured_at:now.toISOString()};
}
export async function makeReceipt({baseline,accountId,token,bundleDir,sourceSha,runId,fetchImpl=fetch}){
 guard(SHA.test(sourceSha||'')&&/^[0-9]+$/.test(String(runId||'')),'missing pinned source or run');
 const after=activeDeployment(await cloudflareGet('deployments',{accountId,token,fetchImpl}));
 const version=await cloudflareGet('versions/'+after.version_id,{accountId,token,fetchImpl});
 verifyTransition({before:baseline,after,version,now:baseline.captured_at});
 const {entries,manifest,manifest_sha256}=await hashBundle(bundleDir);
 return {receipt:{schema:'authichain-worker-release-receipt/v1',
  verification:'same-run-bundle-and-version-association; remote-code-bytes-not-compared',
  repository:'undone0603/authichain-unified',source_sha:sourceSha,github_run_id:String(runId),worker:SCRIPT,
  previous_deployment_id:baseline.id,previous_version_id:baseline.version_id,
  deployment_id:after.id,version_id:after.version_id,
  bundle_manifest_sha256:manifest_sha256,bundle_file_count:entries.length,
  generated_at:new Date().toISOString()},manifest};
}
async function main(){
 const mode=process.argv[2],out=process.env.RECEIPT_DIR||'.release-receipt';
 const opts={accountId:process.env.CLOUDFLARE_ACCOUNT_ID,token:process.env.CLOUDFLARE_API_TOKEN};
 if(mode==='before'){
  const baseline=await makeBaseline(opts);await mkdir(out,{recursive:true});
  await writeFile(join(out,'baseline.json'),JSON.stringify(baseline,null,2)+'\n',{mode:0o600});
  console.log('Predeploy Cloudflare baseline recorded without credentials');
 }else if(mode==='after'){
  const baseline=JSON.parse(await readFile(join(out,'baseline.json'),'utf8'));
  const {receipt,manifest}=await makeReceipt({...opts,baseline,bundleDir:join(out,'bundle'),
   sourceSha:process.env.EXPECTED_SHA,runId:process.env.GITHUB_RUN_ID});
  await writeFile(join(out,'SHA256SUMS'),manifest,{mode:0o600});
  await writeFile(join(out,'receipt.json'),JSON.stringify(receipt,null,2)+'\n',{mode:0o600});
  console.log('Worker receipt: '+receipt.source_sha+' -> '+receipt.version_id+
   '; manifest SHA-256 '+receipt.bundle_manifest_sha256+'; '+receipt.bundle_file_count+' files');
 }else throw Error('expected before/after');
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 main().catch(e=>{console.error('::error::'+e.message);process.exitCode=1;});
}
