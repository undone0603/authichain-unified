// QRON Daily Automation Worker — Cloudflare Cron Triggers
// Handles: Uptime monitoring, SEO pinging, lead notifications, daily digest

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a), bb = enc.encode(b);
  const len = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

export default {
  // Handle HTTP requests (dashboard + webhook endpoints)
  async fetch(request: Request, env: any) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', worker: 'qron-automation', timestamp: new Date().toISOString() }), {
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // Webhook: Lead capture from portfolio contact forms
    if (url.pathname === '/webhook/lead' && request.method === 'POST') {
      try {
        const data: any = await request.json();
        const leadInfo = {
          name: data.name || 'Unknown',
          email: data.email || '',
          company: data.company || '',
          style: data.style || '',
          message: data.message || '',
          source: data.source || 'portfolio',
          timestamp: new Date().toISOString()
        };

        // Store lead
        if (env.LEADS) {
          const key = `lead_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
          await env.LEADS.put(key, JSON.stringify(leadInfo), { expirationTtl: 86400 * 90 });
        }

        // Send notification email via Resend relay
        await sendEmail(env, {
          to: 'authichain@gmail.com',
          subject: `🔥 New QRON Lead: ${leadInfo.name} (${leadInfo.company})`,
          body: `New lead captured!\n\nName: ${leadInfo.name}\nEmail: ${leadInfo.email}\nCompany: ${leadInfo.company}\nStyle Interest: ${leadInfo.style}\nMessage: ${leadInfo.message}\nSource: ${leadInfo.source}\nTime: ${leadInfo.timestamp}\n\nReply ASAP — first responder wins.`
        });

        return new Response(JSON.stringify({ success: true, message: 'Lead captured' }), {
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
        });
      } catch (e: any) {
        return new Response(JSON.stringify({ error: e.message }), { status: 400 });
      }
    }

    // CORS preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type'
        }
      });
    }

    // Auth check for sensitive routes
    const authToken = env.AUTH_TOKEN;
    const isAuthed = !!authToken && (
      timingSafeEqual(url.searchParams.get('key') ?? '', authToken)
      || timingSafeEqual(request.headers.get('Authorization') ?? '', `Bearer ${authToken}`));

    // Dashboard: show automation status
    if (url.pathname === '/' || url.pathname === '/dashboard') {
      if (!isAuthed) return new Response('Unauthorized — append ?key=TOKEN or use Authorization header', { status: 401 });
      return serveDashboard(env);
    }

    // Manual trigger endpoints (auth required)
    if (url.pathname.startsWith('/run/')) {
      if (!isAuthed) return new Response('Unauthorized', { status: 401 });
    }

    if (url.pathname === '/run/uptime') {
      const results = await runUptimeCheck(env);
      return new Response(JSON.stringify(results, null, 2), { headers: { 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/run/seo-ping') {
      const results = await runSEOPing(env);
      return new Response(JSON.stringify(results, null, 2), { headers: { 'Content-Type': 'application/json' } });
    }

    if (url.pathname === '/run/digest') {
      const results = await runDailyDigest(env);
      return new Response(JSON.stringify(results, null, 2), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response('QRON Automation Worker\n\nEndpoints:\n  /dashboard - Status\n  /webhook/lead - Lead capture\n  /run/uptime - Manual uptime check\n  /run/seo-ping - Manual SEO ping\n  /run/digest - Manual daily digest\n  /health - Health check', { status: 200 });
  },

  // Cron trigger handler
  async scheduled(event: any, env: any, ctx: any) {
    // Consolidated to a single */30 cron (account 5-cron-trigger limit). Dispatch
    // by wall-clock so the 6h SEO ping and daily digest still fire at their original
    // times without consuming extra cron slots.
    const now = new Date();
    const h = now.getUTCHours();
    const m = now.getUTCMinutes();
    ctx.waitUntil(runUptimeCheck(env));                          // every 30 min
    if (m === 0 && h % 6 === 0) ctx.waitUntil(runSEOPing(env));  // was 0 */6 * * *
    if (m === 0 && h === 12) ctx.waitUntil(runDailyDigest(env)); // was 0 12 * * *
  }
};

// ============ UPTIME MONITOR ============
const MONITORED_URLS = [
  { name: 'QRON Portfolio', url: 'https://qron-portfolio.undone-k.workers.dev/' },
  { name: 'AuthiChain API', url: 'https://authichain-api.undone-k.workers.dev/' },
  { name: 'AuthiChain Dashboard', url: 'https://authichain-dashboard.undone-k.workers.dev/' },
  { name: 'StrainChain', url: 'https://strainchain.undone-k.workers.dev/' },
  { name: 'QRON SEO Engine', url: 'https://qron-seo-engine.undone-k.workers.dev/' },
  { name: 'QRON Gallery', url: 'https://qron.space' },
];

async function runUptimeCheck(env: any) {
  const results = [];
  const down = [];

  for (const site of MONITORED_URLS) {
    const start = Date.now();
    try {
      const resp = await fetch(site.url, {
        method: 'GET',
        headers: { 'User-Agent': 'QRON-Uptime-Monitor/1.0' },
        redirect: 'follow'
      });
      const latency = Date.now() - start;
      const status = resp.status;
      const ok = status >= 200 && status < 400;

      results.push({ name: site.name, url: site.url, status, latency: `${latency}ms`, ok });

      if (!ok) down.push(`${site.name} (${status})`);
    } catch (e: any) {
      const latency = Date.now() - start;
      results.push({ name: site.name, url: site.url, status: 'ERROR', latency: `${latency}ms`, ok: false, error: e.message });
      down.push(`${site.name} (${e.message})`);
    }
  }

  // Alert on downtime
  if (down.length > 0 && env) {
    await sendEmail(env, {
      to: 'authichain@gmail.com',
      subject: `⚠️ DOWNTIME ALERT: ${down.length} service(s) down`,
      body: `The following services are DOWN:\n\n${down.join('\n')}\n\nFull results:\n${results.map(r => `${r.ok ? '✅' : '❌'} ${r.name}: ${r.status} (${r.latency})`).join('\n')}\n\nTimestamp: ${new Date().toISOString()}`
    });
  }

  // Store latest results
  if (env && env.LEADS) {
    await env.LEADS.put('uptime_latest', JSON.stringify({ results, timestamp: new Date().toISOString() }), { expirationTtl: 86400 });
  }

  return { checked: results.length, down: down.length, results, timestamp: new Date().toISOString() };
}

// ============ SEO PING ============
const SEO_URLS = [
  'https://qron-portfolio.undone-k.workers.dev/',
  'https://qron-portfolio.undone-k.workers.dev/sitemap.xml',
  'https://qron-portfolio.undone-k.workers.dev/robots.txt',
  'https://qron-seo-engine.undone-k.workers.dev/',
  'https://qron-seo-engine.undone-k.workers.dev/ai-qr-code-generator',
  'https://qron-seo-engine.undone-k.workers.dev/custom-qr-code-design',
  'https://qron-seo-engine.undone-k.workers.dev/restaurant-qr-code-menu',
  'https://qron-seo-engine.undone-k.workers.dev/cannabis-qr-code-packaging',
  'https://qron-seo-engine.undone-k.workers.dev/luxury-brand-qr-code',
  'https://qron-seo-engine.undone-k.workers.dev/real-estate-qr-code',
  'https://qron-seo-engine.undone-k.workers.dev/event-ticket-qr-code',
  'https://authichain-api.undone-k.workers.dev/',
  'https://authichain-api.undone-k.workers.dev/docs',
];

async function runSEOPing(env: any) {
  const results = [];

  for (const url of SEO_URLS) {
    try {
      const resp = await fetch(url, {
        method: 'GET',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; QRONBot/1.0; +https://qron.space)',
          'Accept': 'text/html,application/xhtml+xml'
        }
      });
      results.push({ url, status: resp.status, ok: resp.ok });
    } catch (e) {
      results.push({ url, status: 'ERROR', ok: false });
    }
  }

  // Submit sitemaps to Google & Bing
  const sitemaps = [
    'https://qron-portfolio.undone-k.workers.dev/sitemap.xml',
  ];

  for (const sitemap of sitemaps) {
    try {
      await fetch(`https://www.google.com/ping?sitemap=${encodeURIComponent(sitemap)}`);
      results.push({ url: `Google Ping: ${sitemap}`, status: 200, ok: true });
    } catch (e) {
      results.push({ url: `Google Ping: ${sitemap}`, status: 'ERROR', ok: false });
    }
    try {
      await fetch(`https://www.bing.com/ping?sitemap=${encodeURIComponent(sitemap)}`);
      results.push({ url: `Bing Ping: ${sitemap}`, status: 200, ok: true });
    } catch (e) {
      results.push({ url: `Bing Ping: ${sitemap}`, status: 'ERROR', ok: false });
    }
  }

  if (env && env.LEADS) {
    await env.LEADS.put('seo_latest', JSON.stringify({ results, timestamp: new Date().toISOString() }), { expirationTtl: 86400 });
  }

  return { pinged: results.length, timestamp: new Date().toISOString(), results };
}

// ============ DAILY DIGEST ============
async function runDailyDigest(env: any) {
  // Gather all monitoring data
  const uptime = await runUptimeCheck(env);
  const seo = await runSEOPing(env);

  const allUp = uptime.down === 0;
  const date = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });

  // Count leads from KV if available
  let leadCount = 0;
  if (env && env.LEADS) {
    const leads = await env.LEADS.list({ prefix: 'lead_' });
    leadCount = leads.keys.length;
  }

  const digestBody = `
QRON Daily Operations Digest — ${date}
${'='.repeat(50)}

INFRASTRUCTURE STATUS: ${allUp ? '✅ ALL SYSTEMS GO' : '⚠️ ISSUES DETECTED'}
${uptime.results.map(r => `  ${r.ok ? '✅' : '❌'} ${r.name}: ${r.status} (${r.latency})`).join('\n')}

SEO HEALTH: ${seo.pinged} pages pinged
  Google & Bing sitemaps submitted
  ${seo.results.filter(r => !r.ok).length} pages with issues

LEAD PIPELINE: ${leadCount} leads captured (last 90 days)

ACTIVE ASSETS:
  • Portfolio: https://qron-portfolio.undone-k.workers.dev/
  • API Docs: https://authichain-api.undone-k.workers.dev/
  • Dashboard: https://authichain-dashboard.undone-k.workers.dev/?key=authichain2026
  • SEO Engine: https://qron-seo-engine.undone-k.workers.dev/

TODAY'S PRIORITIES:
  1. Check Gmail drafts — 18 outreach emails awaiting send
  2. Review HubSpot pipeline — 14 active deals
  3. Post daily X/Twitter content from x-twitter-posts.md
  4. Respond to any inbound leads within 1 hour

${'='.repeat(50)}
Automated by QRON Automation Worker
  `.trim();

  // Send digest email
  if (env) {
    await sendEmail(env, {
      to: 'authichain@gmail.com',
      subject: `📊 QRON Daily Digest — ${allUp ? 'All Systems Go' : 'Action Required'} — ${date}`,
      body: digestBody
    });
  }

  return { sent: true, date, allUp, leadCount, uptimeChecks: uptime.checked, seoPings: seo.pinged };
}

// ============ EMAIL VIA MAILCHANNELS (FREE ON CF) ============
async function sendEmail(env: any, { to, subject, body }: any) {
  try {
    const resp = await fetch('https://resend-relay.undone-k.workers.dev/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: to,
        subject: subject,
        text: body,
        from: 'QRON Automation <noreply@authichain.com>'
      })
    });

    const result: any = await resp.json();
    if (!result.ok) {
      console.log(`Email failed: ${subject} — ${result.error || 'unknown'}`);
    }

    return result.ok || false;
  } catch (e: any) {
    console.log(`Email error: ${e.message}`);
    return false;
  }
}

// ============ DASHBOARD ============
async function serveDashboard(env: any) {
  let uptimeData = { results: [], timestamp: 'Never' };
  let seoData = { results: [] as any[], timestamp: 'Never' };
  let leadCount = 0;

  if (env && env.LEADS) {
    try {
      const u = await env.LEADS.get('uptime_latest');
      if (u) uptimeData = JSON.parse(u);
      const s = await env.LEADS.get('seo_latest');
      if (s) seoData = JSON.parse(s);
      const leads = await env.LEADS.list({ prefix: 'lead_' });
      leadCount = leads.keys.length;
    } catch (e) {}
  }

  const html = `<!DOCTYPE html>
<html><head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>QRON Automation Dashboard</title>
<style>
*{margin:0;padding:0;box-sizing:border-box}
body{background:#0a0a0a;color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,sans-serif;padding:2rem}
h1{font-size:1.8rem;background:linear-gradient(135deg,#00d4ff,#7b2ff7);-webkit-background-clip:text;-webkit-text-fill-color:transparent;margin-bottom:.5rem}
.subtitle{color:#888;margin-bottom:2rem}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(300px,1fr));gap:1.5rem;margin-bottom:2rem}
.card{background:#111;border:1px solid #222;border-radius:12px;padding:1.5rem}
.card h2{font-size:1rem;color:#aaa;margin-bottom:1rem;text-transform:uppercase;letter-spacing:.05em}
.stat{font-size:2.5rem;font-weight:700;color:#00d4ff}
.stat.warn{color:#ff6b35}
.stat.ok{color:#00ff88}
.row{display:flex;justify-content:space-between;padding:.5rem 0;border-bottom:1px solid #1a1a1a}
.row:last-child{border:none}
.ok-badge{color:#00ff88;font-weight:600}
.err-badge{color:#ff4444;font-weight:600}
.actions{display:flex;gap:1rem;flex-wrap:wrap;margin-top:1rem}
.btn{padding:.6rem 1.2rem;border-radius:8px;background:#1a1a2e;color:#00d4ff;text-decoration:none;border:1px solid #333;font-size:.85rem;transition:.2s}
.btn:hover{background:#00d4ff;color:#000}
.cron-list{list-style:none}
.cron-list li{padding:.4rem 0;color:#ccc;font-size:.9rem}
.cron-list li code{background:#1a1a2e;padding:.2rem .5rem;border-radius:4px;color:#7b2ff7;font-size:.8rem}
</style>
</head><body>
<h1>QRON Automation Engine</h1>
<p class="subtitle">Cloudflare Workers Cron — Free Tier | Last check: ${uptimeData.timestamp}</p>

<div class="grid">
  <div class="card">
    <h2>Infrastructure Uptime</h2>
    <div class="stat ${uptimeData.results.every((r: any) => r.ok) ? 'ok' : 'warn'}">${uptimeData.results.filter((r: any) => r.ok).length}/${uptimeData.results.length}</div>
    ${uptimeData.results.map((r: any) => `<div class="row"><span>${r.name}</span><span class="${r.ok ? 'ok-badge' : 'err-badge'}">${r.ok ? '✓ ' + r.latency : '✗ ' + r.status}</span></div>`).join('')}
  </div>

  <div class="card">
    <h2>SEO Health</h2>
    <div class="stat ok">${seoData.results.filter((r: any) => r.ok).length}</div>
    <p style="color:#888;margin-top:.5rem">${seoData.results.length} pages pinged | Sitemaps submitted to Google & Bing</p>
    <p style="color:#888;margin-top:.25rem">Last ping: ${seoData.timestamp}</p>
  </div>

  <div class="card">
    <h2>Lead Pipeline</h2>
    <div class="stat">${leadCount}</div>
    <p style="color:#888;margin-top:.5rem">Leads captured via webhook (90-day window)</p>
    <p style="color:#666;margin-top:.25rem;font-size:.85rem">POST /webhook/lead to capture new leads</p>
  </div>

  <div class="card">
    <h2>Cron Schedules</h2>
    <ul class="cron-list">
      <li><code>*/30 * * * *</code> Uptime monitor (every 30 min)</li>
      <li><code>0 */6 * * *</code> SEO ping (every 6 hours)</li>
      <li><code>0 12 * * *</code> Daily digest email (8am ET)</li>
    </ul>
  </div>
</div>

<div class="card">
  <h2>Manual Triggers</h2>
  <div class="actions">
    <a href="/run/uptime" class="btn">Run Uptime Check</a>
    <a href="/run/seo-ping" class="btn">Run SEO Ping</a>
    <a href="/run/digest" class="btn">Send Daily Digest</a>
    <a href="/health" class="btn">Health Check</a>
    <a href="https://authichain-dashboard.undone-k.workers.dev/" class="btn">Revenue Dashboard</a>
    <a href="https://qron-portfolio.undone-k.workers.dev/" class="btn">QRON Portfolio</a>
  </div>
</div>

</body></html>`;

  return new Response(html, { headers: { 'Content-Type': 'text/html' } });
}
