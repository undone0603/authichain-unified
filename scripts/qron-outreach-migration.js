// QRON Outreach Engine — MIGRATION VERSION
// Purpose: Deploy this FIRST to seed KV with email data, then deploy the clean version.
//
// Steps:
//   1. Paste this code into the Cloudflare Dashboard worker editor for "qron-outreach"
//   2. Hit: https://qron-outreach.undone-k.workers.dev/migrate-to-kv?key=<AUTH_TOKEN>
//   3. Verify: https://qron-outreach.undone-k.workers.dev/verify-kv?key=<AUTH_TOKEN>
//   4. Then deploy scripts/qron-outreach-fixed.js (the clean version with NO hardcoded emails)

const OUTREACH_QUEUE = [
  {
    to: "stacy@missionrestaurantgroup.com",
    name: "Stacy",
    subject: "Custom QR Art for Your Restaurant Menus \u2013 40% More Scans",
    body: "Hi Stacy,\n\nI came across Mission Restaurant Group and I'm impressed by your portfolio of Michigan restaurants. I'd love to help elevate your menu QR codes.\n\nI create AI-generated artistic QR codes using QRON \u2013 each one is a unique piece of art that's 100% scannable. Clients see 25-40% more scans because customers actually want to scan something beautiful.\n\nWhat I can deliver for your restaurant group:\n- Custom QR art matched to each restaurant's brand\n- 100% scan-tested on iPhone, Android, and tablet\n- High-res PNG + SVG for print menus, table tents, and signage\n- 24-hour turnaround per design\n\nPortfolio: https://qron-portfolio.undone-k.workers.dev/\n\nI'd love to create a free sample for one of your restaurants. Just reply with a URL and I'll have it ready within hours.\n\nBest,\nZ | QRON\nauthichain@gmail.com"
  },
  {
    to: "fatsquirrelseo@gmail.com",
    name: "Louis",
    subject: "White-Label AI QR Art for Your Cannabis Clients",
    body: "Hi Louis,\n\nI saw Fat Squirrel's work in cannabis brand design across Michigan \u2013 impressive portfolio. I have a service that could complement what you offer your dispensary clients.\n\nI run QRON, an AI-powered QR art studio that transforms standard QR codes into scannable works of art. For agencies like yours, I offer:\n- White-label service (your branding, my AI tech)\n- Bulk pricing for client campaigns\n- 11 signature styles\n- Brand color matching to existing packaging designs\n- API access for automated generation\n\nEach QR art design is $49 retail, with agency volume discounts available.\n\nPortfolio: https://qron-portfolio.undone-k.workers.dev/\n\nHappy to create a free sample for one of your clients. What do you think?\n\nBest,\nZ | QRON\nauthichain@gmail.com"
  },
  {
    to: "klong@c3industries.com",
    name: "Kathryn",
    subject: "Branded QR Art for High Profile Cannabis Packaging",
    body: "Hi Kathryn,\n\nI noticed High Profile Cannabis is expanding across Michigan. Quick pitch: I create AI-generated artistic QR codes that transform standard packaging QR codes into premium brand assets.\n\nUsing QRON, your compliance QR codes become scannable art that:\n- Matches High Profile's brand aesthetic perfectly\n- Gets 25-40% more scans than standard codes\n- Works with any compliance/seed-to-sale system\n- Includes blockchain verification (AuthiChain technology)\n\n$49 per design or $199 for a 5-pack. 100% scan guarantee.\n\nPortfolio: https://qron-portfolio.undone-k.workers.dev/\n\nReply with your website URL and I'll generate a free branded sample.\n\nBest,\nZ | QRON\nauthichain@gmail.com"
  },
  {
    to: "christopher.kwilasz@lume.com",
    name: "Christopher",
    subject: "Custom QR Art for Lume Cannabis \u2013 Free Sample",
    body: "Hi Christopher,\n\nAs Michigan's largest cannabis company, Lume's packaging is seen by thousands daily. Your QR codes don't have to be boring black squares.\n\nI create AI-generated artistic QR codes \u2013 scannable art that matches your brand. 25-40% more engagement than standard codes.\n\n$49/design or $199 for 5. 100% scan guarantee. 24-hour delivery.\n\nPortfolio: https://qron-portfolio.undone-k.workers.dev/\n\nReply with a URL and I'll create a free Lume-branded sample.\n\nBest,\nZ | QRON\nauthichain@gmail.com"
  },
  {
    to: "contact@cannabiscreative.com",
    name: "Cannabis Creative team",
    subject: "White-Label AI QR Art for Your Cannabis Packaging Clients",
    body: "Hi Cannabis Creative team,\n\nYour print and packaging design work for cannabis brands pairs perfectly with what I offer.\n\nI run QRON \u2013 an AI-powered platform that transforms standard QR codes into scannable works of art. The white-label opportunity:\n- You offer \"Premium QR Art\" as an add-on to packaging projects\n- I handle all generation (AI-powered, 11 signature styles)\n- Your branding, your client relationship\n- $49 retail per design, agency volume discounts available\n\nEvery code is 100% scan-tested and works with any compliance system.\n\nPortfolio: https://qron-portfolio.undone-k.workers.dev/\n\nHappy to create a free branded sample for one of your clients.\n\nBest,\nZ | QRON\nauthichain@gmail.com"
  },
  {
    to: "privacy@lettuce.com",
    name: "Jennifer / Lettuce Entertain You Marketing Team",
    subject: "AI-Powered Menu QR Art for Lettuce Entertain You Restaurants",
    body: "Hi Jennifer,\n\nWith 130+ restaurants across your portfolio, your QR code menus are one of the first things millions of diners interact with each year.\n\nI create AI-generated artistic QR codes \u2013 my clients see 25-40% more scans, and diners say the codes are conversation starters.\n\nFor a restaurant group your size, I can provide:\n- Custom QR art matched to each restaurant's brand\n- 100% scan guarantee\n- High-res PNG + SVG for table tents, menus, signage\n- Bulk pricing for your full portfolio\n\nPortfolio: https://qron-portfolio.undone-k.workers.dev/\n\nI'd love to create a free sample for one of your Chicago locations. Just reply with a menu URL.\n\nBest,\nZ | QRON\nauthichain@gmail.com"
  },
  {
    to: "press@compass.com",
    name: "Compass Marketing Team",
    subject: "AI-Powered QR Art for Compass Smart Signage",
    body: "Hi Compass Marketing Team,\n\nI know Compass leads the industry in smart signage with QR technology. I'd like to propose a visual upgrade.\n\nI run QRON, an AI-powered platform that turns standard QR codes into scannable works of art. Instead of generic black-and-white QR on yard signs, imagine Compass-branded artistic QR that gets 37%+ scan-through rates.\n\nPartnership options:\n- Custom QR art matching Compass brand guidelines\n- Bulk pricing for agent teams and offices\n- API available for automated generation at scale\n\nPortfolio: https://qron-portfolio.undone-k.workers.dev/\n\nHappy to create a free sample using a live Compass listing URL.\n\nBest,\nZ | QRON\nauthichain@gmail.com"
  },
  {
    to: "Helpteam@oakleysign.com",
    name: "Oakley Signs Team",
    subject: "AI QR Art Partnership \u2013 Upgrade Your Real Estate Sign QR Codes",
    body: "Hi Oakley Signs Team,\n\nI saw your partnership with Local Logic for QR-enabled signage. I'd like to propose a visual upgrade that makes your QR signs even more compelling.\n\nI run QRON \u2013 artistic QR codes see 25-40% more scans than standard codes. For agents, that means more virtual tour views and more leads.\n\nPartnership options:\n- White-label: \"Premium QR Art\" add-on to existing sign orders\n- API integration: automated artistic QR generation in your ordering workflow\n- Bulk pricing for your 50+ brokerage partners\n\nPortfolio: https://qron-portfolio.undone-k.workers.dev/\n\nHappy to create free samples using any brokerage's brand colors.\n\nBest,\nZ | QRON\nauthichain@gmail.com"
  },
  {
    to: "info@creativevinylsigns.com",
    name: "Creative Vinyl Signs team",
    subject: "White-Label AI QR Art for Your Cannabis Packaging Clients",
    body: "Hi Creative Vinyl Signs team,\n\nI see you provide cannabis branding and packaging services in Michigan. I have a service that could be a great upsell for your clients.\n\nQRON creates AI-generated artistic QR codes \u2013 transforming boring compliance codes into premium brand assets.\n\nWhite-label available: your branding, my AI tech. $49/design retail, volume discounts for partners.\n\nPortfolio: https://qron-portfolio.undone-k.workers.dev/\n\nReply for a free sample.\n\nBest,\nZ | QRON\nauthichain@gmail.com"
  }
];

const SENDER_CONFIG = {
  from: "hello@authichain.com",
  fromName: "Z | QRON AI QR Art",
  replyTo: "authichain@gmail.com"
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      const queue = await getQueueFromKV(env);
      return Response.json({
        status: 'ok',
        worker: 'qron-outreach',
        queue: queue ? queue.length : OUTREACH_QUEUE.length,
        kvSeeded: !!queue,
        migrationVersion: true
      });
    }

    // Auth check
    const authToken = env.AUTH_TOKEN || 'qron-ops-2026';
    const isAuthed = url.searchParams.get('key') === authToken
      || request.headers.get('Authorization') === `Bearer ${authToken}`;

    // === MIGRATION ENDPOINT: Seeds KV with email data ===
    if (url.pathname === '/migrate-to-kv') {
      if (!isAuthed) return new Response('Unauthorized', { status: 401 });
      if (!env.KV) return Response.json({ error: 'KV binding not configured' }, { status: 500 });

      try {
        // Write outreach_queue
        await env.KV.put('outreach_queue', JSON.stringify(OUTREACH_QUEUE));
        // Write sender_config
        await env.KV.put('sender_config', JSON.stringify(SENDER_CONFIG));

        // Verify
        const queueData = await env.KV.get('outreach_queue');
        const configData = await env.KV.get('sender_config');
        const queue = JSON.parse(queueData);
        const config = JSON.parse(configData);

        return Response.json({
          success: true,
          message: 'KV seeded successfully! Now deploy the clean version (qron-outreach-fixed.js)',
          outreach_queue: {
            written: true,
            count: queue.length,
            emails: queue.map(e => e.to)
          },
          sender_config: {
            written: true,
            data: config
          },
          next_step: 'Deploy scripts/qron-outreach-fixed.js to remove hardcoded emails from worker code'
        });
      } catch (err) {
        return Response.json({ error: 'Migration failed', details: err.message }, { status: 500 });
      }
    }

    // === VERIFY ENDPOINT: Check KV data ===
    if (url.pathname === '/verify-kv') {
      if (!isAuthed) return new Response('Unauthorized', { status: 401 });
      if (!env.KV) return Response.json({ error: 'KV binding not configured' }, { status: 500 });

      const queueData = await env.KV.get('outreach_queue');
      const configData = await env.KV.get('sender_config');
      const sentData = await env.KV.get('outreach_sent');

      return Response.json({
        outreach_queue: queueData ? { exists: true, count: JSON.parse(queueData).length } : { exists: false },
        sender_config: configData ? { exists: true, data: JSON.parse(configData) } : { exists: false },
        outreach_sent: sentData ? { exists: true, count: JSON.parse(sentData).length } : { exists: false },
        ready_for_clean_deploy: !!(queueData && configData)
      });
    }

    if (url.pathname === '/status') {
      if (!isAuthed) return new Response('Unauthorized', { status: 401 });
      const queue = await getActiveQueue(env);
      let sent = [];
      if (env.KV) {
        const data = await env.KV.get('outreach_sent');
        if (data) sent = JSON.parse(data);
      }
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

    return new Response(`QRON Outreach Engine (Migration Version)
Endpoints:
  /health - Health check
  /migrate-to-kv?key=TOKEN - MIGRATION: Seed KV with email data
  /verify-kv?key=TOKEN - Verify KV data was written correctly
  /status?key=TOKEN - Check send progress
  /send-next?key=TOKEN - Send next 3 emails
  /send-all?key=TOKEN - Send all remaining emails`);
  },

  async scheduled(event, env, ctx) {
    ctx.waitUntil(sendNextBatch(env, 3));
  }
};

// Try KV first, fall back to hardcoded (migration compatibility)
async function getQueueFromKV(env) {
  if (!env.KV) return null;
  const data = await env.KV.get('outreach_queue');
  return data ? JSON.parse(data) : null;
}

async function getActiveQueue(env) {
  const kvQueue = await getQueueFromKV(env);
  return kvQueue || OUTREACH_QUEUE;
}

async function getSenderConfig(env) {
  if (!env.KV) return SENDER_CONFIG;
  const data = await env.KV.get('sender_config');
  return data ? JSON.parse(data) : SENDER_CONFIG;
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
  const queue = await getActiveQueue(env);
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

  if (sent.length >= queue.length) {
    await sendViaResend({
      to: senderConfig.replyTo,
      subject: 'QRON Outreach Complete',
      body: `All ${queue.length} outreach emails have been sent.\n\nSent to:\n${sent.map(s => `- ${s.to} (${s.sentAt})`).join('\n')}`
    }, senderConfig);
  }

  return { batch: results, totalSent: sent.length, totalQueue: queue.length };
}

async function sendAll(env) {
  const queue = await getActiveQueue(env);
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
