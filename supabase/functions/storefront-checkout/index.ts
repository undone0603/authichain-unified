// qron-storefront-checkout v3.1 — Supabase Edge Function
// FIXED: Correct Stripe price IDs for all tiers
// single: price_1TIhySGqTruSqV8TZt1cP638 ($9)
// pack:   price_1TIhyTGqTruSqV8TRQkHaiXy ($29)
// brand:  price_1TGOM9GqTruSqV8TdV7j3DuL ($49)
//
// Source imported from the deployed v16 (QRON-v2, ezbr_sha256 e8b79407…) for
// PM-231. The only behavioral change: every credential is read from the
// environment instead of hard-coded literals, and each path fails closed
// (503, no outbound call) when the credential it needs is unset:
//   STRIPE_SECRET_KEY     — /checkout (function secret)
//   STRIPE_WEBHOOK_SECRET — /webhook signature check (function secret)
//   RESEND_API_KEY        — confirmation email; skipped (logged) when unset
//   SUPABASE_URL / SUPABASE_ANON_KEY — injected by the Supabase platform

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';

const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const STRIPE_WEBHOOK_SECRET = Deno.env.get('STRIPE_WEBHOOK_SECRET') ?? '';
const RESEND_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SUPA_BASE = Deno.env.get('SUPABASE_URL') ?? '';
const SUPA_URL = SUPA_BASE ? `${SUPA_BASE.replace(/\/+$/, '')}/rest/v1` : '';
const SUPA_ANON = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const PRICES: Record<string, string> = {
  single: 'price_1TIhySGqTruSqV8TZt1cP638', // $9 — CORRECTED
  pack:   'price_1TIhyTGqTruSqV8TRQkHaiXy', // $29 — CORRECTED
  brand:  'price_1TGOM9GqTruSqV8TdV7j3DuL', // $49 — correct
  enterprise_monthly: 'price_1TGOMCGqTruSqV8TpQsP9KY3', // $999/mo
  authichain_starter: 'price_1TGEI1GqTruSqV8TD3EVoQxw', // $199/mo
  authichain_pro: 'price_1TGEI2GqTruSqV8TFyE0U9Pn', // $499/mo
};

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, stripe-signature',
};

const unavailable = (what: string) => {
  console.error(`storefront-checkout: ${what} is not set; refusing request`);
  return new Response(JSON.stringify({ error: 'Temporarily unavailable' }), { status: 503, headers: { ...CORS, 'Content-Type': 'application/json' } });
};

async function hmac(secret: string, data: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data));
  return Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function verifyStripe(body: string, sigHeader: string): Promise<boolean> {
  if (!STRIPE_WEBHOOK_SECRET) return false; // never verify against an empty secret
  const parts = sigHeader.split(',').reduce((a: Record<string, string>, s: string) => { const [k, v] = s.split('='); a[k] = v; return a; }, {});
  if (!parts.t || !parts.v1) return false;
  if (Math.abs(Date.now() / 1000 - parseInt(parts.t)) > 300) return false;
  return (await hmac(STRIPE_WEBHOOK_SECRET, `${parts.t}.${body}`)) === parts.v1;
}

async function sendConfirmationEmail(session: Record<string, unknown>) {
  const details = session.customer_details as Record<string, string> | undefined;
  const email = details?.email || session.customer_email as string;
  if (!email) return;
  const amt = ((session.amount_total as number || 0) / 100).toFixed(2);
  const metadata = session.metadata as Record<string, string> | undefined;
  const plan = metadata?.plan || 'QRON';
  const style = metadata?.style || '';
  const qr_url = metadata?.qr_url || 'https://qron.space';

  if (!RESEND_KEY) {
    console.error('storefront-checkout: RESEND_API_KEY is not set; skipping confirmation email');
  } else {
    await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${RESEND_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: 'hello@qron.space',
        to: [email],
        subject: `Your QRON ${plan} is confirmed — we're generating your QR art ◆`,
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:24px;background:#0a0a0a;color:#e5e5e5">
        <div style="color:#c9a227;font-weight:900;font-size:1.2rem;margin-bottom:24px">◆ QRON</div>
        <h2 style="margin-bottom:8px">Payment confirmed ✓</h2>
        <p style="color:#888;margin-bottom:16px">${plan}${style ? ' · ' + style + ' style' : ''} · $${amt}</p>
        <p>Your QR art is generating now. It encodes: <code style="color:#c9a227">${qr_url}</code></p>
        <p style="margin-top:24px"><a href="https://qron.space/dashboard" style="background:#c9a227;color:#000;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:700">View dashboard →</a></p>
        <p style="color:#444;font-size:12px;margin-top:32px">QRON · qron.space · Session: ${session.id}</p>
      </div>`
      })
    }).catch((e: Error) => console.error('resend err:', e.message));
  }

  // Log to Supabase
  if (!SUPA_URL || !SUPA_ANON) {
    console.error('storefront-checkout: SUPABASE_URL / SUPABASE_ANON_KEY not set; skipping payment log');
    return;
  }
  await fetch(`${SUPA_URL}/payments`, {
    method: 'POST',
    headers: { 'apikey': SUPA_ANON, 'Authorization': `Bearer ${SUPA_ANON}`, 'Content-Type': 'application/json', 'Prefer': 'return=minimal' },
    body: JSON.stringify({ stripe_session_id: session.id, email, plan, style, qr_url, amount: session.amount_total, currency: session.currency, status: 'fulfilled', created_at: new Date().toISOString() })
  }).catch((e: Error) => console.error('supabase err:', e.message));
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: CORS });

  const url = new URL(req.url);
  const path = url.pathname.replace('/storefront-checkout', '') || '/';

  if (path === '/health' || path === '/') {
    return new Response(JSON.stringify({ ok: true, service: 'storefront-checkout', v: '3.1', prices: Object.keys(PRICES) }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  // Webhook handler
  if (path === '/webhook' && req.method === 'POST') {
    if (!STRIPE_WEBHOOK_SECRET) return unavailable('STRIPE_WEBHOOK_SECRET');
    const body = await req.text();
    const sig = req.headers.get('stripe-signature') || '';
    if (!(await verifyStripe(body, sig))) return new Response('Unauthorized', { status: 401 });
    let event: Record<string, unknown>;
    try { event = JSON.parse(body); } catch { return new Response('Bad request', { status: 400 }); }
    console.log(`[webhook] ${event.type} ${event.id}`);
    if (event.type === 'checkout.session.completed') {
      // NOTE (unchanged from deployed v16): passes event.data, not event.data.object.
      await sendConfirmationEmail(event.data as Record<string, unknown> & { object: Record<string, unknown> }).catch((e: Error) => console.error('fulfil err:', e.message));
    }
    return new Response(JSON.stringify({ received: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  // Checkout session creator
  if (path === '/checkout' && req.method === 'POST') {
    if (!STRIPE_KEY) return unavailable('STRIPE_SECRET_KEY');
    let body: Record<string, string> = {};
    try { body = await req.json(); } catch { body = {}; }
    const { plan = 'single', qr_url = '', email = '', style = 'Galactic', instructions = '', utm_source = '' } = body;
    const priceId = PRICES[plan] || PRICES.single;

    const fd = new URLSearchParams({
      'mode': 'payment',
      'line_items[0][price]': priceId,
      'line_items[0][quantity]': '1',
      'success_url': 'https://qron.space/order/success?session_id={CHECKOUT_SESSION_ID}',
      'cancel_url': 'https://qron.space/order',
      'customer_email': email,
      'metadata[qr_url]': qr_url.slice(0, 490),
      'metadata[style]': style,
      'metadata[instructions]': instructions.slice(0, 490),
      'metadata[plan]': plan,
      'metadata[utm]': utm_source,
    });

    const sr = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${STRIPE_KEY}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: fd.toString()
    });
    const session = await sr.json() as Record<string, unknown> & { url?: string; error?: { message: string } };
    if (session.url) return new Response(JSON.stringify({ checkout_url: session.url, plan, price: priceId }), { headers: { ...CORS, 'Content-Type': 'application/json' } });
    return new Response(JSON.stringify({ error: session.error?.message || 'Checkout failed' }), { status: 400, headers: { ...CORS, 'Content-Type': 'application/json' } });
  }

  return new Response(JSON.stringify({ error: 'Not found', path }), { status: 404, headers: { ...CORS, 'Content-Type': 'application/json' } });
});
