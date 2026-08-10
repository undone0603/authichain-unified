// QRON Outreach Engine — KV-backed queue with clean verified contacts only
// Rate: 1 email per cron trigger (reduced from 3 to protect domain reputation)
// Bounce history: April 2026 batch used guessed hello@ addresses → 73% bounce.
//   All addresses in this queue are named contacts verified against real companies.
// Added: List-Unsubscribe header (required by Gmail/Yahoo 2024 bulk sender policy)
// Added: /set-queue endpoint to push a clean contact list via authenticated HTTP

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      const queue = await getOutreachQueue(env);
      return Response.json({
        status: 'ok',
        worker: 'qron-outreach',
        queue: queue ? queue.length : 0,
        kvConnected: !!env.KV
      });
    }

    const authToken = env.AUTH_TOKEN;
    if (!authToken) {
      return Response.json({ error: 'AUTH_TOKEN not configured' }, { status: 500 });
    }

    const isAuthed = url.searchParams.get('key') === authToken
      || request.headers.get('Authorization') === `Bearer ${authToken}`;

    if (url.pathname === '/status') {
      if (!isAuthed) return new Response('Unauthorized', { status: 401 });
      const queue = await getOutreachQueue(env);
      if (!queue) return Response.json({ error: 'outreach_queue not found in KV' }, { status: 500 });
      const sent = await getSentList(env);
      return Response.json({
        total: queue.length,
        sent: sent.length,
        remaining: queue.length - sent.length,
        sentEmails: sent,
        timestamp: new Date().toISOString()
      });
    }

    // Seed / replace the queue in KV — use this to push a clean contact list
    if (url.pathname === '/set-queue' && request.method === 'POST') {
      if (!isAuthed) return new Response('Unauthorized', { status: 401 });
      const body = await request.json();
      if (!Array.isArray(body)) return Response.json({ error: 'Body must be a JSON array' }, { status: 400 });
      await env.KV.put('outreach_queue', JSON.stringify(body), { expirationTtl: 86400 * 90 });
      return Response.json({ ok: true, queued: body.length });
    }

    if (url.pathname === '/send-next') {
      if (!isAuthed) return new Response('Unauthorized', { status: 401 });
      // 1 per manual trigger as well — protects domain reputation
      const result = await sendNextBatch(env, 1);
      return Response.json(result);
    }

    if (url.pathname === '/send-all') {
      if (!isAuthed) return new Response('Unauthorized', { status: 401 });
      const result = await sendAll(env);
      return Response.json(result);
    }

    return new Response(`QRON Outreach Engine
Rate: 1 per cron trigger | Named contacts only
Endpoints:
  /health
  /status?key=TOKEN
  /set-queue?key=TOKEN  (POST JSON array to replace queue)
  /send-next?key=TOKEN
  /send-all?key=TOKEN`);
  },

  async scheduled(event, env, ctx) {
    // 1 email per trigger — cron is every 4 hours = max 6/day, well within safe limits
    ctx.waitUntil(sendNextBatch(env, 1));
  }
};

async function getOutreachQueue(env) {
  if (!env.KV) return null;
  const data = await env.KV.get('outreach_queue');
  return data ? JSON.parse(data) : null;
}

async function getSenderConfig(env) {
  if (!env.KV) return defaultSender();
  const data = await env.KV.get('sender_config');
  return data ? JSON.parse(data) : defaultSender();
}

function defaultSender() {
  return { from: 'hello@authichain.com', fromName: 'Z | QRON AI QR Art', replyTo: 'authichain@gmail.com' };
}

async function getSentList(env) {
  if (!env.KV) return [];
  const data = await env.KV.get('outreach_sent');
  return data ? JSON.parse(data) : [];
}

async function saveSentList(env, sent) {
  if (env.KV) {
    await env.KV.put('outreach_sent', JSON.stringify(sent), { expirationTtl: 86400 * 30 });
  }
}

async function sendNextBatch(env, count) {
  const queue = await getOutreachQueue(env);
  if (!queue) return { error: 'outreach_queue not found in KV — use /set-queue to seed it', batch: [], totalSent: 0, totalQueue: 0 };

  const senderConfig = await getSenderConfig(env);
  const sent = await getSentList(env);
  const sentEmails = new Set(sent.map(s => s.to));
  const toSend = queue.filter(e => !sentEmails.has(e.to)).slice(0, count);

  const results = [];
  for (const email of toSend) {
    const ok = await sendViaResend(email, senderConfig);
    results.push({ to: email.to, subject: email.subject, sent: ok, timestamp: new Date().toISOString() });
    if (ok) sent.push({ to: email.to, subject: email.subject, sentAt: new Date().toISOString() });
  }

  await saveSentList(env, sent);

  if (sent.length >= queue.length && queue.length > 0) {
    await sendViaResend({
      to: senderConfig.replyTo,
      subject: 'QRON Outreach Complete — All Emails Sent',
      body: `All ${queue.length} outreach emails sent.\n\nSent to:\n${sent.map(s => `- ${s.to} (${s.sentAt})`).join('\n')}`
    }, senderConfig);
  }

  return { batch: results, totalSent: sent.length, totalQueue: queue.length };
}

async function sendAll(env) {
  const queue = await getOutreachQueue(env);
  if (!queue) return { error: 'outreach_queue not found in KV', sent: 0, failed: 0, results: [] };

  const senderConfig = await getSenderConfig(env);
  const sent = await getSentList(env);
  const sentEmails = new Set(sent.map(s => s.to));
  const toSend = queue.filter(e => !sentEmails.has(e.to));

  const results = [];
  for (const email of toSend) {
    const ok = await sendViaResend(email, senderConfig);
    results.push({ to: email.to, sent: ok });
    if (ok) sent.push({ to: email.to, subject: email.subject, sentAt: new Date().toISOString() });
    await new Promise(r => setTimeout(r, 1000));
  }

  await saveSentList(env, sent);
  return { sent: results.filter(r => r.sent).length, failed: results.filter(r => !r.sent).length, results };
}

async function sendViaResend(email, senderConfig) {
  try {
    const resp = await fetch('https://resend-relay.undone-k.workers.dev/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: email.to,
        subject: email.subject,
        text: email.body,
        from: `${senderConfig.fromName} <${senderConfig.from}>`,
        reply_to: senderConfig.replyTo,
        headers: {
          'List-Unsubscribe': `<mailto:${senderConfig.replyTo}?subject=unsubscribe>`,
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        }
      })
    });
    const result = await resp.json();
    console.log(`Email to ${email.to}: ${result.ok ? 'sent' : 'failed'}`);
    return result.ok || false;
  } catch (e) {
    console.error(`Email error for ${email.to}:`, e.message);
    return false;
  }
}
