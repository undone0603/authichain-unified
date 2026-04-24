// QRON Outreach Engine — Sends cold emails via Resend relay (authichain.com domain)
// Cron: sends 3 emails per trigger, cycles through the queue

interface Email {
  to: string;
  name: string;
  subject: string;
  body: string;
}

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
authichain@gmail.com`
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
authichain@gmail.com`
  },
  {
    to: "klong@c3industries.com",
    name: "Kathryn",
    subject: "Branded QR Art for High Profile Cannabis Packaging",
    body: `Hi Kathryn,

I noticed High Profile Cannabis is expanding across Michigan. Quick pitch: I create AI-generated artistic QR codes that transform standard packaging QR codes into premium brand assets.

Using QRON, your compliance QR codes become scannable art that:
- Matches High Profile's brand aesthetic perfectly
- Gets 25-40% more scans than standard codes
- Works with any compliance/seed-to-sale system
- Includes blockchain verification (AuthiChain technology)

$49 per design or $199 for a 5-pack. 100% scan guarantee.

Portfolio: https://qron-portfolio.undone-k.workers.dev/

Reply with your website URL and I'll generate a free branded sample.

Best,
Z | QRON
authichain@gmail.com`
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
authichain@gmail.com`
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
authichain@gmail.com`
  },
  {
    to: "privacy@lettuce.com",
    name: "Jennifer / Lettuce Entertain You Marketing Team",
    subject: "AI-Powered Menu QR Art for Lettuce Entertain You Restaurants",
    body: `Hi Jennifer,

With 130+ restaurants across your portfolio, your QR code menus are one of the first things millions of diners interact with each year.

I create AI-generated artistic QR codes — my clients see 25-40% more scans, and diners say the codes are conversation starters.

For a restaurant group your size, I can provide:
- Custom QR art matched to each restaurant's brand
- 100% scan guarantee
- High-res PNG + SVG for table tents, menus, signage
- Bulk pricing for your full portfolio

Portfolio: https://qron-portfolio.undone-k.workers.dev/

I'd love to create a free sample for one of your Chicago locations. Just reply with a menu URL.

Best,
Z | QRON
authichain@gmail.com`
  },
  {
    to: "press@compass.com",
    name: "Compass Marketing Team",
    subject: "AI-Powered QR Art for Compass Smart Signage",
    body: `Hi Compass Marketing Team,

I know Compass leads the industry in smart signage with QR technology. I'd like to propose a visual upgrade.

I run QRON, an AI-powered platform that turns standard QR codes into scannable works of art. Instead of generic black-and-white QR on yard signs, imagine Compass-branded artistic QR that gets 37%+ scan-through rates.

Partnership options:
- Custom QR art matching Compass brand guidelines
- Bulk pricing for agent teams and offices
- API available for automated generation at scale

Portfolio: https://qron-portfolio.undone-k.workers.dev/

Happy to create a free sample using a live Compass listing URL.

Best,
Z | QRON
authichain@gmail.com`
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
authichain@gmail.com`
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
authichain@gmail.com`
  }
];

export default {
  async fetch(request: Request, env: any) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return Response.json({ status: 'ok', worker: 'qron-outreach', queue: OUTREACH_QUEUE.length });
    }

    // Auth check for sensitive routes
    const authToken = env.AUTH_TOKEN || 'qron-ops-2026';
    const isAuthed = url.searchParams.get('key') === authToken
      || request.headers.get('Authorization') === `Bearer ${authToken}`;

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
      const result = await sendNextBatch(env, 3);
      return Response.json(result);
    }

    if (url.pathname === '/send-all') {
      if (!isAuthed) return new Response('Unauthorized', { status: 401 });
      const result = await sendAll(env);
      return Response.json(result);
    }

    return new Response(`QRON Outreach Engine
Queue: ${OUTREACH_QUEUE.length} emails
Endpoints:
  /health - Health check
  /status?key=TOKEN - Check send progress
  /send-next?key=TOKEN - Send next 3 emails
  /send-all?key=TOKEN - Send all remaining emails`);
  },

  async scheduled(event: any, env: any, ctx: any) {
    // Send 3 emails per cron trigger
    ctx.waitUntil(sendNextBatch(env, 3));
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

  // Notify on completion
  if (sent.length >= OUTREACH_QUEUE.length) {
    await sendViaResend({
      to: 'authichain@gmail.com',
      subject: 'QRON Outreach Complete — All Emails Sent',
      body: `All ${OUTREACH_QUEUE.length} outreach emails have been sent.\n\nSent to:\n${sent.map(s => `- ${s.to} (${s.sentAt})`).join('\n')}\n\nCheck responses in authichain@gmail.com.`
    } as Email);
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
    // Small delay between sends to avoid rate limits
    await new Promise(r => setTimeout(r, 500));
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
        reply_to: 'authichain@gmail.com'
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
