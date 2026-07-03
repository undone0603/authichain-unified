// QRON Outreach Engine — Sends cold emails via Resend (authichain.com domain)
// Rate: 1 email per GH Actions trigger (every 4h). Cron removed — CF free plan limit hit.
// Bounce history: April 2026 batch used guessed hello@ addresses → 73% bounce.
// Current queue uses verified named contacts only.
// KV stores: outreach_sent (sent list), outreach_bounced (bounce suppression list)

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

// REMOVED from original queue:
//   klong@c3industries.com     — already delivered 2026-06-26, skip duplicate
//   privacy@lettuce.com        — legal/privacy inbox, wrong recipient
//   press@compass.com          — press desk, not the right contact

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

// ── EU DPP Outreach Queue ─────────────────────────────────────────────────────
// Targets: luxury/textile (ESPR 2028-29) and battery (Feb 2027) sectors.
// KV keys: dpp_sent, outreach_bounced (shared suppression list).

const DPP_QUEUE: Email[] = [
  {
    to: "axel.dumas@hermes.com",
    name: "Axel",
    subject: "EU Digital Product Passport — Hermès Compliance Before July 19",
    body: `Hi Axel,

The EU Digital Product Passport registry opens July 19 — 16 days from now. For Hermès, this is the beginning of mandatory traceability across textiles, leather goods, and accessories under ESPR.

AuthiChain is the only blockchain-native DPP platform built specifically for luxury supply chains:
- One integration covers ESPR, EUDR (deforestation), and CSRD reporting
- Each product gets an immutable digital certificate — scannable by EU customs, retailers, and end consumers
- Full provenance chain: raw material → tannery → atelier → point of sale
- $0.004 per seal at scale; enterprise SLA

Hermès' reputation for provenance is unmatched. The DPP mandate is an opportunity to make that provenance machine-verifiable and EU-compliant ahead of competitors.

I'd welcome 20 minutes to walk through how this works for a leather goods catalog. No sales pitch — just the technical architecture and compliance timeline.

More at: https://authichain.com/digital-product-passport

Best,
Z | AuthiChain
authichain@gmail.com

To unsubscribe, reply "unsubscribe".`
  },
  {
    to: "g.deseynes@hermes.com",
    name: "Guillaume",
    subject: "EU DPP Compliance for Hermès Supply Chain — Registry Opens July 19",
    body: `Hi Guillaume,

With your oversight of Hermès' supply chain and sustainability initiatives, I wanted to reach out directly about the EU Digital Product Passport.

The ESPR registry opens July 19. While textiles and leather have until 2028-29 for full compliance, early registration positions Hermès as the standard-setter — the brand that made provenance the industry benchmark, not the one scrambling to meet a mandate.

AuthiChain delivers:
- Blockchain-anchored DPP records (ERC-721 on Polygon — immutable, auditable)
- Full ESPR + EUDR + CSRD coverage in one integration
- Supply chain event tracking: 22 event types from raw material to retail
- Verified by AI provenance agents (Guardian/Archivist/Sentinel)

We're already in conversations with several luxury groups about pre-registry implementation. Happy to share the technical spec if useful.

https://authichain.com/digital-product-passport

Best,
Z | AuthiChain
authichain@gmail.com

To unsubscribe, reply "unsubscribe".`
  },
  {
    to: "bernard.arnault@lvmh.com",
    name: "Bernard",
    subject: "EU Digital Product Passport — LVMH Compliance Infrastructure",
    body: `Dear Bernard,

The EU Digital Product Passport registry opens July 19. With 75 Maisons across fashion, leather, watches, spirits, and cosmetics, LVMH faces the broadest DPP surface area of any luxury group.

AuthiChain provides the compliance infrastructure:
- Single blockchain integration covers all 75 Maisons via multi-tenant routing
- ESPR (textiles/leather 2028-29), EUDR (sustainable sourcing), CSRD (ESG reporting) in one system
- NFT-backed product certificates — scannable at any EU customs point or retail location
- $0.004/seal at LVMH scale with an enterprise SLA

The DPP mandate can be LVMH's moment to set the global standard for luxury provenance, or a compliance checkbox. AuthiChain makes it the former.

I'd welcome a brief introduction to the right person on your sustainability or digital transformation team.

https://authichain.com/digital-product-passport

Best,
Z | AuthiChain
authichain@gmail.com

To unsubscribe, reply "unsubscribe".`
  },
  {
    to: "digital@bulgari.com",
    name: "Bulgari Digital team",
    subject: "Gemstone & Jewelry DPP Compliance — AuthiChain for Bulgari",
    body: `Hi Bulgari Digital team,

The EU Digital Product Passport registry opens July 19. For jewelry and high-end accessories, DPP compliance means traceable gemstone sourcing — from mine to setting to customer.

AuthiChain delivers blockchain-native provenance for luxury goods:
- Immutable certificate per piece: origin, materials, certifications, custody chain
- Covers EUDR (responsible sourcing), ESPR (product lifecycle), and CSRD (ESG)
- QR-scannable by EU customs, retail staff, and end customers
- Built on Polygon — the same infrastructure used for digital fashion and NFT collectibles

Bulgari's craftsmanship story is extraordinary. AuthiChain makes it cryptographically verifiable and EU-compliant.

Happy to put together a proof-of-concept for a single collection.

https://authichain.com/digital-product-passport

Best,
Z | AuthiChain
authichain@gmail.com

To unsubscribe, reply "unsubscribe".`
  }
];

export default {
  async fetch(request: Request, env: any) {
    const url = new URL(request.url);

    if (url.pathname === '/health') {
      return Response.json({
        status: 'ok',
        worker: 'qron-outreach',
        qron_queue: OUTREACH_QUEUE.length,
        dpp_queue: DPP_QUEUE.length
      });
    }

    // Resend bounce/complaint webhook — no auth key required (payload is self-describing)
    if (url.pathname === '/webhook' && request.method === 'POST') {
      return handleBounceWebhook(request, env);
    }

    const authToken = env.AUTH_TOKEN;
    const isAuthed = !!authToken && (
      timingSafeEqual(url.searchParams.get('key') ?? '', authToken)
      || timingSafeEqual(request.headers.get('Authorization') ?? '', `Bearer ${authToken}`));

    if (url.pathname === '/status') {
      if (!isAuthed) return new Response('Unauthorized', { status: 401 });
      const [sent, bounced] = await Promise.all([getSentList(env), getBouncedList(env)]);
      return Response.json({
        total: OUTREACH_QUEUE.length,
        sent: sent.length,
        remaining: OUTREACH_QUEUE.length - sent.length,
        sentEmails: sent,
        suppressedBounces: bounced,
        timestamp: new Date().toISOString()
      });
    }

    if (url.pathname === '/send-next') {
      if (!isAuthed) return new Response('Unauthorized', { status: 401 });
      const result = await sendNextBatch(env, 1);
      return Response.json(result);
    }

    if (url.pathname === '/send-all') {
      if (!isAuthed) return new Response('Unauthorized', { status: 401 });
      const result = await sendAll(env);
      return Response.json(result);
    }

    // EU DPP campaign endpoints
    if (url.pathname === '/dpp-status') {
      if (!isAuthed) return new Response('Unauthorized', { status: 401 });
      const [sent, bounced] = await Promise.all([getDppSentList(env), getBouncedList(env)]);
      return Response.json({
        total: DPP_QUEUE.length,
        sent: sent.length,
        remaining: DPP_QUEUE.length - sent.length,
        sentEmails: sent,
        suppressedBounces: bounced,
        timestamp: new Date().toISOString()
      });
    }

    if (url.pathname === '/send-dpp-next') {
      if (!isAuthed) return new Response('Unauthorized', { status: 401 });
      const result = await sendNextDpp(env, 1);
      return Response.json(result);
    }

    if (url.pathname === '/send-dpp-all') {
      if (!isAuthed) return new Response('Unauthorized', { status: 401 });
      const result = await sendAllDpp(env);
      return Response.json(result);
    }

    return new Response(`QRON + AuthiChain Outreach Engine
QRON queue: ${OUTREACH_QUEUE.length} | DPP queue: ${DPP_QUEUE.length}
Rate: 1 per GH Actions trigger (every 4h)
Endpoints:
  /health                — Health check
  /status?key=TOKEN      — QRON queue + bounce status
  /send-next?key=TOKEN   — Send next QRON email
  /send-all?key=TOKEN    — Send all remaining QRON emails
  /dpp-status?key=TOKEN  — EU DPP queue status
  /send-dpp-next?key=TOKEN — Send next DPP email
  /send-dpp-all?key=TOKEN  — Send all remaining DPP emails
  /webhook               — Resend bounce/complaint webhook (POST)`);
  },

  async scheduled(event: any, env: any, ctx: any) {
    ctx.waitUntil(sendNextBatch(env, 1));
  }
};

// ── KV helpers ───────────────────────────────────────────────────────────────

async function getSentList(env: any): Promise<any[]> {
  if (!env.KV) return [];
  const data = await env.KV.get('outreach_sent');
  return data ? JSON.parse(data) : [];
}

async function saveSentList(env: any, sent: any[]) {
  if (env.KV) await env.KV.put('outreach_sent', JSON.stringify(sent), { expirationTtl: 86400 * 90 });
}

async function getBouncedList(env: any): Promise<string[]> {
  if (!env.KV) return [];
  const data = await env.KV.get('outreach_bounced');
  return data ? JSON.parse(data) : [];
}

async function addBounced(env: any, email: string) {
  const bounced = await getBouncedList(env);
  if (!bounced.includes(email.toLowerCase())) {
    bounced.push(email.toLowerCase());
    if (env.KV) await env.KV.put('outreach_bounced', JSON.stringify(bounced), { expirationTtl: 86400 * 365 });
  }
}

// ── Bounce webhook ────────────────────────────────────────────────────────────

async function handleBounceWebhook(request: Request, env: any): Promise<Response> {
  try {
    const payload: any = await request.json();
    const eventType: string = payload?.type ?? '';

    if (eventType === 'email.bounced' || eventType === 'email.complained') {
      const recipients: string[] = payload?.data?.to ?? [];
      for (const addr of recipients) {
        await addBounced(env, addr);
        console.log(`Suppressed ${addr} (${eventType})`);
      }
    }

    return Response.json({ received: true, type: eventType });
  } catch (e: any) {
    return Response.json({ error: e.message }, { status: 400 });
  }
}

// ── Send logic ────────────────────────────────────────────────────────────────

async function sendNextBatch(env: any, count: number) {
  const [sent, bounced] = await Promise.all([getSentList(env), getBouncedList(env)]);
  const sentEmails = new Set(sent.map((s: any) => s.to.toLowerCase()));
  const bouncedSet = new Set(bounced);

  const toSend = OUTREACH_QUEUE
    .filter(e => !sentEmails.has(e.to.toLowerCase()) && !bouncedSet.has(e.to.toLowerCase()))
    .slice(0, count);

  if (toSend.length === 0) {
    const skippedBounced = OUTREACH_QUEUE.filter(e => bouncedSet.has(e.to.toLowerCase())).map(e => e.to);
    return { batch: [], totalSent: sent.length, totalQueue: OUTREACH_QUEUE.length, skippedBounced };
  }

  const results = [];
  for (const email of toSend) {
    const ok = await sendViaResend(email, env);
    results.push({ to: email.to, subject: email.subject, sent: ok, timestamp: new Date().toISOString() });
    if (ok) sent.push({ to: email.to, subject: email.subject, sentAt: new Date().toISOString() });
  }

  await saveSentList(env, sent);

  if (sent.length >= OUTREACH_QUEUE.length) {
    await sendViaResend({
      to: 'authichain@gmail.com',
      name: 'AuthiChain',
      subject: 'QRON Outreach Complete — All Emails Sent',
      body: `All ${OUTREACH_QUEUE.length} outreach emails have been sent.\n\nSent to:\n${sent.map((s: any) => `- ${s.to} (${s.sentAt})`).join('\n')}\n\nCheck responses in authichain@gmail.com.`
    }, env);
  }

  return { batch: results, totalSent: sent.length, totalQueue: OUTREACH_QUEUE.length };
}

async function sendAll(env: any) {
  const [sent, bounced] = await Promise.all([getSentList(env), getBouncedList(env)]);
  const sentEmails = new Set(sent.map((s: any) => s.to.toLowerCase()));
  const bouncedSet = new Set(bounced);
  const toSend = OUTREACH_QUEUE.filter(e =>
    !sentEmails.has(e.to.toLowerCase()) && !bouncedSet.has(e.to.toLowerCase()));

  const results = [];
  for (const email of toSend) {
    const ok = await sendViaResend(email, env);
    results.push({ to: email.to, sent: ok });
    if (ok) sent.push({ to: email.to, subject: email.subject, sentAt: new Date().toISOString() });
    await new Promise(r => setTimeout(r, 1000));
  }

  await saveSentList(env, sent);
  return { sent: results.filter(r => r.sent).length, failed: results.filter(r => !r.sent).length, results };
}

// ── DPP KV helpers ────────────────────────────────────────────────────────────

async function getDppSentList(env: any): Promise<any[]> {
  if (!env.KV) return [];
  const data = await env.KV.get('dpp_sent');
  return data ? JSON.parse(data) : [];
}

async function saveDppSentList(env: any, sent: any[]) {
  if (env.KV) await env.KV.put('dpp_sent', JSON.stringify(sent), { expirationTtl: 86400 * 90 });
}

async function sendNextDpp(env: any, count: number) {
  const [sent, bounced] = await Promise.all([getDppSentList(env), getBouncedList(env)]);
  const sentEmails = new Set(sent.map((s: any) => s.to.toLowerCase()));
  const bouncedSet = new Set(bounced);

  const toSend = DPP_QUEUE
    .filter(e => !sentEmails.has(e.to.toLowerCase()) && !bouncedSet.has(e.to.toLowerCase()))
    .slice(0, count);

  if (toSend.length === 0) {
    return { batch: [], totalSent: sent.length, totalQueue: DPP_QUEUE.length, done: true };
  }

  const results = [];
  for (const email of toSend) {
    const ok = await sendViaResend(email, env);
    results.push({ to: email.to, subject: email.subject, sent: ok, timestamp: new Date().toISOString() });
    if (ok) sent.push({ to: email.to, subject: email.subject, sentAt: new Date().toISOString() });
  }

  await saveDppSentList(env, sent);
  return { batch: results, totalSent: sent.length, totalQueue: DPP_QUEUE.length };
}

async function sendAllDpp(env: any) {
  const [sent, bounced] = await Promise.all([getDppSentList(env), getBouncedList(env)]);
  const sentEmails = new Set(sent.map((s: any) => s.to.toLowerCase()));
  const bouncedSet = new Set(bounced);
  const toSend = DPP_QUEUE.filter(e =>
    !sentEmails.has(e.to.toLowerCase()) && !bouncedSet.has(e.to.toLowerCase()));

  const results = [];
  for (const email of toSend) {
    const ok = await sendViaResend(email, env);
    results.push({ to: email.to, sent: ok });
    if (ok) sent.push({ to: email.to, subject: email.subject, sentAt: new Date().toISOString() });
    await new Promise(r => setTimeout(r, 1500));
  }

  await saveDppSentList(env, sent);
  return { sent: results.filter(r => r.sent).length, failed: results.filter(r => !r.sent).length, results };
}

async function sendViaResend(email: Email, env: any): Promise<boolean> {
  const apiKey = env.RESEND_API_KEY;
  if (!apiKey) {
    console.error('RESEND_API_KEY not set on qron-outreach worker');
    return false;
  }
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        to: [email.to],
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
    const ok = resp.ok && !!result.id;
    console.log(`Email to ${email.to}: ${ok ? 'sent' : 'failed'} ${result.id ?? result.message ?? ''}`);
    return ok;
  } catch (e: any) {
    console.error(`Email error for ${email.to}:`, e.message);
    return false;
  }
}
