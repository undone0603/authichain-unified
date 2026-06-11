--0a5de12f180a6d168e717569e86e5379dd6434a75930632e98ac51043a5e
Content-Disposition: form-data; name="index.js"

var R=Object.defineProperty;var l=(t,e)=>R(t,"name",{value:e,configurable:!0});function g(t,e){let a=new TextEncoder,n=a.encode(t),o=a.encode(e),s=Math.max(n.length,o.length),r=n.length^o.length;for(let u=0;u<s;u++)r|=(n[u]??0)^(o[u]??0);return r===0}l(g,"timingSafeEqual");var _=[{name:"authichain-api",url:"https://authichain-api.undone-k.workers.dev/health"},{name:"qron-automation",url:"https://qron-automation.undone-k.workers.dev/health"},{name:"qron-outreach",url:"https://qron-outreach.undone-k.workers.dev/health"},{name:"resend-relay",url:"https://resend-relay.undone-k.workers.dev/health"},{name:"qron-portfolio",url:"https://qron-portfolio.undone-k.workers.dev/"},{name:"qron.space",url:"https://qron.space/"},{name:"authichain.com",url:"https://authichain.com/"},{name:"strainchain.io",url:"https://strainchain.io/"},{name:"qron-seo-engine (sitemap)",url:"https://qron.space/sitemap.xml"},{name:"stripe-webhook (next.js)",url:"https://authichain.com/api/webhook",expectStatus:405}];async function T(t){let e=Date.now();try{let a=await fetch(t.url,{method:"GET",signal:AbortSignal.timeout(8e3),headers:{"User-Agent":"authichain-infra/1.0"}}),n=Date.now()-e,o=t.expectStatus??200,s=a.status===o||a.status>=200&&a.status<400&&!t.expectStatus;return{name:t.name,url:t.url,status:s?"ok":"warn",latencyMs:n,detail:s?`HTTP ${a.status}`:`HTTP ${a.status} (expected ${o})`}}catch(a){return{name:t.name,url:t.url,status:"down",latencyMs:Date.now()-e,detail:a.message??"fetch error"}}}l(T,"checkEndpoint");async function $(t){if(!t.STRIPE_SECRET_KEY)return{name:"stripe-webhook-config",status:"skip",detail:"no STRIPE_SECRET_KEY"};try{let e=await fetch("https://api.stripe.com/v1/webhook_endpoints?limit=5",{headers:{Authorization:`Bearer ${t.STRIPE_SECRET_KEY}`}});if(!e.ok)return{name:"stripe-webhook-config",status:"warn",detail:`Stripe API ${e.status}`};let n=(await e.json()).data??[],o=n.find(r=>r.url==="https://authichain.com/api/webhook"&&r.status==="enabled");if(o)return{name:"stripe-webhook-config",status:"ok",detail:`${(o.enabled_events??[]).length} events, id: ${o.id}`};let s=n.find(r=>{try{return(u=>u==="authichain.com"||u.endsWith(".authichain.com"))(new URL(r.url).hostname)}catch{return!1}});return s?{name:"stripe-webhook-config",status:s.status==="enabled"?"ok":"warn",detail:`found ${s.url} status=${s.status}`}:{name:"stripe-webhook-config",status:"warn",detail:`No webhook pointing to authichain.com \u2014 found: ${n.map(r=>r.url).join(", ")||"none"}`}}catch(e){return{name:"stripe-webhook-config",status:"down",detail:e.message}}}l($,"checkStripeWebhook");async function I(t){if(!t.GITHUB_TOKEN)return{name:"github-stale-branches",status:"skip",detail:"no GITHUB_TOKEN"};try{let e=await fetch("https://api.github.com/repos/undone-k/authichain-unified/branches",{headers:{Authorization:`token ${t.GITHUB_TOKEN}`,Accept:"application/vnd.github.v3+json","User-Agent":"authichain-infra"}});if(!e.ok)return{name:"github-stale-branches",status:"warn",detail:`GitHub API ${e.status}`};let n=(await e.json()).filter(o=>!["main"].includes(o.name)).map(o=>o.name);return{name:"github-stale-branches",status:n.length>3?"warn":"ok",detail:n.length===0?"clean":`stale: ${n.join(", ")}`}}catch(e){return{name:"github-stale-branches",status:"down",detail:e.message}}}l(I,"checkGitHubBranches");async function A(t){if(!t.GITHUB_TOKEN)return{name:"dependabot-alerts",status:"skip",detail:"no GITHUB_TOKEN"};try{let e=await fetch("https://api.github.com/repos/undone-k/authichain-unified/dependabot/alerts?state=open&per_page=50",{headers:{Authorization:`token ${t.GITHUB_TOKEN}`,Accept:"application/vnd.github.v3+json","User-Agent":"authichain-infra"}});if(e.status===403)return{name:"dependabot-alerts",status:"skip",detail:"no Dependabot access (enable in repo settings)"};if(!e.ok)return{name:"dependabot-alerts",status:"warn",detail:`GitHub API ${e.status}`};let a=await e.json(),n={};for(let s of a){let r=s.security_advisory?.severity??"unknown";n[r]=(n[r]??0)+1}return{name:"dependabot-alerts",status:(n.critical??0)+(n.high??0)>0||a.length>0?"warn":"ok",detail:a.length===0?"none":Object.entries(n).map(([s,r])=>`${r} ${s}`).join(", ")}}catch(e){return{name:"dependabot-alerts",status:"down",detail:e.message}}}l(A,"checkGitHubDependabot");async function S(t){try{let e=`probe_${Date.now()}`;await t.INFRA_KV.put("_connectivity_probe",e,{expirationTtl:60});let a=await t.INFRA_KV.get("_connectivity_probe");return{name:"infra-kv",status:a===e?"ok":"warn",detail:a===e?"read/write ok":"write succeeded but read mismatch"}}catch(e){return{name:"infra-kv",status:"down",detail:e.message}}}l(S,"checkKVConnectivity");async function b(t){let e=new Date().toISOString(),a=await Promise.all(_.map(T)),[n,o,s,r]=await Promise.all([$(t),S(t),I(t),A(t)]),u=[...a,n,o,s,r],d=u.reduce((c,m)=>(m.status==="ok"?c.ok++:m.status==="warn"?c.warn++:m.status==="down"&&c.down++,c),{ok:0,warn:0,down:0}),i=[],w=u.filter(c=>c.status==="down"||c.status==="warn");if(w.length>0){let c=await t.INFRA_KV.get("last_alert_hash"),m=JSON.stringify(w.map(p=>p.name+p.status)).length.toString();if(c!==m){let p=`[AuthiChain Infra] ${d.down} down, ${d.warn} warn \u2014 ${e.slice(0,10)}`,E=[`Infrastructure check: ${d.ok} ok / ${d.warn} warn / ${d.down} down`,"","--- Problems ---",...w.map(h=>`[${h.status.toUpperCase()}] ${h.name}: ${h.detail??""}`),"","--- All checks ---",...u.map(h=>`[${h.status}] ${h.name}${h.latencyMs?` (${h.latencyMs}ms)`:""}: ${h.detail??""}`),"",`Run at: ${e}`,"Dashboard: https://authichain-infra.undone-k.workers.dev/status"].join(`
`);(await fetch(t.RESEND_RELAY,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({to:t.ALERT_EMAIL,subject:p,text:E,from:"AuthiChain Infra <hello@authichain.com>",reply_to:t.ALERT_EMAIL})})).ok&&(i.push(t.ALERT_EMAIL),await t.INFRA_KV.put("last_alert_hash",m,{expirationTtl:86400}))}}else await t.INFRA_KV.delete("last_alert_hash");let f={timestamp:e,checks:u,alertsSent:i,summary:d};await t.INFRA_KV.put("latest_report",JSON.stringify(f),{expirationTtl:86400*7});let y=await t.INFRA_KV.get("report_history"),k=y?JSON.parse(y):[];return k.unshift(f),k.splice(24),await t.INFRA_KV.put("report_history",JSON.stringify(k),{expirationTtl:86400*30}),f}l(b,"runChecks");var C={async fetch(t,e){let a=new URL(t.url);if(a.pathname==="/health")return Response.json({status:"ok",worker:"authichain-infra",ts:new Date().toISOString()});let n=e.AUTH_TOKEN;if(!(!!n&&(g(a.searchParams.get("key")??"",n)||g(t.headers.get("Authorization")??"",`Bearer ${n}`))))return new Response("Unauthorized",{status:401});if(a.pathname==="/run"){let s=await b(e);return Response.json(s)}if(a.pathname==="/status"){let s=await e.INFRA_KV.get("latest_report");if(!s)return Response.json({error:"No report yet \u2014 hit /run first"},{status:404});let r=JSON.parse(s),u=l(i=>i==="ok"?"\u2705":i==="warn"?"\u26A0\uFE0F":i==="down"?"\u{1F534}":"\u23ED","statusEmoji"),d=`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>AuthiChain Infra Status</title>
<style>
  body{font-family:monospace;background:#0a0a0a;color:#e5e5e5;padding:2rem;margin:0}
  h1{color:#d4a017;margin:0 0 .25rem}
  .ts{color:#666;font-size:.85rem;margin-bottom:2rem}
  table{border-collapse:collapse;width:100%;max-width:900px}
  th{color:#999;text-align:left;padding:.4rem .75rem;border-bottom:1px solid #222;font-size:.8rem;text-transform:uppercase}
  td{padding:.5rem .75rem;border-bottom:1px solid #1a1a1a}
  .ok{color:#22c55e} .warn{color:#f59e0b} .down{color:#ef4444} .skip{color:#666}
  .summary{margin-bottom:1.5rem;display:flex;gap:1.5rem;font-size:1.1rem}
  .num{font-size:1.4rem;font-weight:bold}
</style></head><body>
<h1>AuthiChain Infra</h1>
<div class="ts">Last check: ${r.timestamp}</div>
<div class="summary">
  <div><div class="num ok">${r.summary.ok}</div>OK</div>
  <div><div class="num warn">${r.summary.warn}</div>Warn</div>
  <div><div class="num down">${r.summary.down}</div>Down</div>
</div>
<table>
<tr><th>Check</th><th>Status</th><th>Latency</th><th>Detail</th></tr>
${r.checks.map(i=>`<tr>
  <td>${i.url?`<a href="${i.url}" style="color:#888;text-decoration:none">${i.name}</a>`:i.name}</td>
  <td class="${i.status}">${u(i.status)} ${i.status}</td>
  <td style="color:#555">${i.latencyMs!=null?i.latencyMs+"ms":"\u2014"}</td>
  <td style="color:#999">${i.detail??""}</td>
</tr>`).join("")}
</table>
<div style="margin-top:2rem;color:#555;font-size:.8rem">
  <a href="?key=${a.searchParams.get("key")}&_r=${Date.now()}" style="color:#d4a017">\u21BB Refresh</a>
  &nbsp;\xB7&nbsp;
  <a href="/run?key=${a.searchParams.get("key")}" style="color:#d4a017">\u25B6 Run now</a>
</div>
</body></html>`;return new Response(d,{headers:{"Content-Type":"text/html; charset=utf-8"}})}if(a.pathname==="/history"){let s=await e.INFRA_KV.get("report_history");return s?new Response(s,{headers:{"Content-Type":"application/json"}}):Response.json([])}return new Response(`AuthiChain Infra Monitor

Endpoints:
  /health             \u2014 public
  /run?key=TOKEN      \u2014 trigger check now
  /status?key=TOKEN   \u2014 HTML dashboard
  /history?key=TOKEN  \u2014 last 24 reports (JSON)`,{headers:{"Content-Type":"text/plain"}})},async scheduled(t,e,a){a.waitUntil(b(e))}};export{C as default};
//# sourceMappingURL=index.js.map

--0a5de12f180a6d168e717569e86e5379dd6434a75930632e98ac51043a5e--
