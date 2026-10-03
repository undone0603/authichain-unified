// qron-checkout: Supabase Edge Function (QRON-v2, project nhdnkzhtadfkkluiulhs).
// Source imported from the deployed v19 (ezbr_sha256 13304be2…) for PM-231.
// The only behavioral change: the Stripe secret key is read from the
// STRIPE_SECRET_KEY function secret instead of a hard-coded literal, and the
// function fails closed (503, no Stripe call) when it is unset.
import 'jsr:@supabase/functions-js/edge-runtime.d.ts';
import { createClient } from 'jsr:@supabase/supabase-js@2';

const STRIPE_KEY = Deno.env.get('STRIPE_SECRET_KEY') ?? '';
const SUPA_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPA_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type Product = { priceId: string; name: string };
const PRODUCTS: Record<string, Product> = {
  'single':        { priceId: 'price_1TGOM9GqTruSqV8TdV7j3DuL', name: 'QRON Single Design' },
  'brand-pack':    { priceId: 'price_1TGOMBGqTruSqV8TBxL9yYLU', name: 'QRON Brand Pack 5x' },
  'credits-50':    { priceId: 'price_1TGAiXGqTruSqV8TSBFGNSrf', name: 'QRON 50 Credits'     },
  'credits-250':   { priceId: 'price_1TGAiYGqTruSqV8TgVbEZ8ZC', name: 'QRON 250 Credits'    },
  'credits-1000':  { priceId: 'price_1TGAiZGqTruSqV8Tb4ZdCVKr', name: 'QRON 1000 Credits'   },
  'enterprise':    { priceId: 'price_1TGOMCGqTruSqV8TpQsP9KY3', name: 'QRON Enterprise'      },
  'ac-starter':    { priceId: 'price_1TGAVRGqTruSqV8T0JkrO3Ry', name: 'AuthiChain Starter'   },
  'ac-pro':        { priceId: 'price_1TGAVTGqTruSqV8TTHYdqKAs', name: 'AuthiChain Pro'        },
  'sc-basic':      { priceId: 'price_1TGEI1GqTruSqV8TD3EVoQxw', name: 'StrainChain Basic'     },
  'sc-pro':        { priceId: 'price_1TGEI2GqTruSqV8TFyE0U9Pn', name: 'StrainChain Pro'       },
  'sc-enterprise': { priceId: 'price_1TGEI2GqTruSqV8TDFLyJPL9', name: 'StrainChain Enterprise'},
};

const SUB_PRODUCTS = new Set(['enterprise','ac-starter','ac-pro','sc-basic','sc-pro','sc-enterprise']);

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405, headers: CORS });

  const J = (data: unknown, s = 200) =>
    new Response(JSON.stringify(data), { status: s, headers: { ...CORS, 'Content-Type': 'application/json' } });

  // Fail closed: never fall back to a baked-in key.
  if (!STRIPE_KEY) {
    console.error('qron-checkout: STRIPE_SECRET_KEY is not set; refusing to create a checkout session');
    return J({ error: 'Checkout temporarily unavailable' }, 503);
  }

  let body: { product?: string; qr_url?: string; prompt?: string; customer_email?: string; success_url?: string; cancel_url?: string };
  try { body = await req.json(); } catch { return J({ error: 'Invalid JSON' }, 400); }

  const { product = '', qr_url, prompt, customer_email, success_url, cancel_url } = body;
  const prod = PRODUCTS[product];
  if (!prod) return J({ error: 'Unknown product: ' + product, available: Object.keys(PRODUCTS) }, 400);

  // Match the Origin host exactly (or a subdomain of it); a substring check
  // would accept hosts like authichain.com.attacker.example.
  let originHost = '';
  try { originHost = new URL(req.headers.get('origin') ?? '').hostname.toLowerCase(); } catch { originHost = ''; }
  const isHost = (h: string) => originHost === h || originHost.endsWith('.' + h);
  const base = isHost('authichain.com') ? 'https://authichain.com'
             : isHost('strainchain.io')  ? 'https://strainchain.io'
             : 'https://qron.space';

  const ok_url = success_url ?? (base + '/success?session_id={CHECKOUT_SESSION_ID}');
  const no_url = cancel_url  ?? base;
  const mode   = SUB_PRODUCTS.has(product) ? 'subscription' : 'payment';

  const p = new URLSearchParams();
  p.set('line_items[0][price]',    prod.priceId);
  p.set('line_items[0][quantity]', '1');
  p.set('mode',                    mode);
  p.set('success_url',             ok_url);
  p.set('cancel_url',              no_url);
  p.set('allow_promotion_codes',   'true');
  p.set('metadata[product]',       product);
  p.set('metadata[price_id]',      prod.priceId);
  if (customer_email) p.set('customer_email', customer_email);
  if (qr_url)  p.set('metadata[qr_url]',  qr_url);
  if (prompt)  p.set('metadata[prompt]',   prompt);

  const stripe = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + STRIPE_KEY, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: p.toString(),
  });

  if (!stripe.ok) {
    const e = await stripe.json() as { error?: { message?: string } };
    return J({ error: e?.error?.message ?? 'Stripe error' }, 500);
  }

  const sess = await stripe.json() as { id: string; url: string };

  if (SUPA_URL && SUPA_KEY && qr_url) {
    const db = createClient(SUPA_URL, SUPA_KEY);
    db.from('qron_deliveries').insert({
      stripe_session_id: sess.id,
      customer_email: customer_email ?? null,
      qr_url, prompt: prompt ?? null,
      created_at: new Date().toISOString(),
    }).then(() => {}, () => {}); // was .then().catch(): same fire-and-forget, but type-checks
  }

  return J({ checkout_url: sess.url, session_id: sess.id, product: prod.name });
});
