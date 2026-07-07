/**
 * AuthiChain Cloudflare Worker — Edge Revenue Engine
 * Routes: /seal /verify /certificate /provenance /stripe/checkout /stripe/webhook
 *
 * Deploy: wrangler deploy api/worker.ts --name authichain-revenue-worker
 */

import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';

export interface Env {
  SUPABASE_URL: string;
  SUPABASE_SERVICE_ROLE_KEY: string;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  STRIPE_PRICE_BASIC: string;
  STRIPE_PRICE_PRO: string;
  STRIPE_PRICE_ENTERPRISE: string;
  WORKER_API_KEY: string;
  NEXT_PUBLIC_APP_URL: string;
  CRM_BASE_URL: string;
  CRM_API_KEY: string;
}

function getSupabase(env: Env) {
  return createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
}

function jsonResponse(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
  });
}

async function emitCrm(env: Env, action: string, payload: Record<string, unknown>) {
  if (!env.CRM_BASE_URL || !env.CRM_API_KEY) return;
  try {
    await fetch(`${env.CRM_BASE_URL}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${env.CRM_API_KEY}` },
      body: JSON.stringify({ action, ...payload }),
    });
  } catch {}
}

// ---------------------------------------------------------------------------
// Route: POST /seal
// ---------------------------------------------------------------------------
async function handleSeal(req: Request, env: Env): Promise<Response> {
  const { product_id, batch_id, brand, metadata } = await req.json() as Record<string, unknown>;
  if (!product_id || !brand) return jsonResponse({ error: 'product_id and brand required' }, 400);

  const seal_id = crypto.randomUUID();
  const timestamp = new Date().toISOString();
  const payload_raw = JSON.stringify({ seal_id, product_id, batch_id, brand, metadata, timestamp });
  const qr_hash = createHash('sha256').update(payload_raw).digest('hex');
  const qr_payload = `${env.NEXT_PUBLIC_APP_URL}/verify?seal=${seal_id}&hash=${qr_hash}`;

  const supabase = getSupabase(env);
  await supabase.from('auth_seals').insert({ id: seal_id, product_id, batch_id, brand, qr_payload, polygon_tx: null });

  return jsonResponse({ seal_id, qr_url: qr_payload });
}

// ---------------------------------------------------------------------------
// Route: POST /verify
// ---------------------------------------------------------------------------
async function handleVerify(req: Request, env: Env): Promise<Response> {
  const { seal_id, scan_context } = await req.json() as { seal_id: string; scan_context?: Record<string, unknown> };
  if (!seal_id) return jsonResponse({ error: 'seal_id required' }, 400);

  const supabase = getSupabase(env);
  const { data: seal } = await supabase.from('auth_seals').select('*').eq('id', seal_id).single();

  const status = seal ? 'valid' : 'invalid';

  // Write verification event
  await supabase.from('verification_events').insert({
    id: crypto.randomUUID(),
    seal_id,
    brand: seal?.brand ?? 'authichain.com',
    scan_context: scan_context ?? {},
    status,
  });

  // Log usage
  await supabase.from('usage_events').insert({
    event_type: 'verification',
    event_ref: seal_id,
    brand: seal?.brand ?? 'authichain.com',
  });

  // CRM
  if (status === 'valid') {
    await emitCrm(env, 'advanceDeal', {
      brand: seal?.brand,
      deal_type: seal?.brand === 'strainchain.io' ? 'StrainChain Pilot' : 'Brand Protection',
      metric: 'scan_volume',
      value: 1,
      ref_id: seal_id,
    });
  }

  return jsonResponse({ status, details: seal ? { product_id: seal.product_id, brand: seal.brand } : {} });
}

// ---------------------------------------------------------------------------
// Route: POST /certificate
// ---------------------------------------------------------------------------
async function handleCertificate(req: Request, env: Env): Promise<Response> {
  const { product_id, seal_id, rarity_input, brand } = await req.json() as Record<string, unknown>;
  if (!product_id || !seal_id || !brand) return jsonResponse({ error: 'product_id, seal_id, brand required' }, 400);

  const rarity_score = Math.min(100, Math.round((JSON.stringify(rarity_input ?? {}).length / 200) * 100));
  const certificate_id = crypto.randomUUID();

  const supabase = getSupabase(env);
  await supabase.from('certificates').insert({ id: certificate_id, product_id, seal_id, rarity_score, polygon_nft_tx: null, brand });

  await supabase.from('usage_events').insert({ event_type: 'certificate_minted', event_ref: certificate_id, brand });

  await emitCrm(env, 'createOpportunity', { brand, deal_type: 'Certificate Marketplace', certificate_id, product_id, rarity_score });

  return jsonResponse({ certificate_id, nft_tx: null });
}

// ---------------------------------------------------------------------------
// Route: POST /provenance
// ---------------------------------------------------------------------------
async function handleProvenance(req: Request, env: Env): Promise<Response> {
  const { dispensary_id, batch_id, events, brand } = await req.json() as Record<string, unknown>;
  if (!dispensary_id || !batch_id) return jsonResponse({ error: 'dispensary_id and batch_id required' }, 400);

  const resolved_brand = (brand as string) ?? 'strainchain.io';
  const payload_raw = JSON.stringify({ dispensary_id, batch_id, resolved_brand, ts: Date.now() });
  const qr_hash = createHash('sha256').update(payload_raw).digest('hex');
  const qr_payload = `${env.NEXT_PUBLIC_APP_URL}/provenance?batch=${batch_id}&hash=${qr_hash}`;

  const supabase = getSupabase(env);
  await supabase.from('provenance_batches').insert({
    id: crypto.randomUUID(),
    dispensary_id,
    batch_id,
    brand: resolved_brand,
    qr_payload,
    events: events ?? [],
  });

  await supabase.from('usage_events').insert({ event_type: 'dispensary_scan', event_ref: batch_id as string, brand: resolved_brand });

  await emitCrm(env, 'updateDealMetric', { brand: resolved_brand, deal_type: 'StrainChain Pilot', dispensary_id, batch_id, metric: 'scan_volume', value: 1 });

  return jsonResponse({ batch_id, qr_url: qr_payload });
}

// ---------------------------------------------------------------------------
// Route: POST /stripe/checkout
// ---------------------------------------------------------------------------
async function handleStripeCheckout(req: Request, env: Env): Promise<Response> {
  const { plan_id, brand, customer_email } = await req.json() as Record<string, unknown>;
  if (!plan_id || !brand || !customer_email) return jsonResponse({ error: 'plan_id, brand, customer_email required' }, 400);

  const priceMap: Record<string, string> = {
    authichain_basic: env.STRIPE_PRICE_BASIC,
    authichain_pro: env.STRIPE_PRICE_PRO,
    authichain_enterprise: env.STRIPE_PRICE_ENTERPRISE,
  };
  const price_id = priceMap[plan_id as string];
  if (!price_id) return jsonResponse({ error: `Unknown plan_id: ${plan_id}` }, 400);

  const base_url = env.NEXT_PUBLIC_APP_URL;
  const stripeRes = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      mode: 'subscription',
      'payment_method_types[]': 'card',
      customer_email: customer_email as string,
      'line_items[0][price]': price_id,
      'line_items[0][quantity]': '1',
      'metadata[plan_id]': plan_id as string,
      'metadata[brand]': brand as string,
      success_url: `${base_url}/dashboard?brand=${brand}&session_id={CHECKOUT_SESSION_ID}&status=success`,
      cancel_url: `${base_url}/pricing?brand=${brand}&status=cancelled`,
    }),
  });

  const session = await stripeRes.json() as { url?: string; error?: unknown };
  if (!stripeRes.ok) return jsonResponse({ error: session.error ?? 'Stripe error' }, 500);

  return jsonResponse({ url: session.url });
}

// ---------------------------------------------------------------------------
// Route: POST /stripe/webhook
// ---------------------------------------------------------------------------
async function handleStripeWebhook(req: Request, env: Env): Promise<Response> {
  // Signature verification requires SubtleCrypto in Workers
  // Full implementation: use stripe-signature header + STRIPE_WEBHOOK_SECRET
  // For now: parse event and process (add sig verification in production)
  const body = await req.text();
  let event: { type: string; data: { object: Record<string, unknown> } };
  try {
    event = JSON.parse(body);
  } catch {
    return jsonResponse({ error: 'Invalid JSON' }, 400);
  }

  const supabase = getSupabase(env);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const plan_id = (session.metadata as Record<string, string>)?.plan_id ?? '';
    const brand = (session.metadata as Record<string, string>)?.brand ?? 'authichain.com';
    const email = (session.customer_email as string) ?? '';
    const stripe_customer_id = (session.customer as string) ?? '';
    const stripe_subscription_id = (session.subscription as string) ?? '';

    await supabase.from('subscriptions').upsert(
      { stripe_customer_id, stripe_subscription_id, plan_id, brand, email, status: 'active', current_period_end: new Date(Date.now() + 30 * 86400 * 1000).toISOString() },
      { onConflict: 'stripe_subscription_id' },
    );

    await emitCrm(env, 'onNewSubscription', { brand, email, stripe_customer_id, plan_id });
  }

  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object;
    await supabase.from('usage_events').insert({
      event_type: 'payment_failed',
      event_ref: null,
      brand: (invoice.metadata as Record<string, string>)?.brand ?? 'authichain.com',
    });
  }

  return jsonResponse({ received: true });
}

// ---------------------------------------------------------------------------
// Main fetch handler
// ---------------------------------------------------------------------------
export default {
  async fetch(req: Request, env: Env): Promise<Response> {
    const url = new URL(req.url);
    const path = url.pathname;
    const method = req.method;

    // CORS preflight
    if (method === 'OPTIONS') {
      return new Response(null, {
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type, x-api-key',
        },
      });
    }

    // API key guard (skip for public /verify and /stripe/webhook)
    const unguarded = ['/verify', '/stripe/webhook'];
    if (!unguarded.includes(path)) {
      const apiKey = req.headers.get('x-api-key');
      if (apiKey !== env.WORKER_API_KEY) {
        return jsonResponse({ error: 'Unauthorized' }, 401);
      }
    }

    try {
      if (method === 'POST') {
        if (path === '/seal') return await handleSeal(req, env);
        if (path === '/verify') return await handleVerify(req, env);
        if (path === '/certificate') return await handleCertificate(req, env);
        if (path === '/provenance') return await handleProvenance(req, env);
        if (path === '/stripe/checkout') return await handleStripeCheckout(req, env);
        if (path === '/stripe/webhook') return await handleStripeWebhook(req, env);
      }

      if (method === 'GET' && path === '/health') {
        return jsonResponse({ status: 'ok', ts: new Date().toISOString() });
      }

      return jsonResponse({ error: 'Not found' }, 404);
    } catch (err) {
      console.error('[worker] Unhandled error:', err);
      return jsonResponse({ error: 'Internal server error' }, 500);
    }
  },
};
