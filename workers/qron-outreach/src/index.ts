// QRON Outreach Engine — Sends cold emails via Resend relay (authichain.com domain)
// Cron: sends 1 email per trigger (was 3 — reduced to protect domain reputation)
// Bounce history: April 2026 batch used guessed hello@ addresses → 73% bounce.
// Current queue uses verified named contacts only.

function timingSafeEqual(a: string, b: string): boolean {
  const enc = new TextEncoder();
  const ab = enc.encode(a), bb = enc.encode(b);
  const len = Math.max(ab.length, bb.length);
  let diff = ab.length ^ bb.length;
  for (let i = 0; i < len; i++) diff |= (ab[i] ?? 0) ^ (bb[i] ?? 0);
  return diff === 0;
}

interface Email {
  to: string;
  name: string;
  subject: string;
  body: string;
}

// REMOVED from original queue (reason in comment):
//   klong@c3industries.com     — already delivered 2026-06-26, skip duplicate
//   privacy@lettuce.com        — legal/privacy inbox, wrong recipient for marketing
//   press@compass.com          — press desk, not the right contact for a partnership pitch

const OUTREACH_QUEUE: Email[] = [
  {
    to: "stacy@missionrestaurantgroup.com",
    name: "Stacy",
    subject: "Custom QR Art for Your Restaurant Menus — 40% More Scans",
    body: `Hi Stacy,

I came across Mission Restaurant Group and I'm impressed by your portfolio of Michigan restaurants. I'd love to help elevate your menu QR codes.

I create AI-generated artistic QR codes using QRON — each one is a unique piece of art that's 100% scannable. Clients see 25-40% more scans because customers actually want to scan something beautiful.

What I can deliver for your restaurant group:
- Custom QR art matched to each restaurant's brand
- 100% scan-tested on iPhone, Android, and tablet
- High-res PNG + SVG for print menus, table tents, and signage
- 24-hour turnaround per design

Portfolio: https://qron-portfolio.undone-k.workers.dev/

I'd love to create a free sample for one of your restaurants. Just reply with a URL and I'll have it ready within hours.

Best,
Z | QRON
authichain@gmail.com

---
To unsubscribe from future emails, reply with "unsubscribe".`
  },
  {
    to: "fatsquirrelseo@gmail.com",
    name: "Louis",
    subject: "White-Label AI QR Art for Your Cannabis Clients",
    body: `Hi Louis,

I saw Fat Squirrel's work in cannabis brand design across Michigan — impressive portfolio. I have a service that could be a great complement to what you offer your dispensary clients.

I run QRON, an AI-powered QR art studio that transforms standard QR codes into scannable works of art. For agencies like yours, I offer:
- White-label service (your branding, my AI tech)
- Bulk pricing for client campaigns
- 11 signature styles
- Brand color matching to existing packaging designs
- API access for automated generation

Each QR art design is $49 retail, with agency volume discounts available.

Portfolio: https://qron-portfolio.undone-k.workers.dev/

Happy to create a free sample for one of your clients. What do you think?

Best,
Z | QRON
authichain@gmail.com

---
To unsubscribe from future emails, reply with "unsubscribe".`
  },
  {
    to: "christopher.kwilasz@lume.com",
    name: "Christopher",
    subject: "Custom QR Art for Lume Cannabis — Free Sample",
    body: `Hi Christopher,

As Michigan's largest cannabis company, Lume's packaging is seen by thousands daily. Your QR codes don't have to be boring black squares.

I create AI-generated artistic QR codes — scannable art that matches your brand. 25-40% more engagement than standard codes.

$49/design or $199 for 5. 100% scan guarantee. 24-hour delivery.

Portfolio: https://qron-portfolio.undone-k.workers.dev/

Reply with a URL and I'll create a free Lume-branded sample.

Best,
Z | QRON
authichain@gmail.com

---
To unsubscribe from future emails, reply with "unsubscribe".`
  },
  {
    to: "contact@cannabiscreative.com",
    name: "Cannabis Creative team",
    subject: "White-Label AI QR Art for Your Cannabis Packaging Clients",
    body: `Hi Cannabis Creative team,

Your print and packaging design work for cannabis brands pairs perfectly with what I offer.

I run QRON — an AI-powered platform that transforms standard QR codes into scannable works of art. The white-label opportunity:
- You offer "Premium QR Art" as an add-on to packaging projects
- I handle all generation (AI-powered, 11 signature styles)
- Your branding, your client relationship
- $49 retail per design, agency volume discounts available

Every code is 100% scan-tested and works with any compliance system.

Portfolio: https://qron-portfolio.undone-k.workers.dev/

Happy to create a free branded sample for one of your clients.

Best,
Z | QRON
authichain@gmail.com

---
To unsubscribe from future emails, reply with "unsubscribe".`
  },
  {
    to: "Helpteam@oakleysign.com",
    name: "Oakley Signs Team",
    subject: "AI QR Art Partnership — Upgrade Your Real Estate Sign QR Codes",
    body: `Hi Oakley Signs Team,

I saw your partnership with Local Logic for QR-enabled signage. I'd like to propose a visual upgrade that makes your QR signs even more compelling.

I run QRON — artistic QR codes see 25-40% more scans than standard codes. For agents, that means more virtual tour views and more leads.

Partnership options:
- White-label: "Premium QR Art" add-on to existing sign orders
- API integration: automated artistic QR generation in your ordering workflow
- Bulk pricing for your 50+ brokerage partners

Portfolio: https://qron-portfolio.undone-k.workers.dev/

Happy to create free samples using any brokerage's brand colors.

Best,
Z | QRON
authichain@gmail.com

---
To unsubscribe from future emails, reply with "unsubscribe".`
  },
  {
    to: "info@creativevinylsigns.com",
    name: "Creative Vinyl Signs team",
    subject: "White-Label AI QR Art for Your Cannabis Packaging Clients",
    body: `Hi Creative Vinyl Signs team,

I see you provide cannabis branding and packaging services in Michigan. I have a service that could be a great upsell for your clients.

QRON creates AI-generated artistic QR codes — transforming boring compliance codes into premium brand assets.

White-label available: your branding, my AI tech. $49/design retail, volume discounts for partners.

Portfolio: https://qron-portfolio.undone-k.workers.dev/

Reply for a free sample.

Best,
Z | QRON
authichain@gmail.com

---
To unsubscribe from future emails, reply with "unsubscribe".`
  }
];

export default {
  async fetch(request: Request, env: any) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return Response.json({ status: 'ok', worker: 'qron-outreach', queue: OUTREACH_QUEUE.length });
    }

    // Auth check for sensitive routes
    const authToken = env.AUTH_TOKEN;
    const isAuthed = !!authToken && (
      timingSafeEqual(url.searchParams.get('key') ?? '', authToken)
      || timingSafeEqual(request.headers.get('Authorization') ?? '', `Bearer ${authToken}`));

    if (url.pathname === '/status') {
      if (!isAuthed) return new Response('Unauthorized', { status: 401 });
      let sent: any[] = [];
      if (env.KV) {
        const data = await env.KV.get('outreach_sent');
        if (data) sent = JSON.parse(data);
      }
      return Response.json({
        total: OUTREACH_QUEUE.length,
        sent: sent.length,
        remaining: OUTREACH_QUEUE.length - sent.length,
        sentEmails: sent,
        timestamp: new Date().toISOString()
      });
    }

    if (url.pathname === '/send-next') {
      if (!isAuthed) return new Response('Unauthorized', { status: 401 });
      // Send 1 at a time to protect domain reputation
      const result = await sendNextBatch(env, 1);
      return Response.json(result);
    }

    if (url.pathname === '/send-all') {
      if (!isAuthed) return new Response('Unauthorized', { status: 401 });
      const result = await sendAll(env);
      return Response.json(result);
    }

    return new Response(`QRON Outreach Engine
Queue: ${OUTREACH_QUEUE.length} emails (named contacts only — no guessed addresses)
Rate: 1 per cron trigger
Endpoints:
  /health - Health check
  /status?key=TOKEN - Check send progress
  /send-next?key=TOKEN - Send next 1 email
  /send-all?key=TOKEN - Send all remaining emails`);
  },

  async scheduled(event: any, env: any, ctx: any) {
    // Send 1 email per cron trigger (reduced from 3 to protect domain reputation)
    ctx.waitUntil(sendNextBatch(env, 1));
  }
};

async function getSentList(env: any): Promise<any[]> {
  if (!env.KV) return [];
  const data = await env.KV.get('outreach_sent');
  return data ? JSON.parse(data) : [];
}

async function saveSentList(env: any, sent: any[]) {
  if (env.KV) {
    await env.KV.put('outreach_sent', JSON.stringify(sent), { expirationTtl: 86400 * 30 });
  }
}

async function sendNextBatch(env: any, count: number) {
  const sent = await getSentList(env);
  const sentEmails = new Set(sent.map(s => s.to));
  const toSend = OUTREACH_QUEUE.filter(e => !sentEmails.has(e.to)).slice(0, count);

  const results = [];
  for (const email of toSend) {
    const ok = await sendViaResend(email);
    results.push({ to: email.to, subject: email.subject, sent: ok, timestamp: new Date().toISOString() });
    if (ok) {
      sent.push({ to: email.to, subject: email.subject, sentAt: new Date().toISOString() });
    }
  }

  await saveSentList(env, sent);

  if (sent.length >= OUTREACH_QUEUE.length) {
    await sendViaResend({
      to: 'authichain@gmail.com',
      name: 'AuthiChain',
      subject: 'QRON Outreach Complete — All Emails Sent',
      body: `All ${OUTREACH_QUEUE.length} outreach emails have been sent.\n\nSent to:\n${sent.map(s => `- ${s.to} (${s.sentAt})`).join('\n')}\n\nCheck responses in authichain@gmail.com.`
    });
  }

  return { batch: results, totalSent: sent.length, totalQueue: OUTREACH_QUEUE.length };
}

async function sendAll(env: any) {
  const sent = await getSentList(env);
  const sentEmails = new Set(sent.map(s => s.to));
  const toSend = OUTREACH_QUEUE.filter(e => !sentEmails.has(e.to));

  const results = [];
  for (const email of toSend) {
    const ok = await sendViaResend(email);
    results.push({ to: email.to, sent: ok });
    if (ok) {
      sent.push({ to: email.to, subject: email.subject, sentAt: new Date().toISOString() });
    }
    await new Promise(r => setTimeout(r, 1000));
  }

  await saveSentList(env, sent);
  return { sent: results.filter(r => r.sent).length, failed: results.filter(r => !r.sent).length, results };
}

async function sendViaResend(email: Email) {
  try {
    const resp = await fetch('https://resend-relay.undone-k.workers.dev/emails', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: email.to,
        subject: email.subject,
        text: email.body,
        from: 'Z | QRON AI QR Art <hello@authichain.com>',
        reply_to: 'authichain@gmail.com',
        headers: {
          'List-Unsubscribe': '<mailto:authichain@gmail.com?subject=unsubscribe>',
          'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
        }
      })
    });
    const result: any = await resp.json();
    console.log(`Email to ${email.to}: ${result.ok ? 'sent' : 'failed'}`);
    return result.ok || false;
  } catch (e: any) {
    console.error(`Email error for ${email.to}:`, e.message);
    return false;
  }
}
