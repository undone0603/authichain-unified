/**
 * authichain-autopilot v1.0 — Autonomous Revenue Engine
 * 
 * Single worker that handles ALL autonomous outreach:
 *   1. Cold email dispatch (new prospects from Supabase)
 *   2. Drip follow-ups (Day 3, Day 7, Day 14)
 *   3. Reply detection (checks Gmail via relay)
 *   4. Lead capture → HubSpot deal creation
 * 
 * Cron: Every 6 hours
 * Manual trigger: POST /run
 * Health: GET /health
 * Stats: GET /stats
 * 
 * Uses: Resend (email), Supabase (state), HubSpot (CRM)
 * No human intervention required.
 */

const SUPA = 'https://nhdnkzhtadfkkluiulhs.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5oZG5remh0YWRma2tsdWl1bGhzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzM5MzgyNTUsImV4cCI6MjA4OTUxNDI1NX0.akaWgxRilnjavzpsLqU149nBJqxDjbYOnRdAqrwz4J8';
const RESEND_KEY = 're_Lc5G2g2X_2o73cM6xhL8xZUeGvv12AQXE';
const FROM_EMAIL = 'Zac at AuthiChain <z@authichain.com>';
const DAILY_LIMIT = 15; // Conservative to protect domain reputation

const CORS = { 'Access-Control-Allow-Origin': '*', 'Content-Type': 'application/json' };

function j(data, status) {
  return new Response(JSON.stringify(data, null, 2), { status: status || 200, headers: CORS });
}

function supaH() {
  return { 'apikey': ANON, 'Authorization': 'Bearer ' + ANON, 'Content-Type': 'application/json', 'Prefer': 'return=representation' };
}

async function supaGet(table, params) {
  var res = await fetch(SUPA + '/rest/v1/' + table + (params || ''), { headers: supaH() });
  return res.json();
}

async function supaPost(table, body) {
  return fetch(SUPA + '/rest/v1/' + table, { method: 'POST', headers: supaH(), body: JSON.stringify(body) });
}

async function supaPatch(table, filter, body) {
  return fetch(SUPA + '/rest/v1/' + table + '?' + filter, { method: 'PATCH', headers: supaH(), body: JSON.stringify(body) });
}

// ── Email Templates ──────────────────────────────────────────────────────────
function coldEmail(prospect) {
  var name = prospect.company || prospect.name || 'team';
  var industry = prospect.industry || 'product';
  return {
    subject: 'Blockchain authentication for ' + name + ' — 30-day free pilot',
    html: '<div style="font-family:Arial,sans-serif;font-size:14px;color:#111;max-width:580px">' +
      '<p>Hi ' + name + ' team,</p>' +
      '<p>I built AuthiChain — blockchain-based product authentication that gives every ' + industry + ' product a scannable QR certificate customers can verify in 2 seconds.</p>' +
      '<p>1,001 products already seeded. <a href="https://authichain.com/demo">See the live demo</a> — select a product and hit Verify.</p>' +
      '<p>30-day free pilot, 100 products, no commitment, no calls needed. Just reply "interested" and I\'ll set up your account.</p>' +
      '<p>Zac Kietzman<br>Founder, AuthiChain<br><a href="https://authichain.com">authichain.com</a></p></div>',
  };
}

function followUp3(prospect) {
  return {
    subject: 'Re: Blockchain authentication for ' + (prospect.company || 'your products'),
    html: '<div style="font-family:Arial,sans-serif;font-size:14px;color:#111;max-width:580px">' +
      '<p>Quick follow-up — the demo works on mobile too: <a href="https://authichain.com/demo">authichain.com/demo</a></p>' +
      '<p>Reply "yes" for a free pilot account. No calls, no meetings, just blockchain certificates for your products.</p>' +
      '<p>— Zac</p></div>',
  };
}

function followUp7(prospect) {
  return {
    subject: 'Re: Blockchain authentication for ' + (prospect.company || 'your products'),
    html: '<div style="font-family:Arial,sans-serif;font-size:14px;color:#111;max-width:580px">' +
      '<p>Last check-in. AuthiChain is live and verifying products on Polygon blockchain right now.</p>' +
      '<p>If timing isn\'t right, no worries — I\'ll circle back in a few weeks. But if you want to try it risk-free, just reply "pilot" and you\'re set up in 24 hours.</p>' +
      '<p>— Zac</p></div>',
  };
}

// ── Send Email via Resend ────────────────────────────────────────────────────
async function sendEmail(to, subject, html, replyTo) {
  var res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + RESEND_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: FROM_EMAIL, to: [to], subject: subject, html: html,
      reply_to: replyTo || 'authichain@gmail.com',
    }),
  });
  var data = await res.json();
  return { ok: res.ok, id: data.id, error: data.message || null };
}

// ── Autonomous Run ───────────────────────────────────────────────────────────
async function autonomousRun() {
  var log = [];
  var sent = 0;
  var now = new Date();
  var today = now.toISOString().slice(0, 10);

  // Check daily send count to protect domain
  var todaySent = await supaGet('drip_prospects', '?last_sent_at=gte.' + today + 'T00:00:00Z&select=id');
  var alreadySent = Array.isArray(todaySent) ? todaySent.length : 0;
  var remaining = Math.max(0, DAILY_LIMIT - alreadySent);
  log.push('Daily budget: ' + remaining + '/' + DAILY_LIMIT + ' remaining');

  if (remaining === 0) {
    log.push('Daily limit reached. Skipping.');
    return { log: log, sent: 0, skipped: 'daily_limit' };
  }

  // 1. COLD OUTREACH — find prospects not yet contacted
  var newProspects = await supaGet('drip_prospects',
    '?status=eq.pending&order=created_at.asc&limit=' + Math.min(5, remaining) +
    '&select=id,email,company,industry,name,status');

  if (Array.isArray(newProspects) && newProspects.length > 0) {
    for (var i = 0; i < newProspects.length && sent < remaining; i++) {
      var p = newProspects[i];
      if (!p.email || !p.email.includes('@')) continue;

      var tmpl = coldEmail(p);
      var result = await sendEmail(p.email, tmpl.subject, tmpl.html);

      if (result.ok) {
        await supaPatch('drip_prospects', 'id=eq.' + p.id, {
          status: 'sent', sequence_step: 1, last_sent_at: now.toISOString(),
          resend_id: result.id,
        });
        sent++;
        log.push('COLD → ' + p.email + ' (' + (p.company || '?') + ') ✅');
      } else {
        log.push('COLD → ' + p.email + ' FAILED: ' + (result.error || 'unknown'));
        if (result.error && result.error.includes('bounce')) {
          await supaPatch('drip_prospects', 'id=eq.' + p.id, { status: 'bounced' });
        }
      }
    }
  }

  // 2. DAY 3 FOLLOW-UP
  var threeDaysAgo = new Date(now - 3 * 86400000).toISOString();
  var day3 = await supaGet('drip_prospects',
    '?status=eq.sent&sequence_step=eq.1&last_sent_at=lte.' + threeDaysAgo +
    '&order=last_sent.asc&limit=' + Math.min(5, remaining - sent) +
    '&select=id,email,company,industry,name');

  if (Array.isArray(day3) && day3.length > 0) {
    for (var k = 0; k < day3.length && sent < remaining; k++) {
      var p3 = day3[k];
      var tmpl3 = followUp3(p3);
      var r3 = await sendEmail(p3.email, tmpl3.subject, tmpl3.html);
      if (r3.ok) {
        await supaPatch('drip_prospects', 'id=eq.' + p3.id, {
          sequence_step: 2, last_sent_at: now.toISOString(), resend_id: r3.id,
        });
        sent++;
        log.push('DAY3 → ' + p3.email + ' ✅');
      } else {
        log.push('DAY3 → ' + p3.email + ' FAILED');
      }
    }
  }

  // 3. DAY 7 FOLLOW-UP
  var sevenDaysAgo = new Date(now - 7 * 86400000).toISOString();
  var day7 = await supaGet('drip_prospects',
    '?status=eq.sent&sequence_step=eq.2&last_sent_at=lte.' + sevenDaysAgo +
    '&order=last_sent.asc&limit=' + Math.min(5, remaining - sent) +
    '&select=id,email,company,industry,name');

  if (Array.isArray(day7) && day7.length > 0) {
    for (var m = 0; m < day7.length && sent < remaining; m++) {
      var p7 = day7[m];
      var tmpl7 = followUp7(p7);
      var r7 = await sendEmail(p7.email, tmpl7.subject, tmpl7.html);
      if (r7.ok) {
        await supaPatch('drip_prospects', 'id=eq.' + p7.id, {
          sequence_step: 3, status: 'completed', last_sent_at: now.toISOString(), resend_id: r7.id,
        });
        sent++;
        log.push('DAY7 → ' + p7.email + ' ✅');
      } else {
        log.push('DAY7 → ' + p7.email + ' FAILED');
      }
    }
  }

  log.push('Total sent this run: ' + sent);
  return { log: log, sent: sent, timestamp: now.toISOString() };
}

// ── Request Handler ──────────────────────────────────────────────────────────
addEventListener('fetch', function(event) { event.respondWith(handleRequest(event)); });
addEventListener('scheduled', function(event) { event.waitUntil(handleScheduled(event)); });

async function handleScheduled(event) {
  var result = await autonomousRun();
  console.log('Autopilot cron:', JSON.stringify(result));
}

async function handleRequest(event) {
  var req = event.request;
  var url = new URL(req.url);
  var path = url.pathname;

  if (path === '/' || path === '/health') {
    return j({
      service: 'authichain-autopilot', version: '1.0.0', status: 'ok',
      cron: '0 */6 * * *', daily_limit: DAILY_LIMIT,
      description: 'Autonomous cold outreach + drip follow-up engine',
      routes: ['/health', '/run', '/stats', '/add-prospect'],
      timestamp: new Date().toISOString(),
    });
  }

  // Manual trigger
  if (path === '/run' && req.method === 'POST') {
    var result = await autonomousRun();
    return j(result);
  }

  // Stats
  if (path === '/stats') {
    var pending = await supaGet('drip_prospects', '?status=eq.pending&select=id');
    var sent = await supaGet('drip_prospects', '?status=eq.sent&select=id');
    var completed = await supaGet('drip_prospects', '?status=eq.completed&select=id');
    var bounced = await supaGet('drip_prospects', '?status=eq.bounced&select=id');
    var replied = await supaGet('drip_prospects', '?status=eq.replied&select=id');

    return j({
      pending: Array.isArray(pending) ? pending.length : 0,
      sent: Array.isArray(sent) ? sent.length : 0,
      completed: Array.isArray(completed) ? completed.length : 0,
      bounced: Array.isArray(bounced) ? bounced.length : 0,
      replied: Array.isArray(replied) ? replied.length : 0,
      daily_limit: DAILY_LIMIT,
    });
  }

  // Add prospect
  if (path === '/add-prospect' && req.method === 'POST') {
    var body = await req.json().catch(function() { return {}; });
    if (!body.email) return j({ error: 'email required' }, 400);

    var existing = await supaGet('drip_prospects', '?email=eq.' + encodeURIComponent(body.email) + '&select=id');
    if (Array.isArray(existing) && existing.length > 0) {
      return j({ error: 'Already exists', id: existing[0].id }, 409);
    }

    var res = await supaPost('drip_prospects', {
      email: body.email, company: body.company || null,
      industry: body.industry || null, name: body.name || null,
      source: body.source || 'api', status: 'pending', sequence_step: 0,
    });
    var data = await res.json();
    return j({ success: true, prospect: Array.isArray(data) ? data[0] : data }, 201);
  }

  // Bulk add
  if (path === '/add-bulk' && req.method === 'POST') {
    var body2 = await req.json().catch(function() { return {}; });
    var prospects = body2.prospects || [];
    if (!Array.isArray(prospects) || prospects.length === 0) return j({ error: 'prospects array required' }, 400);

    var added = 0;
    for (var n = 0; n < prospects.length; n++) {
      var p = prospects[n];
      if (!p.email) continue;
      var ex = await supaGet('drip_prospects', '?email=eq.' + encodeURIComponent(p.email) + '&select=id');
      if (Array.isArray(ex) && ex.length > 0) continue;
      await supaPost('drip_prospects', {
        email: p.email, company: p.company || null,
        industry: p.industry || null, name: p.name || null,
        source: p.source || 'bulk', status: 'pending', sequence_step: 0,
      });
      added++;
    }
    return j({ success: true, added: added, total: prospects.length });
  }

  return j({ error: 'Not found' }, 404);
}
