--98067af56f91a8596cdff4afee6d06096c2a53e8ce49176108f239fac415
Content-Disposition: form-data; name="index.js"

var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// src/index.ts
var index_default = {
  async fetch(req, env, ctx) {
    if (req.method !== "POST") return new Response("method not allowed", { status: 405 });
    const sig = req.headers.get("stripe-signature");
    if (!sig) return new Response("missing signature", { status: 400 });
    const raw = await req.text();
    const ok = await verifyStripeSignature(raw, sig, env.STRIPE_WEBHOOK_SECRET);
    if (!ok) return new Response("bad signature", { status: 400 });
    const event = JSON.parse(raw);
    const seen = await env.IDEMPOTENCY.get(event.id);
    if (seen) return new Response("already processed", { status: 200 });
    await env.IDEMPOTENCY.put(event.id, "1", { expirationTtl: 60 * 60 * 24 * 7 });
    ctx.waitUntil(dispatch(event, env));
    return new Response("ok", { status: 200 });
  }
};
async function dispatch(event, env) {
  try {
    switch (event.type) {
      case "checkout.session.completed":
        await handleCheckoutCompleted(event.data.object, env);
        break;
      case "customer.subscription.created":
        await handleSubscriptionCreated(event.data.object, env);
        break;
      case "customer.subscription.deleted":
        await handleSubscriptionCanceled(event.data.object, env);
        break;
      case "invoice.payment_failed":
        await handlePaymentFailed(event.data.object, env);
        break;
      default:
        break;
    }
  } catch (e) {
    console.error("dispatch error", event.type, e);
  }
}
__name(dispatch, "dispatch");
async function handleCheckoutCompleted(session, env) {
  const email = session.customer_details?.email ?? session.customer_email;
  const name = session.customer_details?.name ?? "";
  const brand = inferBrand(session);
  if (email) {
    await Promise.all([
      hubspotUpsertContact(email, name, brand, env),
      resendWelcomeEmail(email, name, brand, env)
    ]);
  }
}
__name(handleCheckoutCompleted, "handleCheckoutCompleted");
async function handleSubscriptionCreated(sub, env) {
  const cust = await stripeGet(`customers/${sub.customer}`, env);
  const brand = inferBrand(sub);
  if (cust.email) {
    await hubspotCreateDeal(cust.email, sub, brand, env);
  }
}
__name(handleSubscriptionCreated, "handleSubscriptionCreated");
async function handleSubscriptionCanceled(sub, env) {
  const cust = await stripeGet(`customers/${sub.customer}`, env);
  if (cust.email) {
    await hubspotUpsertContact(cust.email, cust.name ?? "", "churn", env, {
      hs_lead_status: "CHURNED"
    });
  }
}
__name(handleSubscriptionCanceled, "handleSubscriptionCanceled");
async function handlePaymentFailed(invoice, env) {
  const cust = await stripeGet(`customers/${invoice.customer}`, env);
  if (cust.email) {
    await resendDunningEmail(cust.email, invoice, env);
  }
}
__name(handlePaymentFailed, "handlePaymentFailed");
async function hubspotUpsertContact(email, name, brand, env, extraProps = {}) {
  const [first, ...rest] = (name || "").split(" ");
  const last = rest.join(" ");
  const props = {
    email,
    firstname: first || "",
    lastname: last || "",
    lifecyclestage: "customer",
    hs_lead_status: "CONNECTED",
    last_brand_purchased: brand,
    ...extraProps
  };
  const res = await fetch(`https://api.hubapi.com/crm/v3/objects/contacts/${encodeURIComponent(email)}?idProperty=email`, {
    method: "PATCH",
    headers: hubspotHeaders(env),
    body: JSON.stringify({ properties: props })
  });
  if (res.status === 404) {
    await fetch("https://api.hubapi.com/crm/v3/objects/contacts", {
      method: "POST",
      headers: hubspotHeaders(env),
      body: JSON.stringify({ properties: props })
    });
  }
}
__name(hubspotUpsertContact, "hubspotUpsertContact");
async function hubspotCreateDeal(email, sub, brand, env) {
  const amount = (sub.items?.data?.[0]?.price?.unit_amount ?? 0) / 100;
  const dealRes = await fetch("https://api.hubapi.com/crm/v3/objects/deals", {
    method: "POST",
    headers: hubspotHeaders(env),
    body: JSON.stringify({
      properties: {
        dealname: `${brand} subscription - ${email}`,
        amount: String(amount),
        dealstage: "closedwon",
        pipeline: "default",
        closedate: (/* @__PURE__ */ new Date()).toISOString()
      }
    })
  });
  if (!dealRes.ok) return;
  const deal = await dealRes.json();
  const contactRes = await fetch(
    `https://api.hubapi.com/crm/v3/objects/contacts/${encodeURIComponent(email)}?idProperty=email`,
    { headers: hubspotHeaders(env) }
  );
  if (contactRes.ok) {
    const contact = await contactRes.json();
    await fetch(
      `https://api.hubapi.com/crm/v4/objects/deals/${deal.id}/associations/default/contacts/${contact.id}`,
      { method: "PUT", headers: hubspotHeaders(env) }
    );
  }
}
__name(hubspotCreateDeal, "hubspotCreateDeal");
function hubspotHeaders(env) {
  return {
    Authorization: `Bearer ${env.HUBSPOT_TOKEN}`,
    "Content-Type": "application/json"
  };
}
__name(hubspotHeaders, "hubspotHeaders");
async function resendWelcomeEmail(email, name, brand, env) {
  const from = env.FROM_EMAIL ?? "noreply@authichain.com";
  const subject = brand === "qron" ? "Welcome to QRON \u2014 your first artistic QR code awaits" : "Welcome to AuthiChain \u2014 verification keys ready";
  const html = welcomeHtml(name, brand);
  await resendSend(email, from, subject, html, env);
}
__name(resendWelcomeEmail, "resendWelcomeEmail");
async function resendDunningEmail(email, invoice, env) {
  const from = env.FROM_EMAIL ?? "noreply@authichain.com";
  const html = `<p>Heads up \u2014 your latest payment didn't go through.</p>
    <p><a href="${invoice.hosted_invoice_url}">Update your payment method</a> to keep service active.</p>`;
  await resendSend(email, from, "Payment failed \u2014 quick action needed", html, env);
}
__name(resendDunningEmail, "resendDunningEmail");
async function resendSend(to, from, subject, html, env) {
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ from, to, subject, html })
  });
}
__name(resendSend, "resendSend");
async function stripeGet(path, env) {
  const res = await fetch(`https://api.stripe.com/v1/${path}`, {
    headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}` }
  });
  return res.json();
}
__name(stripeGet, "stripeGet");
function inferBrand(obj) {
  const meta = obj.metadata ?? obj.subscription_data?.metadata ?? {};
  if (meta.brand === "qron") return "qron";
  if (meta.brand === "authichain") return "authichain";
  const li = obj.line_items?.data ?? obj.items?.data ?? [];
  for (const item of li) {
    const b = item.price?.product?.metadata?.brand ?? item.price?.metadata?.brand;
    if (b === "qron") return "qron";
    if (b === "authichain") return "authichain";
  }
  return "unknown";
}
__name(inferBrand, "inferBrand");
function welcomeHtml(name, brand) {
  const safe = (name || "there").replace(/[<>]/g, "");
  if (brand === "qron") {
    return `
      <div style="font-family:Georgia,serif;max-width:560px;margin:auto;padding:32px;background:#fafafa;">
        <h1 style="font-size:28px;letter-spacing:-0.02em;margin:0 0 16px;">Hey ${safe},</h1>
        <p>You're in. QRON turns plain QR codes into things people actually want to scan.</p>
        <p><a href="https://qron.space/dashboard" style="display:inline-block;padding:12px 24px;background:#000;color:#fff;text-decoration:none;border-radius:4px;">Open dashboard</a></p>
      </div>`;
  }
  return `
    <div style="font-family:'Helvetica Neue',Arial,sans-serif;max-width:560px;margin:auto;padding:32px;">
      <h1 style="font-size:24px;margin:0 0 16px;color:#0a2540;">Welcome, ${safe}.</h1>
      <p>Your AuthiChain workspace is provisioned. The next step is generating your first verification credential.</p>
      <p><a href="https://authichain.com/dashboard" style="display:inline-block;padding:12px 24px;background:#0a2540;color:#fff;text-decoration:none;border-radius:4px;">Get started</a></p>
    </div>`;
}
__name(welcomeHtml, "welcomeHtml");
async function verifyStripeSignature(payload, header, secret) {
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=")));
  const t = parts["t"];
  const v1 = parts["v1"];
  if (!t || !v1) return false;
  const now = Math.floor(Date.now() / 1e3);
  if (Math.abs(now - Number(t)) > 300) return false;
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(`${t}.${payload}`));
  const hex = Array.from(new Uint8Array(sig)).map((b) => b.toString(16).padStart(2, "0")).join("");
  if (hex.length !== v1.length) return false;
  let diff = 0;
  for (let i = 0; i < hex.length; i++) diff |= hex.charCodeAt(i) ^ v1.charCodeAt(i);
  return diff === 0;
}
__name(verifyStripeSignature, "verifyStripeSignature");
export {
  index_default as default
};
//# sourceMappingURL=index.js.map

--98067af56f91a8596cdff4afee6d06096c2a53e8ce49176108f239fac415--
