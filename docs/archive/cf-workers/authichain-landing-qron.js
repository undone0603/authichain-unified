--f6f7e90edc241d09290b8c46087bf476904f4132a14ab209b3e9515ab0bc
Content-Disposition: form-data; name="index.js"

var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// index.ts
var HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>QRON \u2014 QR Codes That Are Worth Scanning</title>
<meta name="description" content="AI-generated artistic QR codes. Blockchain-verified. Trigger AR, payments, stories on every scan.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Space+Grotesk:wght@300;400;500;600;700&display=swap" rel="stylesheet">
<style>
  :root{
    --bg:#0a0613;
    --ink:#fafafa;
    --hot:#ff3d00;
    --acid:#c2ff3d;
    --plum:#c75bff;
    --cyan:#3df0ff;
  }
  *{box-sizing:border-box;margin:0;padding:0}
  html,body{background:var(--bg);color:var(--ink);font-family:'Space Grotesk',sans-serif;overflow-x:hidden}
  a{color:inherit;text-decoration:none}

  /* noise overlay */
  body::before{content:"";position:fixed;inset:0;pointer-events:none;z-index:1000;
    background-image:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='200' height='200'><filter id='n'><feTurbulence baseFrequency='0.9' numOctaves='2'/><feColorMatrix values='0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.04 0'/></filter><rect width='100%' height='100%' filter='url(%23n)'/></svg>");
    mix-blend-mode:overlay}

  /* gradient blobs */
  .blob{position:fixed;border-radius:50%;filter:blur(80px);opacity:.55;pointer-events:none;z-index:0;animation:drift 14s ease-in-out infinite}
  .blob.b1{width:520px;height:520px;background:var(--hot);top:-180px;left:-120px;animation-delay:0s}
  .blob.b2{width:420px;height:420px;background:var(--plum);top:30%;right:-150px;animation-delay:-4s}
  .blob.b3{width:380px;height:380px;background:var(--cyan);bottom:-100px;left:30%;animation-delay:-8s}
  @keyframes drift{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(40px,-30px) scale(1.08)}}

  /* layout */
  main{position:relative;z-index:1}
  header{display:flex;justify-content:space-between;align-items:center;padding:24px 40px;font-weight:500;letter-spacing:-0.02em}
  header .brand{font-family:'Instrument Serif',serif;font-size:32px;font-style:italic}
  header nav{display:flex;gap:32px;font-size:14px;text-transform:uppercase;letter-spacing:.1em}

  .hero{padding:60px 40px 120px;position:relative}
  .hero .eyebrow{font-size:13px;text-transform:uppercase;letter-spacing:.2em;opacity:.7;margin-bottom:32px;display:flex;align-items:center;gap:12px}
  .hero .eyebrow::before{content:"";width:24px;height:1px;background:var(--ink)}
  .hero h1{font-family:'Instrument Serif',serif;font-size:clamp(60px,11vw,180px);line-height:.85;font-weight:400;letter-spacing:-0.04em;max-width:14ch}
  .hero h1 em{font-style:italic;background:linear-gradient(90deg,var(--hot),var(--plum),var(--cyan));-webkit-background-clip:text;background-clip:text;color:transparent}
  .hero .sub{margin-top:32px;font-size:22px;max-width:46ch;opacity:.8;line-height:1.4}

  .qr-marquee{padding:0;border-top:1px solid rgba(250,250,250,.15);border-bottom:1px solid rgba(250,250,250,.15);overflow:hidden;display:flex;background:rgba(0,0,0,.3)}
  .qr-marquee .track{display:flex;gap:64px;padding:32px 0;animation:scroll 24s linear infinite;flex-shrink:0;white-space:nowrap}
  .qr-marquee .item{font-family:'Instrument Serif',serif;font-style:italic;font-size:48px;display:flex;align-items:center;gap:32px}
  .qr-marquee .dot{width:8px;height:8px;background:var(--acid);border-radius:50%}
  @keyframes scroll{from{transform:translateX(0)}to{transform:translateX(-50%)}}

  .stack{padding:120px 40px;display:grid;grid-template-columns:1fr 1fr;gap:80px;max-width:1400px;margin:0 auto;align-items:start}
  .stack .pillar{position:relative}
  .stack .num{font-family:'Instrument Serif',serif;font-size:120px;font-style:italic;line-height:1;color:var(--hot);opacity:.9}
  .stack h3{font-family:'Instrument Serif',serif;font-size:48px;font-style:italic;font-weight:400;margin:8px 0 16px;letter-spacing:-0.02em}
  .stack p{font-size:18px;line-height:1.5;opacity:.75;max-width:42ch}

  /* tier cards */
  .pricing{padding:120px 40px;text-align:center}
  .pricing h2{font-family:'Instrument Serif',serif;font-size:clamp(48px,7vw,108px);font-weight:400;letter-spacing:-0.04em;line-height:1}
  .pricing h2 em{font-style:italic;background:linear-gradient(90deg,var(--acid),var(--cyan));-webkit-background-clip:text;background-clip:text;color:transparent}
  .cards{display:grid;grid-template-columns:repeat(3,1fr);gap:24px;max-width:1200px;margin:64px auto 0}
  .card{padding:40px 32px;border:1px solid rgba(250,250,250,.15);border-radius:24px;text-align:left;backdrop-filter:blur(20px);background:rgba(255,255,255,.03);transition:transform .25s,border-color .25s}
  .card:hover{transform:translateY(-4px);border-color:var(--acid)}
  .card .tag{font-size:12px;text-transform:uppercase;letter-spacing:.15em;opacity:.6}
  .card h3{font-family:'Instrument Serif',serif;font-size:36px;font-weight:400;margin:8px 0 24px;letter-spacing:-0.02em}
  .card .price{font-size:64px;font-weight:300;letter-spacing:-0.04em;line-height:1}
  .card .price small{font-size:16px;opacity:.6}
  .card ul{list-style:none;margin-top:24px;display:flex;flex-direction:column;gap:10px;font-size:14px;opacity:.85}
  .card ul li::before{content:"\u25C6";color:var(--hot);margin-right:10px}
  .card-cta{display:block;margin-top:24px;padding:14px 20px;border:1px solid rgba(250,250,250,.25);border-radius:10px;text-align:center;font-size:14px;text-decoration:none;color:var(--ink);transition:all .2s}
  .card-cta:hover{border-color:var(--acid);color:var(--acid)}
  .card-cta.hot{background:var(--acid);color:#000;border-color:var(--acid);font-weight:600}
  .card-cta.hot:hover{background:#fff;border-color:#fff}

  /* lead block */
  .lead{padding:120px 40px;display:grid;grid-template-columns:1fr 1fr;gap:64px;max-width:1400px;margin:0 auto;align-items:center}
  .lead h2{font-family:'Instrument Serif',serif;font-size:clamp(48px,7vw,96px);font-weight:400;letter-spacing:-0.04em;line-height:.9}
  .lead h2 em{font-style:italic;color:var(--acid)}
  form{display:flex;flex-direction:column;gap:18px}
  form input,form select{background:rgba(255,255,255,.04);border:1px solid rgba(250,250,250,.2);border-radius:12px;color:var(--ink);padding:18px 20px;font-family:inherit;font-size:16px;outline:none;transition:border-color .2s}
  form input:focus,form select:focus{border-color:var(--acid)}
  form input::placeholder{color:var(--ink);opacity:.4}
  form select option{color:#000}
  form button{margin-top:8px;background:var(--acid);color:#000;border:none;padding:20px 28px;border-radius:12px;font-family:inherit;font-size:16px;font-weight:600;letter-spacing:-0.01em;cursor:pointer;transition:transform .15s}
  form button:hover{transform:scale(1.01)}
  .form-msg{font-size:13px;opacity:0;transition:opacity .3s;margin-top:4px}
  .form-msg.visible{opacity:.85}

  footer{padding:32px 40px;border-top:1px solid rgba(250,250,250,.15);display:flex;justify-content:space-between;font-size:13px;opacity:.6}

  @media(max-width:880px){
    .stack,.lead,.cards{grid-template-columns:1fr!important}
    header nav{display:none}
  }
</style>
</head>
<body>
<div class="blob b1"></div>
<div class="blob b2"></div>
<div class="blob b3"></div>

<main>
<header>
  <div class="brand">qron</div>
  <nav>
    <a href="#stack">How</a>
    <a href="#pricing">Pricing</a>
    <a href="#lead">Beta</a>
  </nav>
</header>

<section class="hero">
  <div class="eyebrow">QRON / Generative authentication</div>
  <h1>QR codes<br>worth <em>scanning.</em></h1>
  <p class="sub">AI-generated artistic codes. Blockchain-verified provenance. Every scan triggers AR, payment, or story \u2014 anything you wire up.</p>
</section>

<div class="qr-marquee">
  <div class="track">
    <span class="item">artistic QR <span class="dot"></span></span>
    <span class="item">truemark verified <span class="dot"></span></span>
    <span class="item">autoflow triggers <span class="dot"></span></span>
    <span class="item">AR experiences <span class="dot"></span></span>
    <span class="item">on-chain provenance <span class="dot"></span></span>
    <span class="item">artistic QR <span class="dot"></span></span>
    <span class="item">truemark verified <span class="dot"></span></span>
    <span class="item">autoflow triggers <span class="dot"></span></span>
    <span class="item">AR experiences <span class="dot"></span></span>
    <span class="item">on-chain provenance <span class="dot"></span></span>
  </div>
</div>

<section class="stack" id="stack">
  <div class="pillar">
    <div class="num">01</div>
    <h3>Generate</h3>
    <p>Stable Diffusion + ControlNet renders codes that look like art and scan like barcodes. Pick a style or upload a brand reference.</p>
  </div>
  <div class="pillar">
    <div class="num">02</div>
    <h3>Anchor</h3>
    <p>Truemark mints each code's fingerprint to Polygon. Counterfeit attempts fail signature checks. Auditors see a tamper-evident chain.</p>
  </div>
  <div class="pillar">
    <div class="num">03</div>
    <h3>Trigger</h3>
    <p>AutoFlow turns each scan into a workflow \u2014 AR experience, drop, drip campaign, payment, gated content. Wire it once, run it forever.</p>
  </div>
  <div class="pillar">
    <div class="num">04</div>
    <h3>Measure</h3>
    <p>Every scan returns geo, device, time, and downstream conversion to your dashboard. A QR code that finally pays for itself.</p>
  </div>
</section>

<section class="pricing" id="pricing">
  <h2>Three plans.<br><em>One creative weapon.</em></h2>
  <div class="cards">
    <div class="card">
      <div class="tag">Creator</div>
      <h3>Solo &amp; small</h3>
      <div class="price">$19<small>/ mo</small></div>
      <ul>
        <li>100 artistic codes / mo</li>
        <li>5 AutoFlow recipes</li>
        <li>QRON-branded landing</li>
      </ul>
      <a class="card-cta" href="/checkout?sku=qron_creator">Start \u2192</a>
    </div>
    <div class="card">
      <div class="tag">Brand</div>
      <h3>Most popular</h3>
      <div class="price">$99<small>/ mo</small></div>
      <ul>
        <li>1,000 codes / mo</li>
        <li>Truemark on-chain anchoring</li>
        <li>Unlimited AutoFlow</li>
        <li>Custom landing pages</li>
      </ul>
      <a class="card-cta hot" href="/checkout?sku=qron_brand">Get QRON Brand \u2192</a>
    </div>
    <div class="card">
      <div class="tag">Agency</div>
      <h3>White-label</h3>
      <div class="price">$399<small>/ mo</small></div>
      <ul>
        <li>Unlimited codes</li>
        <li>White-label dashboard</li>
        <li>Public API + webhooks</li>
        <li>Named producer</li>
      </ul>
      <a class="card-cta" href="/checkout?sku=qron_agency">Talk to us \u2192</a>
    </div>
  </div>
</section>

<section class="lead" id="lead">
  <h2>Get on the <em>private</em><br>beta list.</h2>
  <form id="leadForm" novalidate>
    <input name="email" type="email" placeholder="you@brand.com" required autocomplete="email">
    <input name="firstname" placeholder="First name" autocomplete="given-name">
    <input name="company" placeholder="Brand or agency" autocomplete="organization">
    <select name="useCase" required>
      <option value="">Primary use case\u2026</option>
      <option>Product packaging</option>
      <option>Event / drop activation</option>
      <option>Music / merch</option>
      <option>Cannabis / regulated</option>
      <option>Real estate / outdoor</option>
      <option>Other</option>
    </select>
    <button type="submit">Request beta access</button>
    <div class="form-msg" id="formMsg"></div>
  </form>
</section>

<footer>
  <span>\xA9 2026 QRON</span>
  <span>qron.space \xB7 part of AuthiChain</span>
</footer>
</main>

<script>
document.getElementById('leadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const msg = document.getElementById('formMsg');
  const data = Object.fromEntries(new FormData(form).entries());
  data.brand = 'qron';

  msg.textContent = 'Sending\u2026';
  msg.classList.add('visible');
  try {
    const r = await fetch('/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!r.ok) throw new Error(await r.text());
    msg.textContent = "You're on the list. Watch your inbox.";
    form.reset();
  } catch (err) {
    msg.textContent = 'Hmm, something broke. Email hello@qron.space';
  }
});
<\/script>
</body>
</html>`;
var index_default = {
  async fetch(req, env) {
    const url = new URL(req.url);
    if (url.pathname === "/lead" && req.method === "POST") {
      return handleLead(req, env);
    }
    if (url.pathname === "/checkout" && req.method === "GET") {
      return handleCheckout(url, env);
    }
    if (url.pathname === "/thanks") {
      return new Response(THANKS_HTML, {
        headers: { "content-type": "text/html;charset=utf-8" }
      });
    }
    return new Response(HTML, {
      headers: {
        "content-type": "text/html;charset=utf-8",
        "cache-control": "public, max-age=300, s-maxage=600",
        "x-content-type-options": "nosniff"
      }
    });
  }
};
var THANKS_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>Welcome \u2014 QRON</title>
<style>html,body{margin:0;background:#0a0613;color:#fafafa;font-family:'Instrument Serif',Georgia,serif;height:100%;display:grid;place-items:center}
h1{font-size:80px;font-weight:400;font-style:italic;margin:0 0 16px}
p{max-width:46ch;line-height:1.45;margin:0 0 24px;font-family:'Space Grotesk',sans-serif;opacity:.8}
a{color:#c2ff3d}</style></head><body><div style="text-align:center;padding:32px">
<h1>Welcome.</h1><p>Your QRON workspace is being provisioned. Watch your inbox.</p>
<a href="/">\u2190 qron.space</a></div></body></html>`;
var PRICE_TTL_SECONDS = 60 * 60;
async function handleCheckout(url, env) {
  const sku = url.searchParams.get("sku");
  if (!sku || !/^[a-z0-9_]+$/.test(sku)) {
    return new Response("invalid sku", { status: 400 });
  }
  let priceId = await getCachedPrice(sku, env);
  if (!priceId) {
    priceId = await lookupStripePrice(sku, env);
    if (!priceId) {
      return new Response(
        `Pricing for "${sku}" not configured yet. Run Set-StripeProducts.ps1.`,
        { status: 503 }
      );
    }
    await setCachedPrice(sku, priceId, env);
  }
  const successUrl = env.SUCCESS_URL ?? "https://qron.space/thanks";
  const cancelUrl = env.CANCEL_URL ?? "https://qron.space/";
  const session = await stripeFormPost("checkout/sessions", {
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: "true",
    "subscription_data[metadata][brand]": "qron",
    "subscription_data[metadata][sku]": sku
  }, env);
  if (!session?.url) {
    return new Response("checkout session creation failed", { status: 502 });
  }
  return Response.redirect(session.url, 303);
}
__name(handleCheckout, "handleCheckout");
async function getCachedPrice(sku, env) {
  if (!env.PRICE_CACHE) return null;
  return env.PRICE_CACHE.get(`price:${sku}`);
}
__name(getCachedPrice, "getCachedPrice");
async function setCachedPrice(sku, priceId, env) {
  if (!env.PRICE_CACHE) return;
  await env.PRICE_CACHE.put(`price:${sku}`, priceId, { expirationTtl: PRICE_TTL_SECONDS });
}
__name(setCachedPrice, "setCachedPrice");
async function lookupStripePrice(sku, env) {
  const products = await stripeGet(
    `products/search?query=${encodeURIComponent(`metadata['sku']:'${sku}'`)}`,
    env
  );
  const product = products?.data?.[0];
  if (!product) return null;
  const prices = await stripeGet(
    `prices?product=${product.id}&active=true&limit=10`,
    env
  );
  const price = prices?.data?.find(
    (p) => p.recurring && p.unit_amount && p.active
  );
  return price?.id ?? null;
}
__name(lookupStripePrice, "lookupStripePrice");
async function stripeGet(path, env) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` }
  });
  return res.ok ? await res.json() : null;
}
__name(stripeGet, "stripeGet");
async function stripeFormPost(path, body, env) {
  const params = new URLSearchParams(body);
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`,
      "Content-Type": "application/x-www-form-urlencoded"
    },
    body: params.toString()
  });
  return res.ok ? await res.json() : null;
}
__name(stripeFormPost, "stripeFormPost");
async function handleLead(req, env) {
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response("bad json", { status: 400 });
  }
  const email = (body.email || "").trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return new Response("invalid email", { status: 400 });
  }
  const props = {
    email,
    firstname: body.firstname ?? "",
    company: body.company ?? "",
    qron_use_case: body.useCase ?? "",
    lifecyclestage: "lead",
    hs_lead_status: "NEW",
    last_brand_purchased: "qron",
    source: "qron.space"
  };
  const upsert = await fetch(
    `https://api.hubapi.com/crm/v3/objects/contacts/${encodeURIComponent(email)}?idProperty=email`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${env.HUBSPOT_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ properties: props })
    }
  );
  if (upsert.status === 404) {
    await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${env.HUBSPOT_TOKEN}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ properties: props })
    });
  }
  return new Response(JSON.stringify({ ok: true }), {
    headers: { "content-type": "application/json" }
  });
}
__name(handleLead, "handleLead");
export {
  index_default as default
};
//# sourceMappingURL=index.js.map

--f6f7e90edc241d09290b8c46087bf476904f4132a14ab209b3e9515ab0bc--
