--a761840e948691d3fbc7bffc5c3c6f835f7aa33d0b795ad70f9fc7ab56bc
Content-Disposition: form-data; name="index.js"

// qron-daily-ops v1.0 — Autonomous daily operations
// 0 6 * * * UTC — audit, self-repair, report

let GROQ  = 'gsk_REDACTED_dead_key';
let SUPA  = 'https://nhdnkzhtadfkkluiulhs.supabase.co/functions/v1';
let SUPA_A= 'JWT_REDACTED_anon_key';
let STRIPE= 'sk_live_REDACTED_expired_key';
let GMAIL = 'https://gmail-relay.undone-k.workers.dev/emails';
let RESEND_RELAY = 'https://resend-relay.undone-k.workers.dev/emails';

const ENDPOINTS = [
  ['https://qron.space',                   'QRON homepage'],
  ['https://qron.space/order',             'QRON storefront'],
  ['https://authichain.com',               'AuthiChain home'],
  ['https://authichain.com/api/v1/health', 'AuthiChain API'],
  ['https://strainchain.io',               'StrainChain home'],
  ['https://api.strainchain.io/health',    'StrainChain API'],
  ['https://authichain.com/compliance',    'EU DPP page'],
  ['https://authichain.com/verify/AC-1829577CED8F6BFBB0BC667CDE33DF0E', 'Live cert verify'],
];

async function groq(prompt, max=600) {
  try {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:'POST', headers:{'Authorization':'Bearer '+GROQ,'Content-Type':'application/json'},
      body: JSON.stringify({model:'llama-3.3-70b-versatile',messages:[{role:'user',content:prompt}],max_tokens:max,temperature:0.3})
    });
    const d = await r.json();
    return d.choices?.[0]?.message?.content || 'Groq unavailable';
  } catch(e) { return 'Groq error: '+e.message; }
}

async function checkEndpoints() {
  const results = [];
  await Promise.all(ENDPOINTS.map(async ([url, label]) => {
    const t0 = Date.now();
    try {
      const r = await fetch(url, {signal: AbortSignal.timeout(8000)});
      results.push({url, label, status: r.status, ms: Date.now()-t0, ok: r.status < 400});
    } catch(e) {
      results.push({url, label, status: 0, ms: Date.now()-t0, ok: false, error: e.message.slice(0,80)});
    }
  }));
  return results.sort((a,b) => a.ok===b.ok ? 0 : a.ok ? 1 : -1);
}

async function checkStripe() {
  try {
    const [balR, sessR] = await Promise.all([
      fetch('https://api.stripe.com/v1/balance', {headers:{'Authorization':'Bearer '+STRIPE}}),
      fetch('https://api.stripe.com/v1/checkout/sessions?limit=20&status=complete', {headers:{'Authorization':'Bearer '+STRIPE}})
    ]);
    const bal = await balR.json();
    const sess = await sessR.json();
    const avail = bal.available?.[0];
    const revenue = (sess.data||[]).reduce((s,x)=>s+(x.amount_total||0),0)/100;
    return {
      balance: avail ? '$'+(avail.amount/100).toFixed(2)+' '+avail.currency.toUpperCase() : 'unknown',
      completed_sessions: sess.data?.length || 0,
      revenue_complete: '$'+revenue.toFixed(2),
      first_sale: sess.data?.length > 0 ? 'YES! FIRST SALE!' : 'Awaiting first sale'
    };
  } catch(e) { return {error: e.message}; }
}

async function checkSupabase() {
  try {
    const r = await fetch(SUPA+'/authichain-verify', {
      method:'POST', headers:{'apikey':SUPA_A,'Authorization':'Bearer '+SUPA_A,'Content-Type':'application/json'},
      body: JSON.stringify({action:'stats'})
    });
    return {status: r.status, ok: r.status < 400};
  } catch(e) { return {status:0, ok:false, error:e.message}; }
}

async function getKVStats(env) {
  if (!env.OUTREACH_KV) return {kv:'unavailable'};
  try {
    const [recent, digests, last_traffic] = await Promise.all([
      env.OUTREACH_KV.get('traffic_recent').catch(()=>null),
      env.OUTREACH_KV.get('digest_sent_count').catch(()=>null),
      env.OUTREACH_KV.get('last_traffic_source').catch(()=>null),
    ]);
    const recentHits = recent ? (JSON.parse(recent)||[]).length : 0;
    return {
      cached_visitor_events: recentHits,
      digests_sent: parseInt(digests||'0'),
      last_traffic_source: last_traffic || 'none'
    };
  } catch(e) { return {error:e.message}; }
}

async function generateInsights(report) {
  const down = report.endpoints.filter(e=>!e.ok).map(e=>e.label);
  const healthScore = Math.max(20, 100 - down.length*15);
  const prompt = `You are the autonomous ops AI for the Authentic Economy (AuthiChain/QRON/StrainChain).
Daily system report:
- Endpoints down: ${JSON.stringify(down)}
- Stripe: ${JSON.stringify(report.stripe)}
- Health score: ${healthScore}/100
- Traffic events cached: ${report.kv.cached_visitor_events || 0}
- First sale achieved: ${report.stripe.first_sale}

Generate a sharp ops briefing in this EXACT format (no preamble):
PRIORITY: [most urgent fix today, 1 sentence]
REVENUE: [best revenue action next 24h, 1 sentence]
HEALTH: ${healthScore}/100 — [2-word verdict]
WINS: [what autonomous stack achieved, 1 sentence]
TOMORROW: [one strategic focus, 1 sentence]`;
  return groq(prompt, 300);
}

function buildReport(endpoints, stripe, supabase, kv, insights) {
  const down = endpoints.filter(e=>!e.ok);
  const allGreen = down.length === 0;
  const date = new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
  
  const subject = allGreen
    ? `✅ Ops Report ${date} — All Systems Green`
    : `⚠️ Ops Report ${date} — ${down.length} System${down.length>1?'s':''} Down`;

  const epLines = endpoints.map(e =>
    `${e.ok?'✅':'🔴'} ${e.label.padEnd(28)} HTTP ${e.status} (${e.ms}ms)${e.error?' | '+e.error:''}`
  ).join('\n');

  const body = `AUTHENTIC ECONOMY — DAILY OPS REPORT
${new Date().toISOString().slice(0,19)} UTC | qron-daily-ops v1.0
${'═'.repeat(55)}

${insights}

${'═'.repeat(55)}
ENDPOINT HEALTH (${endpoints.filter(e=>e.ok).length}/${endpoints.length} operational)
${'─'.repeat(55)}
${epLines}

${'═'.repeat(55)}
STRIPE
${'─'.repeat(55)}
Balance:            ${stripe.balance || 'unknown'}
Completed sessions: ${stripe.completed_sessions || 0}
Revenue collected:  ${stripe.revenue_complete || '$0'}
First sale status:  ${stripe.first_sale || 'Awaiting'}

${'═'.repeat(55)}
SUPABASE EDGE FUNCTIONS
${'─'.repeat(55)}
authichain-verify:  HTTP ${supabase.status} ${supabase.ok ? '✅' : '🔴'}

${'═'.repeat(55)}
TRAFFIC & KV
${'─'.repeat(55)}
Cached visitor events: ${kv.cached_visitor_events || 0}
Daily digests sent:    ${kv.digests_sent || 0}

${'─'.repeat(55)}
authichain.com | qron.space | strainchain.io`;

  return {subject, body};
}

async function runOps(env) {
    // Override with env vars if set
  if (env.GROQ_API_KEY) GROQ = env.GROQ_API_KEY;
  if (env.SUPA_URL) SUPA = env.SUPA_URL;
  if (env.SUPA_ANON) SUPA_A = env.SUPA_ANON;
  if (env.STRIPE_SECRET_KEY) STRIPE = env.STRIPE_SECRET_KEY;
  if (env.GMAIL_RELAY_URL) GMAIL = env.GMAIL_RELAY_URL;
  if (env.RESEND_RELAY_URL) RESEND_RELAY = env.RESEND_RELAY_URL;
  const [endpoints, stripe, supabase, kv] = await Promise.all([
    checkEndpoints(),
    checkStripe(),
    checkSupabase(),
    getKVStats(env),
  ]);
  
  const insights = await generateInsights({endpoints, stripe, kv});
  const {subject, body} = buildReport(endpoints, stripe, supabase, kv, insights);

  // Send via Gmail relay (primary)
  const sent = await fetch(GMAIL, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({
      from:'AuthiChain Ops <ops@qron.space>',
      to:'authichain@gmail.com', reply_to:'authichain@gmail.com',
      subject, text: body
    })
  }).catch(e=>({ok:false, statusText:e.message}));

  // Store in KV
  if (env.OUTREACH_KV) {
    const cnt = parseInt(await env.OUTREACH_KV.get('digest_sent_count').catch(()=>'0') || '0');
    await env.OUTREACH_KV.put('digest_sent_count', String(cnt+1));
    await env.OUTREACH_KV.put('last_daily_report', JSON.stringify({
      ts: Date.now(), subject, insights, endpoints,
      stripe, supabase, kv,
      health_score: Math.max(20, 100 - endpoints.filter(e=>!e.ok).length*15)
    }), {expirationTtl: 7*24*3600});
  }

  return {subject, endpoints_up: endpoints.filter(e=>e.ok).length, total: endpoints.length, stripe, insights};
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(runOps(env));
  },
  async fetch(req, env) {
    const url = new URL(req.url);
    const CORS = {'Access-Control-Allow-Origin':'*','Content-Type':'application/json'};
    if (url.pathname === '/run') {
      const result = await runOps(env);
      return Response.json({ok:true, ...result}, {headers:CORS});
    }
    if (url.pathname === '/last') {
      const last = await env.OUTREACH_KV?.get('last_daily_report').catch(()=>null);
      return Response.json(last ? JSON.parse(last) : {message:'No report yet — run /run first'}, {headers:CORS});
    }
    if (url.pathname === '/health') {
      return Response.json({ok:true, service:'qron-daily-ops', v:'1.0', schedule:'0 6 * * * UTC'}, {headers:CORS});
    }
    return Response.json({service:'qron-daily-ops', v:'1.0', endpoints:['/run','/last','/health']}, {headers:CORS});
  }
};

--a761840e948691d3fbc7bffc5c3c6f835f7aa33d0b795ad70f9fc7ab56bc--
