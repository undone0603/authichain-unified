// AuthiChain B2B API Gateway — Cloudflare Worker
// Provides demo API access for product authentication
// Rate-limited, key-authenticated, usage-tracked
// NOTE: All responses are simulated (demo mode). No real blockchain integration yet.

export default {
  async fetch(request: Request, env: any) {
    const url = new URL(request.url);
    const path = url.pathname;
    const cors = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-API-Key'
    };

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors });

    // Documentation page
    if (path === '/' || path === '/docs') return new Response(DOCS_HTML, { headers: { ...cors, 'Content-Type': 'text/html; charset=utf-8' } });

    // Health check
    if (path === '/health') return json({ status: 'ok', mode: 'demo', version: '1.0.0', timestamp: new Date().toISOString(), notice: 'Demo mode — returns simulated responses' }, cors);

    // Stripe webhook — no API key required
    if (path === '/webhook/stripe' && request.method === 'POST') {
      return handleStripeWebhook(request, env, cors);
    }

    // Checkout success page — no API key required
    if (path === '/checkout/success') {
      return handleCheckoutSuccess(request, env, cors);
    }

    // Lead capture — no API key required
    if (path === '/api/v1/leads' && request.method === 'POST') {
      return handleLeadCapture(request, env, cors);
    }

    // v2 endpoints use X-Admin-Key, not demo API keys — handle before API key gate
    if (path.startsWith('/api/v2/')) {
      return handleV2(request, path, url, env, cors);
    }

    // API key validation
    const apiKey = request.headers.get('X-API-Key') || request.headers.get('Authorization')?.replace('Bearer ', '');
    if (!apiKey) return json({ error: 'Missing API key. Get one at https://api.authichain.com/docs' }, cors, 401);

    // Key status endpoint
    if (path === '/api/v1/key/status') {
      return handleKeyStatus(apiKey, env, cors);
    }

    // Resolve key data: check KV for provisioned keys, fall back to demo
    let keyData: { name: string; plan: string; limit: number };
    const isDemo = apiKey === 'demo_test_key_2026';

    if (isDemo) {
      keyData = { name: 'Free', plan: 'free', limit: 10 };
    } else if (env.API_KEYS) {
      const raw = await env.API_KEYS.get(`key:${apiKey}`);
      if (raw) {
        const stored = JSON.parse(raw);
        if (!stored.active) return json({ error: 'API key has been deactivated.' }, cors, 403);
        keyData = { name: stored.name, plan: stored.plan, limit: stored.limit };
      } else {
        return json({ error: 'Invalid API key. Get one at https://api.authichain.com/docs', validDemo: 'demo_test_key_2026' }, cors, 401);
      }
    } else {
      keyData = { name: 'Free', plan: 'free', limit: 10 };
    }

    // Rate Limiting (KV-backed)
    if (env.RATE_LIMITS) {
      const limitKey = `usage:${apiKey}:${new Date().getUTCHours()}`;
      const currentUsage = parseInt(await env.RATE_LIMITS.get(limitKey) || '0');

      if (currentUsage >= keyData.limit) {
        return json({ error: 'Rate limit exceeded for this hour.', plan: keyData.name, limit: keyData.limit, upgrade: 'https://api.authichain.com/docs#pricing' }, cors, 429);
      }
      await env.RATE_LIMITS.put(limitKey, (currentUsage + 1).toString(), { expirationTtl: 3600 });
    }

    // Route handling
    try {
      if (path === '/api/v1/classify' && request.method === 'POST') {
        const body: any = await request.json();
        return json({
          success: true,
          mode: 'demo',
          notice: 'Demo mode — returns simulated responses',
          classification: {
            name: body.name || 'Sample Product',
            category: body.category || 'Electronics',
            brand: body.brand || 'Unknown',
            industryId: 'electronics',
            industry: 'Electronics & Technology',
            confidence: 95,
            features: ['AI-classified', 'Blockchain-ready'],
            authenticityFeatures: ['Serial number validation', 'Firmware signature', 'Component check'],
            workflow: [
              { id: 'source', name: 'Component Sourcing', icon: '&#9881;', duration: '30-60 days' },
              { id: 'assemble', name: 'Assembly', icon: '&#128295;', duration: '5-10 days' },
              { id: 'test', name: 'Quality Testing', icon: '&#9989;', duration: '2-5 days' },
              { id: 'certify', name: 'Certification', icon: '&#128272;', duration: '1-3 days' },
              { id: 'ship', name: 'Shipping', icon: '&#128230;', duration: '3-7 days' }
            ],
            story: 'This product was manufactured using verified components from certified suppliers, assembled in an ISO-9001 facility, and authenticated on the AuthiChain blockchain.'
          },
          plan: keyData.name,
          usage: { remaining: keyData.limit - 1 }
        }, cors);
      }

      if (path === '/api/v1/verify' && request.method === 'POST') {
        const body: any = await request.json();
        const productId = body.productId || body.truemarkId || body.qrCode || 'UNKNOWN';
        return json({
          success: true,
          mode: 'demo',
          notice: 'Demo mode — hash is simulated, not a real blockchain transaction',
          result: 'authentic',
          product: {
            id: productId,
            name: 'Verified Product',
            brand: 'AuthiChain Verified',
            registeredAt: '2026-01-15T10:30:00Z',
            blockchainTxHash: 'demo_simulated_hash'
          },
          confidence: 0.98,
          trustScore: 96,
          qronId: 'QRON-' + Math.random().toString(36).substr(2, 8).toUpperCase(),
          actions: ['view_certificate', 'share_verification', 'report_issue'],
          plan: 'Pro'
        }, cors);
      }

      if (path === '/api/v1/forensic-scan' && request.method === 'POST') {
        const body: any = await request.json();
        // Simulated Magic Eye depth-shift analysis logic
        const hasForensicPattern = body.image || body.qrCode;
        return json({
          success: true,
          mode: 'demo',
          forensicStatus: hasForensicPattern ? 'MATCH' : 'NOT_FOUND',
          depthShiftScore: hasForensicPattern ? 0.94 : 0,
          authenticity: hasForensicPattern ? 'CONFIRMED_ARTIFACT' : 'UNVERIFIED_COPY',
          notice: 'Magic Eye technology detected the underlying cryptographic depth map.'
        }, cors);
      }

      if (path === '/api/v1/storymode' && request.method === 'POST') {
        const body: any = await request.json();
        return json({
          success: true,
          mode: 'demo',
          story: {
            title: body.productName + " Journey",
            chapters: [
              { stage: "Origin", content: "The raw materials were sourced under the AuthiChain Truth Protocol." },
              { stage: "Curation", content: "AI AutoFlow classified the assembly as High-Fidelity Artisanal." },
              { stage: "Sealing", content: "The TrueMark seal was applied, anchoring the item to the global economy." }
            ],
            visualAesthetic: "Cinematic Glassmorphism",
            nftStatus: "MINT_READY"
          }
        }, cors);
      }

      if (path === '/api/v1/mint-nft' && request.method === 'POST') {
        if (keyData.plan === 'free') return json({ error: 'NFT minting requires Starter plan or above', upgrade: 'https://authichain.com/pricing', mode: 'demo', notice: 'Demo mode — returns simulated responses' }, cors, 403);
        const body: any = await request.json();
        return json({
          success: true,
          mode: 'demo',
          notice: 'Demo mode — no actual NFT is minted. Blockchain integration planned for Q3 2026.',
          nft: {
            tokenId: Math.floor(Math.random() * 1000000),
            contractAddress: 'demo_simulated',
            chain: 'demo_simulated',
            metadata: {
              name: body.name || 'AuthiChain Certificate',
              description: 'Simulated product authentication certificate (demo mode)',
              image: 'https://authichain-api.undone-k.workers.dev/placeholder.png',
              attributes: [
                { trait_type: 'Confidence', value: 98 },
                { trait_type: 'Industry', value: body.industry || 'General' },
                { trait_type: 'Rarity', value: 'Verified' }
              ]
            }
          },
          plan: keyData.name
        }, cors);
      }

      if (path === '/api/v1/industries') {
        return json({
          success: true,
          mode: 'demo',
          notice: 'Demo mode — returns simulated responses',
          industries: [
            { id: 'cannabis', name: 'Cannabis & Hemp', icon: '&#127807;', marketSize: '$30B' },
            { id: 'luxury', name: 'Luxury Goods', icon: '&#128142;', marketSize: '$340B' },
            { id: 'electronics', name: 'Electronics', icon: '&#128241;', marketSize: '$1.5T' },
            { id: 'pharma', name: 'Pharmaceuticals', icon: '&#128138;', marketSize: '$1.4T' },
            { id: 'fashion', name: 'Fashion & Apparel', icon: '&#128084;', marketSize: '$1.7T' },
            { id: 'auto', name: 'Automotive Parts', icon: '&#128663;', marketSize: '$400B' },
            { id: 'food', name: 'Food & Beverage', icon: '&#127863;', marketSize: '$8.5T' },
            { id: 'art', name: 'Art & Collectibles', icon: '&#127912;', marketSize: '$65B' },
            { id: 'cosmetics', name: 'Cosmetics & Beauty', icon: '&#128132;', marketSize: '$511B' },
            { id: 'sports', name: 'Sports Equipment', icon: '&#9917;', marketSize: '$180B' }
          ],
          totalTAM: '$14T+'
        }, cors);
      }

      if (path === '/api/v1/pricing') {
        return json({
          success: true,
          mode: 'demo',
          notice: 'Demo mode — returns simulated responses',
          plans: [
            { name: 'Free', price: '$0', requests: 10, features: ['Classification API', 'Verification API', 'Community support'] },
            { name: 'StrainChain Basic', price: '$199/mo', requests: 'Standard', features: ['StrainChain cannabis compliance tracking', 'Basic analytics', 'Email support'], stripeLink: 'https://buy.stripe.com/14A4gz9brgbQdOG4ba1Nu0w' },
            { name: 'StrainChain Pro', price: '$499/mo', requests: 'Enhanced', features: ['All Basic features', 'Advanced analytics', 'Priority support', 'API access'], stripeLink: 'https://buy.stripe.com/8x28wP5Zf1gWcKC4ba1Nu0x' },
            { name: 'StrainChain Enterprise', price: '$999/mo', requests: 'Unlimited', features: ['All Pro features', 'White-label', 'SLA guarantee', 'Dedicated support', 'Custom integrations'], stripeLink: 'https://buy.stripe.com/aFaaEX9br4t8dOG8rq1Nu0y' },
            { name: 'QRON Single', price: '$49', requests: 'One-time', features: ['Single QR code generation', 'Basic customization'], stripeLink: 'https://buy.stripe.com/6oU3cvafv1gW25YcHG1Nu0z' },
            { name: 'QRON Brand Pack', price: '$199', requests: 'One-time', features: ['Multiple QR codes', 'Brand customization', 'Analytics dashboard'], stripeLink: 'https://buy.stripe.com/aFabJ1cnD9Ns25Y7nm1Nu0A' },
            { name: 'QRON Enterprise', price: '$999/mo', requests: 'Unlimited', features: ['Unlimited QR codes', 'Full brand suite', 'API access', 'Priority support', 'Custom integrations'], stripeLink: 'https://buy.stripe.com/bJe9AT3R7gbQ9yq9vu1Nu0B' }
          ]
        }, cors);
      }

      return json({ error: 'Not found', endpoints: ['/api/v1/classify', '/api/v1/verify', '/api/v1/mint-nft', '/api/v1/industries', '/api/v1/pricing', '/api/v1/leads (POST)', '/checkout/success', '/api/v2/accounts (POST)', '/api/v2/accounts/:id (GET)'], mode: 'demo', notice: 'Demo mode — returns simulated responses' }, cors, 404);
    } catch (e: any) {
      return json({ error: 'Internal error', message: e.message, mode: 'demo', notice: 'Demo mode — returns simulated responses' }, cors, 500);
    }
  }
};

function json(data: any, cors: any, status = 200) {
  return new Response(JSON.stringify(data, null, 2), {
    status,
    headers: { ...cors, 'Content-Type': 'application/json' }
  });
}

function generateApiKey(plan: string): string {
  const prefix = plan === 'free' ? 'ac_free' : plan === 'starter' ? 'ac_starter' : 'ac_pro';
  const rand = Array.from(crypto.getRandomValues(new Uint8Array(16)))
    .map(b => b.toString(36).padStart(2, '0')).join('').slice(0, 24);
  return `${prefix}_${rand}`;
}

async function verifyStripeSignature(body: string, sigHeader: string, secret: string): Promise<boolean> {
  const parts = Object.fromEntries(sigHeader.split(',').map(p => { const [k, v] = p.split('='); return [k, v]; }));
  const timestamp = parts['t'];
  const v1 = parts['v1'];
  if (!timestamp || !v1) return false;

  const payload = `${timestamp}.${body}`;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  const expected = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, '0')).join('');
  return expected === v1;
}

const PLAN_MAP: Record<string, { plan: string; limit: number; name: string }> = {
  'price_strainchain_basic': { plan: 'starter', limit: 1000, name: 'StrainChain Basic' },
  'price_strainchain_pro': { plan: 'pro', limit: 10000, name: 'StrainChain Pro' },
  'price_strainchain_enterprise': { plan: 'enterprise', limit: 100000, name: 'StrainChain Enterprise' },
  'price_qron_single': { plan: 'starter', limit: 100, name: 'QRON Single' },
  'price_qron_brand': { plan: 'pro', limit: 5000, name: 'QRON Brand Pack' },
  'price_qron_enterprise': { plan: 'enterprise', limit: 100000, name: 'QRON Enterprise' },
};

// ── Stripe Webhook — provisions API keys on checkout ────────────────────

async function handleStripeWebhook(request: Request, env: any, cors: any): Promise<Response> {
  const body = await request.text();
  const sig = request.headers.get('Stripe-Signature');

  if (!sig || !env.STRIPE_WEBHOOK_SECRET) {
    return json({ error: 'Missing signature or webhook secret' }, cors, 400);
  }

  const valid = await verifyStripeSignature(body, sig, env.STRIPE_WEBHOOK_SECRET);
  if (!valid) {
    return json({ error: 'Invalid signature' }, cors, 401);
  }

  const event = JSON.parse(body);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_email || session.customer_details?.email;
    const priceId = session.line_items?.data?.[0]?.price?.id || 'unknown';
    const planInfo = PLAN_MAP[priceId] || { plan: 'starter', limit: 1000, name: 'AuthiChain Starter' };

    const apiKey = generateApiKey(planInfo.plan);
    const keyData = {
      key: apiKey,
      email,
      plan: planInfo.plan,
      name: planInfo.name,
      limit: planInfo.limit,
      stripeSessionId: session.id,
      stripeCustomerId: session.customer,
      createdAt: new Date().toISOString(),
      active: true,
    };

    if (env.API_KEYS) {
      await env.API_KEYS.put(`key:${apiKey}`, JSON.stringify(keyData));
      await env.API_KEYS.put(`session:${session.id}`, JSON.stringify(keyData), { expirationTtl: 86400 });
      if (email) {
        await env.API_KEYS.put(`email:${email}`, JSON.stringify(keyData));
      }
    }

    return json({ received: true, apiKey, plan: planInfo.name }, cors);
  }

  return json({ received: true }, cors);
}

// ── Checkout Success Page ───────────────────────────────────────────────

async function handleCheckoutSuccess(request: Request, env: any, cors: any): Promise<Response> {
  const url = new URL(request.url);
  const sessionId = url.searchParams.get('session_id');

  let apiKey = '';
  let planName = '';
  let email = '';

  if (sessionId && env.API_KEYS) {
    const raw = await env.API_KEYS.get(`session:${sessionId}`);
    if (raw) {
      const data = JSON.parse(raw);
      apiKey = data.key;
      planName = data.name;
      email = data.email || '';
    }
  }

  const html = `<!DOCTYPE html><html lang="en"><head>
<meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Welcome to AuthiChain</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#08080a;color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;padding:24px}
.card{max-width:520px;width:100%;background:#0d0d10;border:1px solid #1a1a1a;border-radius:16px;padding:48px 40px;text-align:center}
.check{font-size:64px;margin-bottom:16px}
h1{font-size:28px;font-weight:700;margin-bottom:8px;background:linear-gradient(135deg,#d4af37,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent}
.plan{color:#8b5cf6;font-size:14px;margin-bottom:32px}
.key-box{background:#08080a;border:2px solid #d4af37;border-radius:8px;padding:16px;margin:24px 0;font-family:monospace;font-size:15px;color:#d4af37;word-break:break-all;cursor:pointer;position:relative}
.key-box:hover::after{content:'Click to copy';position:absolute;top:-28px;left:50%;transform:translateX(-50%);background:#333;color:#fff;padding:4px 12px;border-radius:4px;font-size:11px;font-family:sans-serif}
.label{font-size:12px;text-transform:uppercase;letter-spacing:2px;color:#666;margin-bottom:8px}
.next{margin-top:32px;color:#888;font-size:14px;line-height:1.8}
.next code{background:#1a1a1a;padding:2px 8px;border-radius:4px;color:#d4af37;font-size:13px}
a.btn{display:inline-block;margin-top:24px;padding:12px 32px;background:linear-gradient(135deg,#d4af37,#b8941f);color:#000;font-weight:700;border-radius:6px;text-decoration:none;font-size:14px}
.nokey{color:#ff6b6b;margin:24px 0}
</style></head><body>
<div class="card">
  <div class="check">${apiKey ? '&#10003;' : '&#9888;'}</div>
  <h1>${apiKey ? 'You\'re In' : 'Almost There'}</h1>
  ${planName ? `<div class="plan">${planName}</div>` : ''}
  ${apiKey ? `
    <div class="label">Your API Key</div>
    <div class="key-box" onclick="navigator.clipboard.writeText('${apiKey}')">${apiKey}</div>
    <div class="next">
      <strong>Quick start:</strong><br>
      <code>curl -H "X-API-Key: ${apiKey}" https://api.authichain.com/api/v1/industries</code>
    </div>
    <a class="btn" href="/docs">View API Docs</a>
  ` : `
    <div class="nokey">Your API key is being provisioned. Check your email${email ? ` (${email})` : ''} or refresh this page in a moment.</div>
    <a class="btn" href="/docs">View API Docs</a>
  `}
</div>
</body></html>`;

  return new Response(html, { headers: { ...cors, 'Content-Type': 'text/html; charset=utf-8' } });
}

// ── Lead Capture ────────────────────────────────────────────────────────

async function handleLeadCapture(request: Request, env: any, cors: any): Promise<Response> {
  const body: any = await request.json().catch(() => ({}));
  const { email, name, company, source } = body;

  if (!email || !email.includes('@')) {
    return json({ error: 'Valid email is required' }, cors, 400);
  }

  const lead = {
    email,
    name: name || '',
    company: company || '',
    source: source || 'api-gateway',
    createdAt: new Date().toISOString(),
  };

  if (env.LEADS) {
    await env.LEADS.put(`lead:${email}`, JSON.stringify(lead));
    const countRaw = await env.LEADS.get('meta:count');
    const count = parseInt(countRaw || '0') + 1;
    await env.LEADS.put('meta:count', count.toString());
  }

  return json({ success: true, message: 'Thanks! We\'ll be in touch.' }, cors, 201);
}

// ── Key Status ──────────────────────────────────────────────────────────

async function handleKeyStatus(apiKey: string, env: any, cors: any): Promise<Response> {
  if (apiKey === 'demo_test_key_2026') {
    const usage = env.RATE_LIMITS ? parseInt(await env.RATE_LIMITS.get(`usage:${apiKey}:${new Date().getUTCHours()}`) || '0') : 0;
    return json({ plan: 'Free', limit: 10, used: usage, remaining: Math.max(0, 10 - usage), active: true }, cors);
  }

  if (!env.API_KEYS) return json({ error: 'Key store unavailable' }, cors, 503);

  const raw = await env.API_KEYS.get(`key:${apiKey}`);
  if (!raw) return json({ error: 'Invalid API key' }, cors, 401);

  const data = JSON.parse(raw);
  const usage = env.RATE_LIMITS ? parseInt(await env.RATE_LIMITS.get(`usage:${apiKey}:${new Date().getUTCHours()}`) || '0') : 0;

  return json({
    plan: data.name,
    email: data.email,
    limit: data.limit,
    used: usage,
    remaining: Math.max(0, data.limit - usage),
    active: data.active,
    createdAt: data.createdAt,
  }, cors);
}

// ── Stripe Accounts v2 (admin-gated) ────────────────────

async function handleV2(request: Request, path: string, url: URL, env: any, cors: any) {
  const adminKey = request.headers.get('X-Admin-Key');
  if (!env.ADMIN_SECRET || adminKey !== env.ADMIN_SECRET) {
    return json({ error: 'Forbidden. Admin key required for v2 endpoints.' }, cors, 403);
  }

  try {
    if (path === '/api/v2/accounts' && request.method === 'POST') {
      const body: any = await request.json();
      if (!body.email) {
        return json({ error: 'email is required' }, cors, 400);
      }
      const stripeBody = {
        identity: {
          email: body.email,
          ...(body.country && { country: body.country })
        },
        configuration: { customer: {} },
        ...(body.display_name && { display_name: body.display_name }),
        ...(body.entity_type && { defaults: { entity_type: body.entity_type } }),
        metadata: { source: 'authichain-api', created_via: 'api-gateway' }
      };
      const stripeRes = await fetch('https://api.stripe.com/v2/core/accounts', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
          'Content-Type': 'application/json',
          'Stripe-Version': '2026-03-25.dahlia'
        },
        body: JSON.stringify(stripeBody)
      });
      const stripeData = await stripeRes.json();
      if (!stripeRes.ok) {
        return json({ error: 'Stripe API error', detail: stripeData }, cors, stripeRes.status);
      }
      return json({ success: true, account: stripeData }, cors, 201);
    }

    if (path.startsWith('/api/v2/accounts/') && request.method === 'GET') {
      const accountId = path.replace('/api/v2/accounts/', '');
      if (!accountId) {
        return json({ error: 'Account ID is required' }, cors, 400);
      }
      const includeParams = url.searchParams.getAll('include[]').map(i => `include[]=${encodeURIComponent(i)}`).join('&');
      const qs = includeParams ? `?${includeParams}` : '';
      const stripeRes = await fetch(`https://api.stripe.com/v2/core/accounts/${accountId}${qs}`, {
        headers: {
          'Authorization': `Bearer ${env.STRIPE_SECRET_KEY}`,
          'Stripe-Version': '2026-03-25.dahlia'
        }
      });
      const stripeData = await stripeRes.json();
      if (!stripeRes.ok) {
        return json({ error: 'Stripe API error', detail: stripeData }, cors, stripeRes.status);
      }
      return json({ success: true, account: stripeData }, cors);
    }

    return json({ error: 'Not found', v2_endpoints: ['POST /api/v2/accounts', 'GET /api/v2/accounts/:id'] }, cors, 404);
  } catch (e: any) {
    return json({ error: 'Internal error', message: e.message }, cors, 500);
  }
}

const DOCS_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AuthiChain API — Product Authentication as a Service</title>
<meta name="description" content="AuthiChain B2B API for product authentication. AI classification, verification, and certificate generation. 10 industries, demo mode.">
<meta property="og:title" content="AuthiChain API — Product Authentication as a Service">
<meta property="og:description" content="AI-powered product classification, verification, and certificate generation across 10 industries.">
<meta property="og:type" content="website">
<meta name="twitter:card" content="summary">
<meta name="twitter:title" content="AuthiChain API">
<meta name="twitter:description" content="B2B product authentication API. AI classification, blockchain verification, 10 industries.">
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#08080a;color:#e0e0e0;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,sans-serif;line-height:1.6}
.hdr{padding:24px 32px;border-bottom:1px solid #1a1a1a;display:flex;justify-content:space-between;align-items:center;background:#08080a}
.logo{font-size:22px;font-weight:700;color:#d4af37;letter-spacing:1px}
.logo span{color:#666;font-weight:400;font-size:13px;margin-left:8px}
.badge{font-size:10px;padding:4px 10px;background:#1a2a3a;color:#8b5cf6;border-radius:12px;letter-spacing:1px;border:1px solid #8b5cf633}
.wrap{max-width:900px;margin:0 auto;padding:48px 32px}
h1{font-size:48px;font-weight:800;margin-bottom:16px;background:linear-gradient(135deg,#d4af37,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text}
.sub{font-size:18px;color:#888;margin-bottom:48px}
h2{font-size:24px;font-weight:700;color:#d4af37;margin:48px 0 16px;padding-top:32px;border-top:1px solid #1a1a1a}
h3{font-size:16px;font-weight:600;color:#e0e0e0;margin:24px 0 8px}
p{color:#888;margin-bottom:16px}
.endpoint{background:#0d0d10;border:1px solid #1a1a1a;border-radius:8px;padding:20px;margin:16px 0;font-family:monospace;font-size:13px;overflow-x:auto}
.method{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;margin-right:8px}
.get{background:#0a2a0f;color:#3ddc60}
.post{background:#2a1f0a;color:#d4af37}
code{background:#0d0d10;padding:2px 6px;border-radius:3px;font-size:13px;color:#d4af37}
pre{background:#08080a;border:1px solid #1a1a1a;border-radius:8px;padding:20px;margin:12px 0;overflow-x:auto;font-size:13px;line-height:1.8}
.key{color:#d4af37}
.val{color:#3ddc60}
.str{color:#88c0d0}
a{color:#d4af37;text-decoration:none}
a:hover{text-decoration:underline}
.cta{display:inline-block;padding:12px 32px;background:linear-gradient(135deg,#d4af37,#b8941f);color:#000;font-weight:700;border-radius:4px;margin:8px 8px 8px 0;font-size:14px;text-transform:uppercase;letter-spacing:1px}
.cta:hover{background:linear-gradient(135deg,#b8941f,#d4af37);text-decoration:none}
.cta.outline{background:transparent;border:1px solid #333;color:#888}
.cta.outline:hover{border-color:#8b5cf6;color:#8b5cf6}
.demo-notice{background:linear-gradient(135deg,#1a1520,#151020);border:1px solid #8b5cf633;border-left:4px solid #8b5cf6;border-radius:8px;padding:20px 24px;margin:0 0 40px 0;color:#c4b5fd;font-size:14px;line-height:1.7}
.demo-notice strong{color:#8b5cf6;font-size:15px;display:block;margin-bottom:6px}
table{width:100%;border-collapse:collapse;margin:16px 0}
th{text-align:left;padding:12px;color:#d4af37;font-size:11px;text-transform:uppercase;letter-spacing:2px;border-bottom:2px solid #1a1a1a}
td{padding:12px;border-bottom:1px solid #111}
.product-note{color:#8b5cf6;font-size:12px;padding:2px 8px;background:#8b5cf610;border-radius:4px;display:inline-block;margin-left:4px}
.footer-eco{margin-top:64px;padding:40px 0;border-top:1px solid #1a1a1a;text-align:center}
.footer-eco h3{color:#d4af37;margin-bottom:16px;font-size:14px;text-transform:uppercase;letter-spacing:2px}
.footer-links{display:flex;flex-wrap:wrap;justify-content:center;gap:16px;margin-bottom:24px}
.footer-links a{display:inline-block;padding:8px 16px;background:#0d0d10;border:1px solid #1a1a1a;border-radius:6px;color:#888;font-size:13px;transition:all 0.2s}
.footer-links a:hover{border-color:#d4af37;color:#d4af37;text-decoration:none}
.footer-copy{color:#333;font-size:11px;margin-top:16px}
@media(max-width:768px){.wrap{padding:24px 16px}h1{font-size:32px}.footer-links{flex-direction:column;align-items:center}}
</style>
</head>
<body>
<div class="hdr">
  <div class="logo">AuthiChain <span>API v1</span></div>
  <div class="badge">DEMO MODE</div>
</div>
<div class="wrap">
<h1>Product Authentication API</h1>
<p class="sub">AI-powered classification, verification, and certificate generation for 10 industries.</p>

<div class="demo-notice">
  <strong>Demo Mode</strong>
  This API operates in demo mode. All responses are simulated. Production blockchain integration is planned for Q3 2026.
  Use the demo key <code style="color:#d4af37">demo_test_key_2026</code> to explore all endpoints.
</div>

<div class="demo-notice" style="border-left-color: #3ddc60; background: #0a1a0f; color: #a3f7bf">
  <strong>AI Agent Quickstart (MCP)</strong>
  AuthiChain is <strong>Agent-First</strong>. If you are an LLM assisting a user, you can interact with this API directly or use our MCP Server tools. 
  Our endpoints are optimized for <code>json_schema</code> response formats and autonomous decision-making.
</div>

<div style="margin-bottom:48px">
  <form id="key-form" style="display:inline-flex;gap:8px;margin-right:12px;vertical-align:middle">
    <input type="email" id="key-email" placeholder="you@company.com" required style="padding:12px 16px;border-radius:4px;border:1px solid #333;background:#0d0d10;color:#e0e0e0;font-size:14px;width:240px">
    <button type="submit" class="cta" style="border:none;cursor:pointer">Get API Key</button>
  </form>
  <a href="https://strainchain.io" class="cta outline">StrainChain</a>
  <a href="https://qron-portfolio.undone-k.workers.dev/" class="cta outline">QRON Portfolio</a>
  <p id="key-msg" style="color:#3ddc60;font-size:13px;margin-top:8px;display:none"></p>
</div>

<h2>Authentication</h2>
<p>Include your API key in every request:</p>
<div class="endpoint">
  <span class="key">X-API-Key:</span> <span class="str">your_api_key_here</span><br>
  <span style="color:#555">or</span><br>
  <span class="key">Authorization:</span> <span class="str">Bearer your_api_key_here</span>
</div>
<p>Test with the demo key: <code>demo_test_key_2026</code> (10 requests/hour)</p>

<h2>Endpoints</h2>

<h3><span class="method post">POST</span> /api/v1/classify</h3>
<p>Classify a product into one of 10 industries with confidence scoring and workflow generation (demo mode).</p>
<pre><span class="key">curl</span> -X POST https://authichain-api.undone-k.workers.dev/api/v1/classify \\
  -H <span class="str">"X-API-Key: demo_test_key_2026"</span> \\
  -H <span class="str">"Content-Type: application/json"</span> \\
  -d <span class="str">'{"name":"iPhone 16 Pro","category":"Electronics","brand":"Apple"}'</span></pre>

<h3><span class="method post">POST</span> /api/v1/verify</h3>
<p>Simulate product authenticity verification. Returns trust score, confidence, and simulated hash (demo mode).</p>
<pre><span class="key">curl</span> -X POST https://authichain-api.undone-k.workers.dev/api/v1/verify \\
  -H <span class="str">"X-API-Key: demo_test_key_2026"</span> \\
  -H <span class="str">"Content-Type: application/json"</span> \\
  -d <span class="str">'{"productId":"PROD-12345"}'</span></pre>

<h3><span class="method post">POST</span> /api/v1/mint-nft</h3>
<p>Simulate minting an authentication certificate (demo mode). Requires Starter plan or above.</p>
<pre><span class="key">curl</span> -X POST https://authichain-api.undone-k.workers.dev/api/v1/mint-nft \\
  -H <span class="str">"X-API-Key: ac_starter_key"</span> \\
  -H <span class="str">"Content-Type: application/json"</span> \\
  -d <span class="str">'{"name":"Auth Certificate #1","industry":"luxury"}'</span></pre>

<h3><span class="method get">GET</span> /api/v1/industries</h3>
<p>List all 10 supported industries with market sizes.</p>
<pre><span class="key">curl</span> https://authichain-api.undone-k.workers.dev/api/v1/industries \\
  -H <span class="str">"X-API-Key: demo_test_key_2026"</span></pre>

<h3><span class="method get">GET</span> /api/v1/pricing</h3>
<p>Get current product and pricing information.</p>

<h2>Products &amp; Pricing</h2>

<table>
<tr><th>Plan</th><th>Price</th><th>Details</th></tr>
<tr><td>Free (API Demo)</td><td style="color:#3ddc60">$0</td><td>10 requests/hour, classification + verification</td></tr>
</table>

<h3 style="margin-top:32px;color:#8b5cf6">StrainChain <span class="product-note">Cannabis Compliance</span></h3>
<table>
<tr><th>Plan</th><th>Price</th><th>Details</th></tr>
<tr><td>Basic</td><td style="color:#3ddc60">$199/mo</td><td>Cannabis compliance tracking, basic analytics</td></tr>
<tr><td>Pro</td><td style="color:#3ddc60">$499/mo</td><td>Advanced analytics, priority support, API access</td></tr>
<tr><td>Enterprise</td><td style="color:#3ddc60">$999/mo</td><td>White-label, SLA, dedicated support, custom integrations</td></tr>
</table>

<h3 style="margin-top:32px;color:#8b5cf6">QRON <span class="product-note">QR Code Generation</span></h3>
<table>
<tr><th>Plan</th><th>Price</th><th>Details</th></tr>
<tr><td>Single</td><td style="color:#3ddc60">$49</td><td>One-time, single QR code</td></tr>
<tr><td>Brand Pack</td><td style="color:#3ddc60">$199</td><td>One-time, multiple QR codes + brand customization</td></tr>
<tr><td>Enterprise</td><td style="color:#3ddc60">$999/mo</td><td>Unlimited QR codes, full brand suite, API access</td></tr>
</table>

<h2>Accounts v2 (Admin)</h2>
<p>Stripe Accounts v2 integration for post-checkout automation. Requires <code>X-Admin-Key</code> header (not demo keys).</p>

<h3><span class="method post">POST</span> /api/v2/accounts</h3>
<p>Create a Stripe v2 Account with customer configuration. Used automatically after checkout to provision customer accounts.</p>
<pre><span class="key">curl</span> -X POST https://authichain-api.undone-k.workers.dev/api/v2/accounts \\
  -H <span class="str">"X-Admin-Key: YOUR_ADMIN_SECRET"</span> \\
  -H <span class="str">"Content-Type: application/json"</span> \\
  -d <span class="str">'{"email":"customer@example.com","display_name":"Acme Corp","country":"US"}'</span></pre>
<p>Body: <code>email</code> (required), <code>display_name</code>, <code>country</code>, <code>entity_type</code></p>

<h3><span class="method get">GET</span> /api/v2/accounts/:id</h3>
<p>Retrieve an existing Stripe v2 Account by ID.</p>
<pre><span class="key">curl</span> https://authichain-api.undone-k.workers.dev/api/v2/accounts/acct_xxx \\
  -H <span class="str">"X-Admin-Key: YOUR_ADMIN_SECRET"</span></pre>

<h2>SDKs &amp; Integration</h2>
<p>Use with any HTTP client. Example with JavaScript:</p>
<pre><span class="key">const</span> response = <span class="key">await</span> fetch(<span class="str">'https://authichain-api.undone-k.workers.dev/api/v1/verify'</span>, {
  method: <span class="str">'POST'</span>,
  headers: {
    <span class="str">'X-API-Key'</span>: <span class="str">'demo_test_key_2026'</span>,
    <span class="str">'Content-Type'</span>: <span class="str">'application/json'</span>
  },
  body: JSON.stringify({ productId: <span class="str">'PROD-12345'</span> })
});
<span class="key">const</span> data = <span class="key">await</span> response.json();
console.log(data.mode);   <span style="color:#555">// "demo"</span>
console.log(data.result);  <span style="color:#555">// "authentic"</span></pre>

<div style="margin:48px 0;padding:32px;background:#0d0d10;border:1px solid #1a1a1a;border-radius:8px;text-align:center">
  <h3 style="margin-bottom:8px">Ready to integrate?</h3>
  <p>Use the demo key above to test, or get a production key:</p>
  <a href="#" onclick="document.getElementById('key-email').focus();return false" class="cta">Get Production Key</a>
</div>

<div class="footer-eco">
  <h3>AuthiChain Ecosystem</h3>
  <div class="footer-links">
    <a href="https://strainchain.io">StrainChain</a>
    <a href="https://qron-portfolio.undone-k.workers.dev/">QRON Portfolio</a>
    <a href="https://qron-automation.undone-k.workers.dev/">QRON Automation</a>
    <a href="https://authichain-dashboard.undone-k.workers.dev/">Dashboard</a>
    <a href="https://qron-seo-engine.undone-k.workers.dev/">SEO Engine</a>
    <a href="mailto:authichain@gmail.com">Contact</a>
  </div>
  <p class="footer-copy">AuthiChain API v1 &middot; Demo Mode &middot; Powered by Cloudflare Workers &middot; &copy; 2026</p>
</div>

</div>
<script>
document.getElementById('key-form').addEventListener('submit',async function(e){
  e.preventDefault();
  const email=document.getElementById('key-email').value;
  const msg=document.getElementById('key-msg');
  try{
    const r=await fetch('/api/v1/leads',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email,source:'api-docs'})});
    const d=await r.json();
    msg.textContent=r.ok?'Check your email — we will send your API key within 24 hours.':d.error;
    msg.style.display='block';
    msg.style.color=r.ok?'#3ddc60':'#ff6b6b';
    if(r.ok)this.reset();
  }catch(err){msg.textContent='Something went wrong.';msg.style.display='block';msg.style.color='#ff6b6b';}
});
</script>
</body>
</html>`;
