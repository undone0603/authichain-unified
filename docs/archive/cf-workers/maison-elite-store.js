--7ad1ba78d57f062e95ab2afd1b9b9ecf0255e79812d1d6395b3db64fc8ee
Content-Disposition: form-data; name="worker.js"

/**
 * Maison Elite Store — Autonomous Luxury Dropship Worker
 * Shopify-free: Stripe Checkout → CJ Dropshipping auto-fulfillment → Resend email
 */

const STORE_URL = 'https://maison-elite-store.undone-k.workers.dev';

const PRODUCTS = [
  {
    id: 'crossbody-tote',
    name: 'Top-Grain Leather Crossbody Tote',
    tagline: 'Handcrafted in full-grain leather. Built to carry everything.',
    price: 149,
    priceId: 'price_1TcXdsEAD8v8tCmmkiedwmgs',
    cjPid: '2605110904231619600',
    cjSku: 'CJNS2878492',
    category: 'Bags',
    emoji: '👜',
  },
  {
    id: 'shoulder-bag',
    name: 'Hand-Rubbed Leather Shoulder Bag',
    tagline: 'Artisan hand-rubbed top-grain leather with rich natural character.',
    price: 155,
    priceId: 'price_1TcXdtEAD8v8tCmm2xceGQp4',
    cjPid: '2605160832001626900',
    cjSku: 'CJNS2893487',
    category: 'Bags',
    emoji: '👜',
  },
  {
    id: 'full-grain-tote',
    name: 'Full-Grain Leather Tote',
    tagline: 'Full-grain leather, large capacity. The only bag you need.',
    price: 129,
    priceId: 'price_1TcXduEAD8v8tCmmUgcK43dR',
    cjPid: '2605140819131616700',
    cjSku: 'CJNS2890720',
    category: 'Bags',
    emoji: '🎒',
  },
  {
    id: 'executive-briefcase',
    name: 'Cowhide Executive Briefcase',
    tagline: 'Premium cowhide leather. Laptop-ready, boardroom-ready.',
    price: 249,
    priceId: 'price_1TcXdvEAD8v8tCmmpbNYAvJx',
    cjPid: '2510300357381651900',
    cjSku: 'CJYD2573988',
    category: 'Bags',
    emoji: '💼',
  },
  {
    id: 'diamond-watch',
    name: 'Diamond-Encrusted Luxury Watch',
    tagline: 'Diamond-encrusted dial. Understated luxury that speaks volumes.',
    price: 89,
    priceId: 'price_1TcXdwEAD8v8tCmmfE03APnI',
    cjPid: '2605220206361600400',
    cjSku: 'CJSY2899711',
    category: 'Watches',
    emoji: '⌚',
  },
  {
    id: 'sport-watch',
    name: 'Waterproof Luminous Sport Watch',
    tagline: 'Multifunctional waterproof with luminous display. Born for adventure.',
    price: 139,
    priceId: 'price_1TcXdxEAD8v8tCmmbx0mRjhL',
    cjPid: '2605060143211636400',
    cjSku: 'CJNS2870678',
    category: 'Watches',
    emoji: '⌚',
  },
  {
    id: 'moissanite-necklace',
    name: '1CT Moissanite Infinity Necklace',
    tagline: '1-carat moissanite, S925 sterling silver. Fine jewelry at an honest price.',
    price: 189,
    priceId: 'price_1TcXdyEAD8v8tCmmYqfX9nHz',
    cjPid: '2060192274464690177',
    cjSku: 'CJLX2914021',
    category: 'Jewelry',
    emoji: '💎',
  },
  {
    id: 'silver-tassel-necklace',
    name: '999 Fine Silver Tassel Necklace',
    tagline: '999 pure fine silver — higher purity than sterling. Effortless elegance.',
    price: 199,
    priceId: 'price_1TcXdzEAD8v8tCmmgeWSSyZb',
    cjPid: '2059985930788986881',
    cjSku: 'CJLX2913722',
    category: 'Jewelry',
    emoji: '📿',
  },
  {
    id: 'silver-bracelet',
    name: '990 Silver Textured Link Bracelet',
    tagline: '990 sterling silver luxury dainty link. Handcrafted artisan finish.',
    price: 149,
    priceId: 'price_1TcXe0EAD8v8tCmmPLT0slCh',
    cjPid: '2060289646482087937',
    cjSku: 'CJSL2915116',
    category: 'Jewelry',
    emoji: '📿',
  },
];

// ── Stripe Webhook Verification (WebCrypto) ─────────────────────────────────

async function verifyStripeSignature(payload, sigHeader, secret) {
  const parts = Object.fromEntries(sigHeader.split(',').map(p => p.split('=')));
  const timestamp = parts.t;
  const v1 = parts.v1;
  if (!timestamp || !v1) return null;

  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']
  );
  const sig = await crypto.subtle.sign(
    'HMAC', key, new TextEncoder().encode(`${timestamp}.${payload}`)
  );
  const computed = Array.from(new Uint8Array(sig))
    .map(b => b.toString(16).padStart(2, '0')).join('');

  return computed === v1 ? JSON.parse(payload) : null;
}

// ── CJ Dropshipping ──────────────────────────────────────────────────────────

async function getCJToken(env) {
  const res = await fetch('https://developers.cjdropshipping.com/api2.0/v1/authentication/getAccessToken', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: env.CJ_EMAIL, password: env.CJ_API_KEY }),
  });
  const data = await res.json();
  return data?.data?.accessToken;
}

async function placeCJOrder(env, product, shipping, customerEmail, orderRef) {
  const token = await getCJToken(env);
  if (!token) { console.error('[CJ] Auth failed'); return null; }

  const body = {
    orderNumber: orderRef,
    shippingZip: shipping.address?.postal_code || '',
    shippingCountryCode: shipping.address?.country || 'US',
    shippingCountry: shipping.address?.country || 'US',
    shippingProvince: shipping.address?.state || '',
    shippingCity: shipping.address?.city || '',
    shippingAddress: shipping.address?.line1 || '',
    shippingAddress2: shipping.address?.line2 || '',
    shippingCustomerName: shipping.name || customerEmail,
    shippingPhone: '0000000000',
    shippingEmail: customerEmail,
    products: [{ vid: product.cjSku, quantity: 1 }],
  };

  const res = await fetch('https://developers.cjdropshipping.com/api2.0/v1/shopping/order/createOrderV2', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'CJ-Access-Token': token },
    body: JSON.stringify(body),
  });
  const order = await res.json();
  console.log('[CJ Order]', orderRef, JSON.stringify(order));
  return order;
}

// ── Email via Resend ─────────────────────────────────────────────────────────

async function sendOrderConfirmation(env, toEmail, customerName, product, orderRef) {
  await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from: 'Maison Elite <noreply@authichain.com>',
      to: toEmail,
      subject: `Order Confirmed — ${product.name}`,
      html: `
        <div style="font-family:Georgia,serif;max-width:580px;margin:0 auto;background:#0e0e0e;color:#e8e8e8;padding:40px 32px;border-radius:8px;">
          <p style="font-size:11px;letter-spacing:4px;color:#b8a060;text-transform:uppercase;margin:0 0 24px">Maison Elite</p>
          <h1 style="font-size:24px;font-weight:400;color:#fff;margin:0 0 8px">Your order is confirmed.</h1>
          <p style="color:#888;margin:0 0 32px">Order reference: <strong style="color:#b8a060">${orderRef}</strong></p>
          <div style="border:1px solid #2a2a2a;border-radius:6px;padding:20px;margin-bottom:28px;">
            <p style="font-size:18px;color:#fff;margin:0 0 4px">${product.emoji} ${product.name}</p>
            <p style="color:#888;font-size:14px;margin:0 0 12px">${product.tagline}</p>
            <p style="color:#b8a060;font-size:20px;font-weight:600;margin:0">$${product.price}</p>
          </div>
          <p style="color:#888;font-size:13px;line-height:1.6;">Your item will be dispatched within 2-3 business days. You'll receive a shipping notification with tracking details once it's on its way.</p>
          <hr style="border:none;border-top:1px solid #2a2a2a;margin:28px 0">
          <p style="color:#444;font-size:11px;letter-spacing:2px;text-transform:uppercase">Maison Elite · Luxury Without Compromise</p>
        </div>`,
    }),
  });
}

// ── Stripe Checkout Session ──────────────────────────────────────────────────

async function createCheckoutSession(env, product) {
  const params = new URLSearchParams({
    mode: 'payment',
    'line_items[0][price]': product.priceId,
    'line_items[0][quantity]': '1',
    success_url: `${STORE_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${STORE_URL}/`,
    'shipping_address_collection[allowed_countries][0]': 'US',
    'shipping_address_collection[allowed_countries][1]': 'CA',
    'shipping_address_collection[allowed_countries][2]': 'GB',
    'shipping_address_collection[allowed_countries][3]': 'AU',
    'metadata[product_id]': product.id,
    'metadata[cj_pid]': product.cjPid,
    'metadata[cj_sku]': product.cjSku,
  });

  const res = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Basic ${btoa(env.STRIPE_SECRET_KEY + ':')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });
  return res.json();
}

// ── HTML Store Page ──────────────────────────────────────────────────────────

function renderStorePage() {
  const categories = [...new Set(PRODUCTS.map(p => p.category))];

  const productCards = PRODUCTS.map(p => `
    <div class="product-card" data-category="${p.category}">
      <div class="product-icon">${p.emoji}</div>
      <div class="product-info">
        <span class="product-category">${p.category}</span>
        <h3 class="product-name">${p.name}</h3>
        <p class="product-tagline">${p.tagline}</p>
        <div class="product-footer">
          <span class="product-price">$${p.price}</span>
          <form action="/checkout" method="POST">
            <input type="hidden" name="productId" value="${p.id}">
            <button type="submit" class="btn-buy">Buy Now</button>
          </form>
        </div>
      </div>
    </div>`).join('');

  const filterBtns = ['All', ...categories].map((c, i) =>
    `<button class="filter-btn${i === 0 ? ' active' : ''}" onclick="filterProducts('${c}')">${c}</button>`
  ).join('');

  return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Maison Elite — Luxury Without Compromise</title>
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: Georgia, 'Times New Roman', serif; background: #080808; color: #e0e0e0; min-height: 100vh; }
    header { border-bottom: 1px solid #1e1e1e; padding: 24px 40px; display: flex; justify-content: space-between; align-items: center; }
    .logo { font-size: 13px; letter-spacing: 6px; color: #c9a84c; text-transform: uppercase; }
    .tagline-header { font-size: 11px; letter-spacing: 3px; color: #555; text-transform: uppercase; }
    .hero { padding: 80px 40px 60px; text-align: center; border-bottom: 1px solid #1a1a1a; }
    .hero h1 { font-size: clamp(32px,5vw,56px); font-weight: 300; color: #fff; letter-spacing: -0.5px; margin-bottom: 16px; }
    .hero p { font-size: 16px; color: #777; max-width: 480px; margin: 0 auto; line-height: 1.6; }
    .filters { padding: 32px 40px 0; display: flex; gap: 12px; flex-wrap: wrap; }
    .filter-btn { background: transparent; border: 1px solid #2a2a2a; color: #777; padding: 8px 20px; border-radius: 24px; cursor: pointer; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; transition: all 0.2s; font-family: inherit; }
    .filter-btn:hover, .filter-btn.active { border-color: #c9a84c; color: #c9a84c; }
    .products { display: grid; grid-template-columns: repeat(auto-fill, minmax(300px, 1fr)); gap: 24px; padding: 32px 40px 80px; }
    .product-card { background: #0f0f0f; border: 1px solid #1e1e1e; border-radius: 8px; overflow: hidden; transition: border-color 0.2s, transform 0.2s; }
    .product-card:hover { border-color: #c9a84c40; transform: translateY(-2px); }
    .product-card.hidden { display: none; }
    .product-icon { font-size: 48px; padding: 32px; text-align: center; background: #0a0a0a; border-bottom: 1px solid #1a1a1a; }
    .product-info { padding: 24px; }
    .product-category { font-size: 10px; letter-spacing: 3px; color: #c9a84c; text-transform: uppercase; }
    .product-name { font-size: 18px; font-weight: 400; color: #fff; margin: 8px 0 10px; line-height: 1.3; }
    .product-tagline { font-size: 13px; color: #666; line-height: 1.5; margin-bottom: 20px; }
    .product-footer { display: flex; justify-content: space-between; align-items: center; }
    .product-price { font-size: 22px; color: #c9a84c; }
    .btn-buy { background: #c9a84c; color: #000; border: none; padding: 10px 24px; border-radius: 4px; cursor: pointer; font-size: 12px; letter-spacing: 2px; text-transform: uppercase; font-family: inherit; font-weight: 600; transition: background 0.2s; }
    .btn-buy:hover { background: #e0c06a; }
    footer { border-top: 1px solid #1a1a1a; padding: 32px 40px; text-align: center; color: #333; font-size: 11px; letter-spacing: 3px; text-transform: uppercase; }
    @media (max-width: 600px) { .products { padding: 24px 16px; } header, .hero, .filters { padding-left: 16px; padding-right: 16px; } }
  </style>
</head>
<body>
  <header>
    <div class="logo">Maison Elite</div>
    <div class="tagline-header">Luxury Without Compromise</div>
  </header>
  <section class="hero">
    <h1>Curated Luxury.<br>Honest Prices.</h1>
    <p>Premium leather goods, fine jewelry, and Swiss-style timepieces. Sourced from artisan suppliers. Delivered worldwide.</p>
  </section>
  <div class="filters">${filterBtns}</div>
  <div class="products">${productCards}</div>
  <footer>© 2026 Maison Elite · Secure Checkout · Worldwide Shipping</footer>
  <script>
    function filterProducts(category) {
      document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
      event.target.classList.add('active');
      document.querySelectorAll('.product-card').forEach(card => {
        card.classList.toggle('hidden', category !== 'All' && card.dataset.category !== category);
      });
    }
  </script>
</body>
</html>`, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
}

function renderSuccessPage() {
  return new Response(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Order Confirmed — Maison Elite</title>
  <style>
    body { font-family: Georgia,serif; background:#080808; color:#e0e0e0; min-height:100vh; display:flex; align-items:center; justify-content:center; text-align:center; padding:40px; }
    .container { max-width:480px; }
    .check { font-size:64px; margin-bottom:24px; }
    h1 { font-size:28px; font-weight:300; color:#fff; margin-bottom:12px; }
    p { color:#777; line-height:1.6; margin-bottom:8px; }
    .gold { color:#c9a84c; }
    a { color:#c9a84c; }
  </style>
</head>
<body>
  <div class="container">
    <div class="check">✓</div>
    <h1>Order Confirmed</h1>
    <p class="gold">Thank you for your purchase.</p>
    <p>A confirmation email with your order details has been sent to you. Your item will be dispatched within 2–3 business days.</p>
    <p style="margin-top:24px"><a href="/">← Continue Shopping</a></p>
  </div>
</body>
</html>`, { headers: { 'Content-Type': 'text/html;charset=UTF-8' } });
}

// ── Main Handler ─────────────────────────────────────────────────────────────

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const { pathname, method } = { pathname: url.pathname, method: request.method };

    // Product catalog page
    if (pathname === '/' || pathname === '') {
      return renderStorePage();
    }

    // Success page
    if (pathname === '/success') {
      return renderSuccessPage();
    }

    // Checkout — create Stripe session and redirect
    if (pathname === '/checkout' && method === 'POST') {
      let productId;
      const ct = request.headers.get('content-type') || '';
      if (ct.includes('application/json')) {
        const body = await request.json();
        productId = body.productId;
      } else {
        const body = await request.formData();
        productId = body.get('productId');
      }

      const product = PRODUCTS.find(p => p.id === productId);
      if (!product) return new Response('Product not found', { status: 404 });

      const session = await createCheckoutSession(env, product);
      if (!session.url) {
        return new Response(JSON.stringify({ error: session.error?.message || 'Checkout error' }), {
          status: 500, headers: { 'Content-Type': 'application/json' },
        });
      }
      return Response.redirect(session.url, 303);
    }

    // Stripe Webhook
    if (pathname === '/webhook' && method === 'POST') {
      const sig = request.headers.get('stripe-signature');
      const body = await request.text();

      const event = await verifyStripeSignature(body, sig, env.STRIPE_WEBHOOK_SECRET);
      if (!event) return new Response('Invalid signature', { status: 400 });

      if (event.type === 'checkout.session.completed') {
        const session = event.data.object;
        const { product_id } = session.metadata || {};
        const product = PRODUCTS.find(p => p.id === product_id);
        const customerEmail = session.customer_details?.email;
        const shipping = session.shipping_details;
        const orderRef = `ME-${session.id.slice(-8).toUpperCase()}`;

        if (product && customerEmail && shipping) {
          ctx.waitUntil(Promise.all([
            placeCJOrder(env, product, shipping, customerEmail, orderRef),
            sendOrderConfirmation(env, customerEmail, shipping.name, product, orderRef),
          ]).catch(e => console.error('[Webhook] Fulfillment error:', e)));
        }
      }

      return new Response(JSON.stringify({ received: true }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // JSON product catalog API
    if (pathname === '/api/products') {
      return new Response(JSON.stringify(PRODUCTS.map(({ id, name, tagline, price, category, emoji }) =>
        ({ id, name, tagline, price, category, emoji })
      )), { headers: { 'Content-Type': 'application/json' } });
    }

    return new Response('Not found', { status: 404 });
  },
};

--7ad1ba78d57f062e95ab2afd1b9b9ecf0255e79812d1d6395b3db64fc8ee--
