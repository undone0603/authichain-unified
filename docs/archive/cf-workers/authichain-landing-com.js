--13b9b5314152b04c13ad3cdac8d3d0f7550fcc4818205a5153120d26365f
Content-Disposition: form-data; name="index.js"

var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// index.ts
var HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AuthiChain \u2014 Compliance-Grade Product Authentication</title>
<meta name="description" content="Blockchain-verified compliance for CSRD, DSCSA, EUDR. Mint, track, prove.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300;9..144,500;9..144,700&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
<style>
  :root{
    --ink:#0a1628; --paper:#f4f1ea; --rule:#0a1628;
    --accent:#0f7a4b; --accent-hot:#ff5d2e;
    --shadow: 0 1px 0 var(--ink);
  }
  *{box-sizing:border-box}
  html,body{margin:0;padding:0;background:var(--paper);color:var(--ink);font-family:'Fraunces',serif;font-feature-settings:"ss01","ss02"}
  .mono{font-family:'JetBrains Mono',ui-monospace,monospace;font-size:12px;letter-spacing:.06em;text-transform:uppercase}
  a{color:inherit}
  hr{border:none;border-top:1px solid var(--ink);margin:0}

  /* top bar */
  header{display:flex;justify-content:space-between;align-items:center;padding:18px 32px;border-bottom:1px solid var(--ink)}
  header .brand{font-weight:700;letter-spacing:-0.02em;font-size:20px}
  header .brand sup{font-family:'JetBrains Mono',monospace;font-size:9px;letter-spacing:.08em;opacity:.6;vertical-align:super;margin-left:4px}
  header nav{display:flex;gap:28px}

  /* hero */
  .hero{padding:80px 32px 60px;display:grid;grid-template-columns:1.4fr 1fr;gap:48px;align-items:end;border-bottom:1px solid var(--ink)}
  .hero h1{font-size:clamp(48px,7vw,108px);line-height:.95;margin:0;font-weight:300;letter-spacing:-0.04em}
  .hero h1 em{font-style:italic;color:var(--accent)}
  .hero .meta{display:flex;flex-direction:column;gap:18px}
  .hero .meta p{margin:0;line-height:1.45;font-size:18px;max-width:36ch}

  /* compliance ribbon */
  .ribbon{display:flex;justify-content:space-between;padding:16px 32px;background:var(--ink);color:var(--paper);overflow:hidden;white-space:nowrap}
  .ribbon span{display:inline-flex;align-items:center;gap:10px}
  .ribbon span::before{content:"";width:6px;height:6px;background:var(--accent);border-radius:50%}

  /* stats grid */
  .stats{display:grid;grid-template-columns:repeat(4,1fr);border-bottom:1px solid var(--ink)}
  .stats > div{padding:40px 24px;border-right:1px solid var(--ink)}
  .stats > div:last-child{border-right:none}
  .stats .num{font-size:54px;line-height:1;font-weight:300;letter-spacing:-0.03em;margin-bottom:8px}

  /* tiers */
  .tiers{padding:80px 32px;border-bottom:1px solid var(--ink)}
  .tiers h2{font-size:48px;font-weight:300;letter-spacing:-0.03em;margin:0 0 48px}
  .tier-grid{display:grid;grid-template-columns:repeat(3,1fr);gap:0;border:1px solid var(--ink)}
  .tier{padding:32px;border-right:1px solid var(--ink);display:flex;flex-direction:column;gap:18px;background:var(--paper)}
  .tier:last-child{border-right:none}
  .tier.featured{background:var(--ink);color:var(--paper)}
  .tier h3{font-size:32px;margin:0;font-weight:500;letter-spacing:-0.02em}
  .tier .price{font-size:56px;font-weight:300;letter-spacing:-0.04em;line-height:1}
  .tier .price small{font-size:14px;font-family:'JetBrains Mono',monospace;letter-spacing:.06em;opacity:.7}
  .tier ul{list-style:none;padding:0;margin:0;display:flex;flex-direction:column;gap:10px;font-size:15px}
  .tier ul li::before{content:"+";font-family:'JetBrains Mono',monospace;margin-right:10px;opacity:.5}
  .tier-cta{margin-top:auto;padding:14px 20px;border:1px solid var(--ink);text-decoration:none;text-align:center;font-size:12px;letter-spacing:.08em;transition:background .15s,color .15s}
  .tier-cta:hover{background:var(--ink);color:var(--paper)}
  .tier.featured .tier-cta{border-color:var(--paper);color:var(--paper)}
  .tier.featured .tier-cta.featured{background:var(--accent-hot);border-color:var(--accent-hot);color:var(--ink)}
  .tier.featured .tier-cta:hover{background:var(--paper);color:var(--ink)}

  /* lead form */
  .lead{padding:80px 32px;background:var(--ink);color:var(--paper)}
  .lead-grid{display:grid;grid-template-columns:1fr 1fr;gap:48px;align-items:center}
  .lead h2{font-size:64px;font-weight:300;letter-spacing:-0.04em;margin:0;line-height:.95}
  .lead h2 em{font-style:italic;color:var(--accent-hot)}
  form{display:flex;flex-direction:column;gap:14px}
  form input,form select{background:transparent;border:none;border-bottom:1px solid var(--paper);color:var(--paper);padding:14px 0;font-family:inherit;font-size:18px;outline:none}
  form input:focus,form select:focus{border-bottom-color:var(--accent-hot)}
  form input::placeholder{color:var(--paper);opacity:.45}
  form select option{color:var(--ink)}
  form button{margin-top:16px;background:var(--accent-hot);color:var(--ink);border:none;padding:18px 24px;font-family:'JetBrains Mono',monospace;font-size:13px;letter-spacing:.1em;text-transform:uppercase;cursor:pointer;font-weight:500}
  form button:hover{background:var(--paper)}
  .form-msg{font-family:'JetBrains Mono',monospace;font-size:12px;letter-spacing:.06em;text-transform:uppercase;margin-top:12px;opacity:0;transition:opacity .3s}
  .form-msg.visible{opacity:1}

  /* footer */
  footer{padding:32px;display:flex;justify-content:space-between;align-items:center;background:var(--paper);color:var(--ink)}
  footer .mono{opacity:.5}

  @media(max-width:880px){
    .hero,.lead-grid,.stats,.tier-grid{grid-template-columns:1fr!important}
    .stats > div,.tier{border-right:none!important;border-bottom:1px solid var(--ink)}
    header nav{display:none}
  }
</style>
</head>
<body>

<header>
  <div class="brand">AuthiChain<sup>SM</sup></div>
  <nav class="mono">
    <a href="#tiers">Pricing</a>
    <a href="#lead">Demo</a>
    <a href="https://app.authichain.com">Sign in</a>
  </nav>
</header>

<section class="hero">
  <h1>Compliance,<br><em>cryptographically</em><br>provable.</h1>
  <div class="meta">
    <div class="mono">v2.0 / Polygon-anchored</div>
    <p>The blockchain audit trail your CSRD, DSCSA, and EUDR auditors actually accept. One verification per product. Zero spreadsheet reconciliation.</p>
    <a href="#lead" class="mono" style="border:1px solid var(--ink);padding:16px 24px;text-decoration:none;display:inline-block;width:fit-content">Book compliance review \u2192</a>
  </div>
</section>

<div class="ribbon mono">
  <span>EU CSRD</span><span>FDA DSCSA</span><span>EUDR</span><span>USMCA</span><span>ISO 22005</span>
</div>

<section class="stats mono">
  <div><div class="num">0.04</div>USD per verification</div>
  <div><div class="num">2.1s</div>Average mint time</div>
  <div><div class="num">99.99%</div>Worker uptime</div>
  <div><div class="num">137</div>Polygon mainnet</div>
</section>

<section class="tiers" id="tiers">
  <h2>Three tiers. <em>One audit trail.</em></h2>
  <div class="tier-grid">
    <div class="tier">
      <div class="mono">Starter</div>
      <h3>For pilots</h3>
      <div class="price">$49<small>/ mo</small></div>
      <ul>
        <li>1,000 verifications / mo</li>
        <li>QR + NFC tags</li>
        <li>Public verification page</li>
        <li>Email support</li>
      </ul>
      <a class="tier-cta mono" href="/checkout?sku=authichain_starter">Start trial \u2192</a>
    </div>
    <div class="tier featured">
      <div class="mono">Growth</div>
      <h3>For brands</h3>
      <div class="price">$249<small>/ mo</small></div>
      <ul>
        <li>10,000 verifications / mo</li>
        <li>Branded verification page</li>
        <li>Webhook + Zapier hooks</li>
        <li>Slack support</li>
      </ul>
      <a class="tier-cta mono featured" href="/checkout?sku=authichain_growth">Subscribe \u2192</a>
    </div>
    <div class="tier">
      <div class="mono">Enterprise</div>
      <h3>For compliance</h3>
      <div class="price">$1,999<small>/ mo</small></div>
      <ul>
        <li>Unlimited verifications</li>
        <li>CSRD / DSCSA / EUDR exports</li>
        <li>SSO + audit log</li>
        <li>Named CSM</li>
      </ul>
      <a class="tier-cta mono" href="#lead">Talk to sales \u2192</a>
    </div>
  </div>
</section>

<section class="lead" id="lead">
  <div class="lead-grid">
    <h2>Get a 20-min<br>compliance <em>walkthrough.</em></h2>
    <form id="leadForm" novalidate>
      <input name="email" type="email" placeholder="work@yourcompany.com" required autocomplete="email">
      <input name="firstname" placeholder="First name" autocomplete="given-name">
      <input name="company" placeholder="Company" autocomplete="organization">
      <select name="industry" required>
        <option value="">Industry\u2026</option>
        <option>Pharmaceuticals</option>
        <option>Food &amp; Beverage</option>
        <option>Apparel &amp; Textile</option>
        <option>Cannabis</option>
        <option>Cosmetics</option>
        <option>Electronics</option>
        <option>Other</option>
      </select>
      <button type="submit">Request demo \u2192</button>
      <div class="form-msg" id="formMsg"></div>
    </form>
  </div>
</section>

<footer>
  <div class="mono">\xA9 2026 AuthiChain, Inc.</div>
  <div class="mono">authichain.com / 0x4da4D267\u2026972BE</div>
</footer>

<script>
document.getElementById('leadForm').addEventListener('submit', async (e) => {
  e.preventDefault();
  const form = e.target;
  const msg = document.getElementById('formMsg');
  const data = Object.fromEntries(new FormData(form).entries());
  data.brand = 'authichain';

  msg.textContent = 'Submitting\u2026';
  msg.classList.add('visible');
  try {
    const r = await fetch('/lead', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!r.ok) throw new Error(await r.text());
    msg.textContent = 'Got it. We will reach out within one business day.';
    form.reset();
  } catch (err) {
    msg.textContent = 'Submission failed \u2014 email founders@authichain.com';
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
var THANKS_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>Thanks \u2014 AuthiChain</title>
<style>html,body{margin:0;background:#f4f1ea;color:#0a1628;font-family:'Fraunces',Georgia,serif;height:100%;display:grid;place-items:center}
h1{font-size:64px;font-weight:300;letter-spacing:-0.04em;margin:0 0 16px}
p{max-width:46ch;line-height:1.45;margin:0 0 24px}
a{color:#0a1628}</style></head><body><div style="text-align:center;padding:32px">
<h1>You're in.</h1><p>Welcome email is on its way. Check spam if it doesn't land in 60 seconds.</p>
<a href="/">\u2190 back to authichain.com</a></div></body></html>`;
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
  const successUrl = env.SUCCESS_URL ?? "https://authichain.com/thanks";
  const cancelUrl = env.CANCEL_URL ?? "https://authichain.com/";
  const session = await stripeFormPost("checkout/sessions", {
    mode: "subscription",
    "line_items[0][price]": priceId,
    "line_items[0][quantity]": "1",
    success_url: successUrl,
    cancel_url: cancelUrl,
    allow_promotion_codes: "true",
    "subscription_data[metadata][brand]": "authichain",
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
    industry: body.industry ?? "",
    lifecyclestage: "lead",
    hs_lead_status: "NEW",
    last_brand_purchased: body.brand ?? "authichain",
    source: "authichain.com"
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

--13b9b5314152b04c13ad3cdac8d3d0f7550fcc4818205a5153120d26365f--
