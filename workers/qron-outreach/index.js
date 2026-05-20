// QRON Outreach Engine (FIXED) — Reads email queue from KV instead of hardcoding PII
// Security fix: All email addresses and content stored in KV namespace "qron-outreach-kv"
// KV Keys:
//   - "outreach_queue"  → JSON array of {to, name, subject, body} objects
//   - "sender_config"   → JSON {from, fromName, replyTo}
//   - "outreach_sent"   → JSON array of sent records (managed by worker)

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      // Health check does NOT reveal queue contents
      const queue = await getOutreachQueue(env);
      return Response.json({
        status: 'ok',
        worker: 'qron-outreach',
        queue: queue ? queue.length : 0,
        kvConnected: !!env.KV
      });
    }

    // Auth check for sensitive routes
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

      let sent = [];
      const data = await env.KV.get('outreach_sent');
      if (data) sent = JSON.parse(data);

      return Response.json({
        total: queue.length,
        sent: sent.length,
        remaining: queue.length - sent.length,
        sentEmails: sent,
        timestamp: new Date().toISOString()
      });
    }

    if (url.pathname === '/send-next') {
      if (!isAuthed) return new Response('Unauthorized', { status: 401 });
      const result = await sendNextBatch(env, 3);
      return Response.json(result);
    }

    if (url.pathname === '/send-all') {
      if (!isAuthed) return new Response('Unauthorized', { status: 401 });
      const result = await sendAll(env);
      return Response.json(result);
    }

    // Default response — no PII exposed
    return new Response(`QRON Outreach Engine (Secured)
Endpoints:
  /health - Health check
  /status?key=TOKEN - Check send progress
  /send-next?key=TOKEN - Send next 3 emails
  /send-all?key=TOKEN - Send all remaining emails`);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(sendNextBatch(env, 3));
  }
};

async function getOutreachQueue(env) {
  if (!env.KV) return null;
  const data = await env.KV.get('outreach_queue');
  return data ? JSON.parse(data) : null;
}

async function getSenderConfig(env) {
  if (!env.KV) return { from: 'hello@authichain.com', fromName: 'Z | QRON AI QR Art', replyTo: 'authichain@gmail.com' };
  const data = await env.KV.get('sender_config');
  return data ? JSON.parse(data) : { from: 'hello@authichain.com', fromName: 'Z | QRON AI QR Art', replyTo: 'authichain@gmail.com' };
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
  if (!queue) return { error: 'outreach_queue not found in KV', batch: [], totalSent: 0, totalQueue: 0 };

  const senderConfig = await getSenderConfig(env);
  const sent = await getSentList(env);
  const sentEmails = new Set(sent.map(s => s.to));
  const toSend = queue.filter(e => !sentEmails.has(e.to)).slice(0, count);

  const results = [];
  for (const email of toSend) {
    const ok = await sendViaResend(email, senderConfig);
    results.push({ to: email.to, subject: email.subject, sent: ok, timestamp: new Date().toISOString() });
    if (ok) {
      sent.push({ to: email.to, subject: email.subject, sentAt: new Date().toISOString() });
    }
  }

  await saveSentList(env, sent);

  // Notify on completion
  if (sent.length >= queue.length) {
    await sendViaResend({
      to: senderConfig.replyTo,
      subject: 'QRON Outreach Complete \u2013 All Emails Sent',
      body: `All ${queue.length} outreach emails have been sent.\n\nSent to:\n${sent.map(s => `- ${s.to} (${s.sentAt})`).join('\n')}\n\nCheck responses in ${senderConfig.replyTo}.`
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
    if (ok) {
      sent.push({ to: email.to, subject: email.subject, sentAt: new Date().toISOString() });
    }
    // Small delay between sends to avoid rate limits
    await new Promise(r => setTimeout(r, 500));
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
        reply_to: senderConfig.replyTo
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
