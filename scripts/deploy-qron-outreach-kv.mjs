#!/usr/bin/env node
/**
 * SECURITY FIX: Write qron-outreach email queue data to Cloudflare KV
 *
 * This script writes the outreach_queue and sender_config to KV,
 * removing hardcoded PII from the worker source code.
 *
 * Prerequisites:
 *   - Set CLOUDFLARE_API_TOKEN env var (needs KV write permissions)
 *   - Or run: npx wrangler login (on a supported platform)
 *
 * Usage:
 *   CLOUDFLARE_API_TOKEN=<token> node scripts/deploy-qron-outreach-kv.mjs
 *
 *   Or with wrangler (on supported platforms):
 *   npx wrangler kv key put --namespace-id=291baff0863044998e9ba716dfc06085 "outreach_queue" "$(cat scripts/kv-data/outreach_queue.json)"
 *   npx wrangler kv key put --namespace-id=291baff0863044998e9ba716dfc06085 "sender_config" "$(cat scripts/kv-data/sender_config.json)"
 */

const ACCOUNT_ID = '4c1869b90f13f86940aa3747839bf420';
const NAMESPACE_ID = '291baff0863044998e9ba716dfc06085';

const API_TOKEN = process.env.CLOUDFLARE_API_TOKEN;

if (!API_TOKEN) {
  console.error('ERROR: CLOUDFLARE_API_TOKEN environment variable is required.');
  console.error('Create a token at: https://dash.cloudflare.com/profile/api-tokens');
  console.error('Required permission: Workers KV Storage:Edit');
  process.exit(1);
}

const OUTREACH_QUEUE = [
  {
    to: "stacy@missionrestaurantgroup.com",
    name: "Stacy",
    subject: "Custom QR Art for Your Restaurant Menus \u2013 40% More Scans",
    body: `Hi Stacy,

I came across Mission Restaurant Group and I'm impressed by your portfolio of Michigan restaurants. I'd love to help elevate your menu QR codes.

I create AI-generated artistic QR codes using QRON \u2013 each one is a unique piece of art that's 100% scannable. Clients see 25-40% more scans because customers actually want to scan something beautiful.

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

I saw Fat Squirrel's work in cannabis brand design across Michigan \u2013 impressive portfolio. I have a service that could complement what you offer your dispensary clients.

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
    subject: "Custom QR Art for Lume Cannabis \u2013 Free Sample",
    body: `Hi Christopher,

As Michigan's largest cannabis company, Lume's packaging is seen by thousands daily. Your QR codes don't have to be boring black squares.

I create AI-generated artistic QR codes \u2013 scannable art that matches your brand. 25-40% more engagement than standard codes.

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

I run QRON \u2013 an AI-powered platform that transforms standard QR codes into scannable works of art. The white-label opportunity:
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

I create AI-generated artistic QR codes \u2013 my clients see 25-40% more scans, and diners say the codes are conversation starters.

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
    subject: "AI QR Art Partnership \u2013 Upgrade Your Real Estate Sign QR Codes",
    body: `Hi Oakley Signs Team,

I saw your partnership with Local Logic for QR-enabled signage. I'd like to propose a visual upgrade that makes your QR signs even more compelling.

I run QRON \u2013 artistic QR codes see 25-40% more scans than standard codes. For agents, that means more virtual tour views and more leads.

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

QRON creates AI-generated artistic QR codes \u2013 transforming boring compliance codes into premium brand assets.

White-label available: your branding, my AI tech. $49/design retail, volume discounts for partners.

Portfolio: https://qron-portfolio.undone-k.workers.dev/

Reply for a free sample.

Best,
Z | QRON
authichain@gmail.com`
  }
];

const SENDER_CONFIG = {
  from: "hello@authichain.com",
  fromName: "Z | QRON AI QR Art",
  replyTo: "authichain@gmail.com"
};

async function writeKV(key, value) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${NAMESPACE_ID}/values/${encodeURIComponent(key)}`;

  const resp = await fetch(url, {
    method: 'PUT',
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
      'Content-Type': 'text/plain',
    },
    body: typeof value === 'string' ? value : JSON.stringify(value),
  });

  const result = await resp.json();

  if (!result.success) {
    console.error(`FAILED to write key "${key}":`, JSON.stringify(result.errors, null, 2));
    return false;
  }

  console.log(`SUCCESS: Key "${key}" written to KV namespace ${NAMESPACE_ID}`);
  return true;
}

async function verifyKV(key) {
  const url = `https://api.cloudflare.com/client/v4/accounts/${ACCOUNT_ID}/storage/kv/namespaces/${NAMESPACE_ID}/values/${encodeURIComponent(key)}`;

  const resp = await fetch(url, {
    headers: {
      'Authorization': `Bearer ${API_TOKEN}`,
    },
  });

  if (resp.ok) {
    const data = await resp.text();
    console.log(`VERIFY: Key "${key}" exists (${data.length} bytes)`);
    return true;
  } else {
    console.error(`VERIFY FAILED: Key "${key}" not found (${resp.status})`);
    return false;
  }
}

async function main() {
  console.log('=== QRON Outreach KV Security Fix ===');
  console.log(`Account: ${ACCOUNT_ID}`);
  console.log(`Namespace: ${NAMESPACE_ID} (qron-outreach-kv)`);
  console.log('');

  // Write outreach_queue
  console.log(`Writing outreach_queue (${OUTREACH_QUEUE.length} email objects)...`);
  const q1 = await writeKV('outreach_queue', JSON.stringify(OUTREACH_QUEUE));

  // Write sender_config
  console.log(`Writing sender_config...`);
  const q2 = await writeKV('sender_config', JSON.stringify(SENDER_CONFIG));

  console.log('');

  if (q1 && q2) {
    console.log('--- Verifying writes ---');
    await verifyKV('outreach_queue');
    await verifyKV('sender_config');
    console.log('');
    console.log('ALL KV DATA WRITTEN SUCCESSFULLY.');
    console.log('');
    console.log('Next step: Deploy the fixed worker code from:');
    console.log('  scripts/qron-outreach-fixed.js');
    console.log('');
    console.log('Deploy command:');
    console.log('  npx wrangler deploy --name qron-outreach scripts/qron-outreach-fixed.js');
    console.log('  (or use the Cloudflare dashboard to paste the fixed code)');
  } else {
    console.error('SOME WRITES FAILED. Check errors above.');
    process.exit(1);
  }
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
