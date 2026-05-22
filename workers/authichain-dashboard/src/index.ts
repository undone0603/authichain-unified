// AuthiChain Revenue Dashboard — Cloudflare Worker
// Auth: cookie-based session from a form POST.
// Access token is read from env.ACCESS_TOKEN (set via wrangler secret put).
// Auto-refreshes every 60 seconds.

interface Env {
  ACCESS_TOKEN: string;
}

const COOKIE_NAME = 'ac_dash';
const COOKIE_MAX_AGE = 60 * 60 * 8; // 8 hours

function timingSafeEqual(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  const ab = encoder.encode(a);
  const bb = encoder.encode(b);
  // Always iterate max(len) bytes; accumulate both length and content differences
  // so the loop runtime does not depend on where strings first diverge.
  const len = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

function getCookie(req: Request, name: string): string | null {
  const header = req.headers.get('Cookie');
  if (!header) return null;
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k === name) return v.join('=');
  }
  return null;
}

function sessionCookie(token: string, remove = false): string {
  const value = remove ? '' : token;
  const maxAge = remove ? 0 : COOKIE_MAX_AGE;
  return `${COOKIE_NAME}=${value}; Path=/; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    if (!env.ACCESS_TOKEN) {
      return new Response('Dashboard misconfigured: ACCESS_TOKEN secret not set', { status: 500 });
    }

    // Login endpoint: accept form POST, set session cookie, redirect.
    if (url.pathname === '/login' && request.method === 'POST') {
      const form = await request.formData();
      const submitted = String(form.get('k') || '');
      if (!timingSafeEqual(submitted, env.ACCESS_TOKEN)) {
        return new Response(LOGIN_ERR, {
          status: 401,
          headers: { 'Content-Type': 'text/html; charset=utf-8' }
        });
      }
      return new Response(null, {
        status: 303,
        headers: {
          'Location': '/',
          'Set-Cookie': sessionCookie(env.ACCESS_TOKEN)
        }
      });
    }

    // Logout endpoint: clear cookie, show login.
    if (url.pathname === '/logout') {
      return new Response(LOGIN, {
        status: 200,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Set-Cookie': sessionCookie('', true)
        }
      });
    }

    // Everything else requires a valid session cookie.
    const cookie = getCookie(request, COOKIE_NAME);
    if (!cookie || !timingSafeEqual(cookie, env.ACCESS_TOKEN)) {
      return new Response(LOGIN, {
        status: 401,
        headers: { 'Content-Type': 'text/html; charset=utf-8' }
      });
    }

    return new Response(HTML, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-cache'
      }
    });
  }
};

const LOGIN = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AuthiChain Dashboard</title><style>*{box-sizing:border-box;margin:0;padding:0}body{background:#0a0a0a;color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}.login{text-align:center;max-width:360px;padding:40px}.login h1{color:#d4af37;font-size:28px;margin-bottom:8px}.login p{color:#666;margin-bottom:32px;font-size:14px}form{display:flex;gap:8px}input{flex:1;padding:12px 16px;background:#111;border:1px solid #222;border-radius:6px;color:#e0e0e0;font-size:14px;outline:none}input:focus{border-color:#d4af37}button{padding:12px 24px;background:#d4af37;color:#0a0a0a;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-size:14px}button:hover{background:#c4a030}</style></head><body><div class="login"><h1>AuthiChain</h1><p>Revenue Dashboard</p><form method="POST" action="/login"><input id="k" name="k" type="password" placeholder="Access key" autofocus><button type="submit">Enter</button></form></div></body></html>`;

const LOGIN_ERR = `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>AuthiChain Dashboard</title><style>*{box-sizing:border-box;margin:0;padding:0}body{background:#0a0a0a;color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh}.login{text-align:center;max-width:360px;padding:40px}.login h1{color:#d4af37;font-size:28px;margin-bottom:8px}.login p{color:#666;margin-bottom:32px;font-size:14px}.err{color:#d96060;font-size:13px;margin-bottom:20px}form{display:flex;gap:8px}input{flex:1;padding:12px 16px;background:#111;border:1px solid #222;border-radius:6px;color:#e0e0e0;font-size:14px;outline:none}input:focus{border-color:#d4af37}button{padding:12px 24px;background:#d4af37;color:#0a0a0a;border:none;border-radius:6px;font-weight:600;cursor:pointer;font-size:14px}button:hover{background:#c4a030}</style></head><body><div class="login"><h1>AuthiChain</h1><p>Revenue Dashboard</p><div class="err">Invalid access key.</div><form method="POST" action="/login"><input id="k" name="k" type="password" placeholder="Access key" autofocus><button type="submit">Enter</button></form></div></body></html>`;

const HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>AuthiChain Revenue Dashboard</title>
<meta http-equiv="refresh" content="60">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#0a0a0a;color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;font-size:14px;line-height:1.5}
.hdr{padding:20px 32px;border-bottom:1px solid #1a1a1a;display:flex;justify-content:space-between;align-items:center;background:#080808}
.logo{font-size:22px;font-weight:700;color:#d4af37;letter-spacing:1px}
.logo span{color:#555;font-weight:400;font-size:13px;margin-left:12px}
.live{display:flex;align-items:center;gap:8px;font-size:11px;color:#3ddc60;text-transform:uppercase;letter-spacing:2px}
.live::before{content:'';width:8px;height:8px;background:#3ddc60;border-radius:50%;animation:blink 2s infinite}
@keyframes blink{0%,100%{opacity:1}50%{opacity:.3}}
.wrap{max-width:1400px;margin:0 auto;padding:32px}
h2{color:#d4af37;font-size:14px;margin-bottom:20px;text-transform:uppercase;letter-spacing:3px;font-weight:600}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px;margin-bottom:48px}
.c{background:#111;border:1px solid #1a1a1a;border-radius:8px;padding:20px;transition:border-color .2s}
.c:hover{border-color:#d4af37}
.ct{font-size:11px;text-transform:uppercase;color:#555;letter-spacing:1.5px;margin-bottom:8px}
.cv{font-size:32px;font-weight:700;color:#d4af37;line-height:1.1}
.cs{font-size:11px;color:#444;margin-top:6px}
table{width:100%;border-collapse:collapse;margin-bottom:48px}
th{text-align:left;padding:10px 16px;border-bottom:2px solid #1a1a1a;color:#d4af37;font-size:10px;text-transform:uppercase;letter-spacing:2px;font-weight:600}
td{padding:10px 16px;border-bottom:1px solid #111;font-size:13px}
tr:hover{background:#0d0d10}
.pr{color:#3ddc60;font-weight:600;font-variant-numeric:tabular-nums}
.tg{display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:600;letter-spacing:.5px}
.ta{background:#2a1f0a;color:#d4af37}
.ts{background:#0a2a0f;color:#3ddc60}
.tq{background:#0a1a2a;color:#4da6ff}
.tm{background:#1a0a2a;color:#b48aff}
.tgov{background:#0a1a2a;color:#4a90d9}
.acts{display:flex;flex-wrap:wrap;gap:10px;margin-bottom:48px}
.ab{display:inline-flex;align-items:center;gap:8px;padding:10px 18px;background:#111;border:1px solid #1a1a1a;border-radius:6px;color:#ccc;text-decoration:none;font-size:12px;transition:all .2s;letter-spacing:.5px}
.ab:hover{border-color:#d4af37;color:#d4af37;background:#0d0d10}
.eco{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-bottom:48px}
.ec{background:#111;border:1px solid #1a1a1a;border-radius:8px;padding:20px;text-decoration:none;color:inherit;transition:border-color .2s;display:block}
.ec:hover{border-color:#d4af37}
.ec-name{font-size:15px;font-weight:600;color:#e0e0e0;margin-bottom:4px}
.ec-status{display:flex;align-items:center;gap:6px;font-size:11px;text-transform:uppercase;letter-spacing:1.5px;margin-bottom:8px}
.ec-status .dot{width:7px;height:7px;border-radius:50%;display:inline-block}
.dot-live{background:#3ddc60}
.dot-pilot{background:#d4a017}
.ec-url{font-size:11px;color:#444;word-break:break-all}
.lds{display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:12px;margin-bottom:48px}
.ld{background:#111;border:1px solid #1a1a1a;border-radius:8px;padding:16px;transition:border-color .2s}
.ld:hover{border-color:#d4af37}
.ln{font-size:15px;font-weight:600;color:#e0e0e0;margin-bottom:2px}
.lc{font-size:11px;color:#d4af37;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px}
.li{font-size:11px;color:#444}
.auto-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));gap:12px;margin-bottom:48px}
.auto-card{background:#111;border:1px solid #1a1a1a;border-radius:8px;padding:20px;transition:border-color .2s}
.auto-card:hover{border-color:#d4af37}
.auto-name{font-size:14px;font-weight:600;color:#e0e0e0;margin-bottom:4px}
.auto-freq{font-size:11px;color:#d4af37;margin-bottom:6px}
.auto-worker{font-size:11px;color:#444}
.auto-dot{display:inline-block;width:7px;height:7px;background:#3ddc60;border-radius:50%;margin-right:6px}
.pipeline-link{display:inline-block;margin-top:12px;color:#4da6ff;font-size:13px;text-decoration:none;letter-spacing:.5px}
.pipeline-link:hover{color:#d4af37}
.ft{text-align:center;padding:40px 0;color:#222;font-size:11px;letter-spacing:1px}
.logout{color:#444;font-size:11px;text-decoration:none;margin-left:16px}
.logout:hover{color:#d4af37}
@media(max-width:768px){.grid{grid-template-columns:1fr 1fr}.wrap{padding:16px}.lds{grid-template-columns:1fr 1fr}.eco{grid-template-columns:1fr 1fr}.auto-grid{grid-template-columns:1fr 1fr}}
@media(max-width:480px){.grid{grid-template-columns:1fr}.lds{grid-template-columns:1fr}.eco{grid-template-columns:1fr}.auto-grid{grid-template-columns:1fr}}
</style>
</head>
<body>
<div class="hdr">
  <div class="logo">AUTHICHAIN <span>Revenue Command Center</span></div>
  <div class="live">Live <a href="/logout" class="logout">Sign out</a></div>
</div>
<div class="wrap">

<h2>Platform Infrastructure</h2>
<div class="grid">
  <div class="c"><div class="ct">Unified Workers</div><div class="cv">21</div><div class="cs">authichain-unified + edge stack</div></div>
  <div class="c"><div class="ct">Stripe Connect</div><div class="cv">v2</div><div class="cs">Direct balance billing enabled</div></div>
  <div class="c"><div class="ct">D1 Database</div><div class="cv">1</div><div class="cs">ID: ebd8081b-ac13-485a-8b0e-a6cd9c0f7be5</div></div>
  <div class="c"><div class="ct">Domains Active</div><div class="cv">4</div><div class="cs">authichain, qron, strainchain, govchain</div></div>
  <div class="c"><div class="ct">Monday Outreach</div><div class="cv">11</div><div class="cs">Michigan Margin Protection staged</div></div>
  <div class="c"><div class="ct">Vendor ID</div><div class="cv">VS0375</div><div class="cs">sigma.michigan.gov</div></div>
</div>

<h2>Ecosystem Status</h2>
<div class="eco">
  <a href="https://authichain.com" class="ec" target="_blank">
    <div class="ec-name">AuthiChain.com</div>
    <div class="ec-status"><span class="dot dot-live"></span> 5% Platform Fee</div>
    <div class="ec-url">Primary Auth & Marketplace</div>
  </a>
  <a href="https://qron.space" class="ec" target="_blank">
    <div class="ec-name">QRON.space</div>
    <div class="ec-status"><span class="dot dot-live"></span> 10% Creative Fee</div>
    <div class="ec-url">AI QR Art & Digital Passports</div>
  </a>
  <a href="https://strainchain.io" class="ec" target="_blank">
    <div class="ec-name">StrainChain.io</div>
    <div class="ec-status"><span class="dot dot-live"></span> 15% Compliance Fee</div>
    <div class="ec-url">Cannabis Margin Protection</div>
  </a>
  <a href="https://govchain.us" class="ec" target="_blank">
    <div class="ec-name">GovChain.us</div>
    <div class="ec-status"><span class="dot dot-pilot"></span> Grant Funded</div>
    <div class="ec-url">Regulatory Audit Trails</div>
  </a>
</div>

<h2>Active Campaigns & Leads</h2>
<table>
<thead><tr><th>Target</th><th>Domain</th><th>Context</th><th>Contact</th><th>Status</th></tr></thead>
<tbody>
<tr><td>Lion Labs</td><td><span class="tg ts">StrainChain</span></td><td>24% Tax Relief</td><td>Erik Root</td><td>Staged for Mon 9AM</td></tr>
<tr><td>Skymint</td><td><span class="tg ts">StrainChain</span></td><td>Margin Protection</td><td>Ops Director</td><td>Staged for Mon 9AM</td></tr>
<tr><td>Fluresh / T.H.C.</td><td><span class="tg ts">StrainChain</span></td><td>Rebrand / Auth</td><td>Bob Schwartz</td><td>Staged for Mon 9AM</td></tr>
<tr><td>Michigan CRA</td><td><span class="tg tgov">GovChain</span></td><td>Wholesale Audit</td><td>Regulatory Dept</td><td>Drafting Demo</td></tr>
<tr><td>EU Luxury Brands</td><td><span class="tg tq">QRON</span></td><td>DPP Compliance</td><td>-</td><td>Nurturing</td></tr>
</tbody>
</table>

<h2>Quick Actions</h2>
<div class="acts">
  <a href="https://dashboard.stripe.com" class="ab" target="_blank">&#x1f4b3; Stripe</a>
  <a href="https://dash.cloudflare.com" class="ab" target="_blank">&#x2601; Cloudflare</a>
  <a href="https://supabase.com/dashboard/project/nhdnkzhtadfkkluiulhs" class="ab" target="_blank">&#x1f5c4; Supabase</a>
  <a href="https://vercel.com/dashboard" class="ab" target="_blank">&#x25b2; Vercel</a>
  <a href="https://app.hubspot.com" class="ab" target="_blank">&#x1f4c7; HubSpot</a>
  <a href="https://airtable.com/app4lw5wNMNmzTNMn" class="ab" target="_blank">&#x1f4ca; Airtable</a>
  <a href="https://mail.google.com" class="ab" target="_blank">&#x1f4e7; Gmail</a>
  <a href="https://strainchain.io" class="ab" target="_blank">&#x1f33f; StrainChain</a>
  <a href="https://qron.space" class="ab" target="_blank">&#x1f52e; QRON</a>
  <a href="https://maison-elite-17.myshopify.com/admin" class="ab" target="_blank">&#x1f6cd; Shopify</a>
  <a href="https://govchain.us" class="ab" target="_blank">&#x1f3db; GovChain</a>
  <a href="https://authichain-api.undone-k.workers.dev/" class="ab" target="_blank">&#x26a1; AuthiChain API</a>
</div>

<h2>Lead Pipeline &mdash; Airtable</h2>
<table>
<thead><tr><th>Client</th><th>Company</th><th>Package</th><th>Status</th><th>Revenue</th></tr></thead>
<tbody>
<tr><td>Cloud Cannabis</td><td>Cloud Cannabis Co</td><td><span class="tg tq">Brand Pack</span></td><td>New Lead</td><td class="pr">$199</td></tr>
<tr><td>ThrivePOP</td><td>ThrivePOP Agency</td><td><span class="tg tq">Enterprise</span></td><td>Contacted</td><td class="pr">$4,999</td></tr>
<tr><td>PufCreativ</td><td>PufCreativ Agency</td><td><span class="tg tq">Enterprise</span></td><td>Contacted</td><td class="pr">$4,999</td></tr>
<tr><td>Round Barn Winery</td><td>Round Barn</td><td><span class="tg tq">Single Design</span></td><td>New Lead</td><td class="pr">$199</td></tr>
<tr><td>360 Event Productions</td><td>360 Events</td><td><span class="tg tq">Brand Pack</span></td><td>New Lead</td><td class="pr">$995</td></tr>
<tr><td>Signature Sotheby's</td><td>Signature SIR</td><td><span class="tg tq">Enterprise</span></td><td>New Lead</td><td class="pr">$9,999</td></tr>
</tbody>
</table>
<a href="https://airtable.com/app4lw5wNMNmzTNMn" class="pipeline-link" target="_blank">View all 14 leads in Airtable &rarr;</a>
<div style="margin-bottom:48px"></div>

<h2>Automation Engine</h2>
<div class="auto-grid">
  <div class="auto-card">
    <div class="auto-name"><span class="auto-dot"></span>Uptime Monitor</div>
    <div class="auto-freq">Every 30 minutes</div>
    <div class="auto-worker">qron-automation worker</div>
  </div>
  <div class="auto-card">
    <div class="auto-name"><span class="auto-dot"></span>SEO Engine</div>
    <div class="auto-freq">Every 6 hours</div>
    <div class="auto-worker">qron-seo-engine worker</div>
  </div>
  <div class="auto-card">
    <div class="auto-name"><span class="auto-dot"></span>Daily Digest</div>
    <div class="auto-freq">Noon daily</div>
    <div class="auto-worker">qron-daily-ops worker</div>
  </div>
</div>

<div class="ft">AUTHICHAIN REVENUE DASHBOARD &middot; Auto-refreshes 60s &middot; <script>document.write(new Date().toLocaleString())</script></div>
</div>
</body>
</html>`;
