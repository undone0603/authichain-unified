// Four-domain read-only launch audit. No checkout submissions, payments or arbitrary targets.
// node scripts/launch/four-domain-smoke.mjs --live
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

export const TARGETS = Object.freeze([
  { id:'authichain_home', brand:'AuthiChain', url:'https://authichain.com/', category:'home' },
  { id:'authichain_verify', brand:'AuthiChain', url:'https://authichain.com/verify', category:'info' },
  { id:'authichain_starter_confirm', brand:'AuthiChain', url:'https://authichain.com/checkout/starter', category:'checkout_landing' },
  { id:'authichain_dpp_confirm', brand:'AuthiChain', url:'https://authichain.com/checkout/dpp_readiness', category:'checkout_landing' },
  { id:'authichain_x402_health', brand:'AuthiChain', url:'https://authichain.com/api/x402/health', category:'json_discovery' },
  { id:'authichain_agent_card', brand:'AuthiChain', url:'https://authichain.com/.well-known/agent-card.json', category:'json_discovery' },
  { id:'qron_home', brand:'QRON', url:'https://qron.space/', category:'home' },
  { id:'qron_generate', brand:'QRON', url:'https://qron.space/generate', category:'info' },
  { id:'qron_stored_scan', brand:'QRON', url:'https://qron.space/qron/r/qron%3Aurl%3A71cead6b', category:'public_stored_example' },
  { id:'strainchain_home', brand:'StrainChain', url:'https://strainchain.io/', category:'home' },
  { id:'strainchain_genetics', brand:'StrainChain', url:'https://strainchain.io/genetics', category:'info' },
  { id:'strainchain_onboard', brand:'StrainChain', url:'https://strainchain.io/onboard', category:'info' },
  { id:'strainchain_passport_confirm', brand:'StrainChain', url:'https://authichain.com/checkout/strainchain_passport', category:'checkout_landing' },
  { id:'govchain_home', brand:'GovChain', url:'https://govchain.us/', category:'home' },
  { id:'govchain_opportunities', brand:'GovChain', url:'https://govchain.us/opportunities', category:'info' },
  { id:'govchain_onboard', brand:'GovChain', url:'https://govchain.us/onboard', category:'info' },
].map(x=>Object.freeze(x)));
const MAX_RESPONSE_BYTES = 262144;

function classify(target, status, contentType, length) {
  if (status !== 200) return { state:'failed', reason:'http_status_' + status };
  if (length === 0) return { state:'failed', reason:'empty_response' };
  const expected = target.category === 'json_discovery' || target.category === 'public_stored_example' ? 'json' : 'html';
  const lower = String(contentType || '').toLowerCase();
  if (!lower.includes(expected === 'json' ? 'application/json' : 'text/html')) {
    return { state:'failed', reason:'wrong_content_type' };
  }
  return { state:'reachable', reason:'http_200_' + expected };
}

async function boundedGet(target, fetchImpl) {
  const response = await fetchImpl(target.url, {
    method:'GET', redirect:'error', credentials:'omit',
    headers:{ Accept: target.category === 'json_discovery' || target.category === 'public_stored_example' ? 'application/json' : 'text/html' },
    signal:AbortSignal.timeout(8000)
  });
  const declared = Number(response.headers?.get('content-length'));
  if (Number.isFinite(declared) && declared > MAX_RESPONSE_BYTES) throw new Error('oversize_response');
  if (!response.body || typeof response.body.getReader !== 'function') throw new Error('body_unreadable');
  const reader = response.body.getReader();
  let total=0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > MAX_RESPONSE_BYTES) throw new Error('oversize_response');
    }
  } finally { reader.releaseLock(); }
  return { status:response.status, contentType:response.headers?.get('content-type') || '', length:total };
}

export async function run(fetchImpl=globalThis.fetch, sourceSha='not_pinned') {
  const observations=[];
  for(const target of TARGETS) {
    try {
      const got=await boundedGet(target,fetchImpl);
      observations.push({ id:target.id, brand:target.brand, url:target.url,
        category:target.category, http_status:got.status, ...classify(target,got.status,got.contentType,got.length) });
    } catch(error) {
      const message = error?.message || '';
      observations.push({ id:target.id, brand:target.brand, url:target.url,
        category:target.category, state:'coverage_unknown',
        reason:message === 'oversize_response' || message === 'body_unreadable' ? message : 'transport_or_redirect_failure' });
    }
  }
  const homes=observations.filter(x=>x.category==='home');
  return { schema:'authichain.four_domain_smoke.v1', checked_at_utc:new Date().toISOString(),
    source_sha:sourceSha, method:'read_only_GET', payments_performed:false, forms_submitted:false,
    agent_tck_passed:false, customer_delivery_proven:false,
    sites_publicly_reachable:homes.length===4 && homes.every(x=>x.state==='reachable'),
    observations };
}

if(process.argv[1] && import.meta.url===pathToFileURL(resolve(process.argv[1])).href) {
  if(!process.argv.includes('--live')) {
    console.log(JSON.stringify({state:'dry_run',network_called:false,targets:TARGETS.length,
      instruction:'Pass --live to perform fixed public GET checks. No purchases or submissions.'}));
  } else if (process.argv.some(x=>x.startsWith('--') && x!=='--live')) {
    console.error('Unknown flag; no network request was made.');
    process.exitCode=2;
  } else {
    const out=await run(globalThis.fetch,process.env.SOURCE_COMMIT_SHA || 'not_pinned');
    console.log(JSON.stringify(out,null,2));
    if(out.observations.some(x=>x.state==='failed') || !out.sites_publicly_reachable) process.exitCode=1;
  }
}
