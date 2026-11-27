/** Hosted Checkout for the approved catalog, with verified fulfillment handoff. */
export type Sku = "OEM-VERIFY" | "PACK-WORKFLOW";
export const LOOKUPS = {
  STRIPE_PRICE_OEM_SETUP: "authichain_oem_verify_setup_usd_v1",
  STRIPE_PRICE_OEM_MONTHLY: "authichain_oem_verify_monthly_usd_v1",
  STRIPE_PRICE_PACK: "authichain_pack_workflow_usd_v1",
} as const;
type Binding = keyof typeof LOOKUPS;
interface Service { fetch(request: Request): Promise<Response> }
export interface Env {
  STRIPE_SECRET_KEY?: string;
  STRIPE_WEBHOOK_SECRET?: string;
  STRIPE_PRICE_OEM_SETUP?: string;
  STRIPE_PRICE_OEM_MONTHLY?: string;
  STRIPE_PRICE_PACK?: string;
  STRIPE_MODE?: "live" | "test";
  CHECKOUT_ENABLED?: string;
  PUBLIC_ORIGIN?: string;
  ALLOWED_ORIGINS?: string;
  LICENSE_FULFILLMENT?: Service;
}
interface Price {
  id: string; active: boolean; currency: string; unit_amount: number; livemode: boolean;
  lookup_key: string; recurring: { interval: string; interval_count: number } | null;
}
interface Session {
  id: string; object: string; livemode: boolean; mode: string; payment_status: string; status: string;
  currency: string; amount_subtotal: number; amount_total: number;
  customer: string | null; subscription: string | null; metadata: Record<string, string>;
}
interface StripeEvent { id: string; type: string; livemode: boolean; account?: string; data: { object: { id: string } } }
const KIND = "oem_workflow_v1";
const JSON_HEADERS = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" };
const isSku = (value: unknown): value is Sku => value === "OEM-VERIFY" || value === "PACK-WORKFLOW";
const fieldsFor = (sku: Sku): Binding[] => sku === "OEM-VERIFY" ? ["STRIPE_PRICE_OEM_SETUP", "STRIPE_PRICE_OEM_MONTHLY"] : ["STRIPE_PRICE_PACK"];
const totalFor = (sku: Sku) => sku === "OEM-VERIFY" ? 900_000 : 150_000;
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: JSON_HEADERS });
export function validPrice(price: Price, binding: Binding, live: boolean): boolean {
  const monthly = binding === "STRIPE_PRICE_OEM_MONTHLY";
  return /^price_[A-Za-z0-9]+$/.test(price.id) && price.active === true && price.currency === "usd" && price.livemode === live
    && price.lookup_key === LOOKUPS[binding] && price.unit_amount === (binding === "STRIPE_PRICE_OEM_SETUP" ? 750_000 : 150_000)
    && (monthly ? price.recurring?.interval === "month" && price.recurring.interval_count === 1 : price.recurring === null);
}
async function hash(value: string): Promise<string> {
  return Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value)))).map(byte => byte.toString(16).padStart(2, "0")).join("");
}
async function verify(body: string, header: string, secret: string, time: number): Promise<StripeEvent> {
  const parts = header.split(",").map(value => value.trim());
  const ts = parts.filter(value => /^t=\d+$/.test(value));
  if (ts.length !== 1 || parts.filter(value => value.startsWith("t=")).length !== 1) throw new Error("signature");
  const t = Number(ts[0].slice(2));
  if (!Number.isSafeInteger(t) || Math.abs(time / 1000 - t) > 300) throw new Error("signature");
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["verify"]);
  let valid = false;
  for (const sig of parts.filter(value => /^v1=[a-fA-F0-9]{64}$/.test(value))) {
    const bytes = Uint8Array.from(sig.slice(3).match(/../g)!, value => parseInt(value, 16));
    if (await crypto.subtle.verify("HMAC", key, bytes, new TextEncoder().encode(`${t}.${body}`))) valid = true;
  }
  if (!valid) throw new Error("signature");
  return JSON.parse(body) as StripeEvent;
}
async function text(request: Request): Promise<string> {
  const reader = request.body?.getReader();
  if (!reader) return "";
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let bytes = 0;
  let output = "";
  try {
    while (true) {
      const item = await reader.read(); if (item.done) break;
      bytes += item.value.byteLength;
      if (bytes > 262144) { await reader.cancel(); throw new Error("body"); }
      output += decoder.decode(item.value, { stream: true });
    }
    return output + decoder.decode();
  } finally { reader.releaseLock(); }
}
function configuration(env: Env): { origin: string; live: boolean } {
  if (!env.STRIPE_MODE || !new RegExp(`^(sk|rk)_${env.STRIPE_MODE}_`).test(env.STRIPE_SECRET_KEY ?? "")) throw new Error("mode");
  const origin = new URL(env.PUBLIC_ORIGIN ?? "");
  if (origin.protocol !== "https:" || origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash) throw new Error("origin");
  return { origin: origin.origin, live: env.STRIPE_MODE === "live" };
}

export function createWorker(deps: { fetch?: typeof fetch; now?: () => number } = {}) {
  const request = deps.fetch ?? globalThis.fetch;
  const now = deps.now ?? Date.now;
  async function stripe(env: Env, path: string, body?: URLSearchParams, key?: string) {
    configuration(env);
    const response = await request(`https://api.stripe.com/v1/${path}`, {
      method: body ? "POST" : "GET", redirect: "error", signal: AbortSignal.timeout(20_000),
      headers: { Authorization: `Bearer ${env.STRIPE_SECRET_KEY}`, "Stripe-Version": "2026-08-26.dahlia",
        ...(body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}), ...(key ? { "Idempotency-Key": key } : {}) },
      ...(body ? { body: body.toString() } : {}),
    });
    if (!response.ok) throw new Error("Stripe request failed");
    return await response.json() as Record<string, unknown>;
  }
  async function backend(env: Env, path: string, body?: unknown) {
    if (!env.LICENSE_FULFILLMENT) throw new Error("Fulfillment is not connected");
    const response = await env.LICENSE_FULFILLMENT.fetch(new Request(`https://license-fulfillment.internal${path}`, {
      method: body ? "POST" : "GET", signal: AbortSignal.timeout(20_000), headers: { "Content-Type": "application/json" }, ...(body ? { body: JSON.stringify(body) } : {}),
    }));
    if (!response.ok) throw new Error("Fulfillment unavailable");
    return await response.json() as Record<string, unknown>;
  }
  async function ready(env: Env, sku: Sku) {
    const data = await backend(env, "/ready");
    const entry = (data.skus as Record<string, Record<string, unknown>> | undefined)?.[sku];
    if (entry?.ready !== true || (sku === "OEM-VERIFY" && (entry.api_access !== true || entry.subscription_lifecycle !== true)) || (sku === "PACK-WORKFLOW" && (entry.download_ready !== true || typeof entry.version !== "string"))) throw new Error("Deliverable is not ready");
  }
  async function checkedSession(env: Env, id: string): Promise<{ session: Session; sku: Sku }> {
    if (!/^cs_(live|test)_[A-Za-z0-9_]+$/.test(id)) throw new Error("session");
    const session = await stripe(env, `checkout/sessions/${id}`) as unknown as Session;
    const sku = session.metadata?.sku;
    if (session.id !== id || session.object !== "checkout.session" || session.livemode !== configuration(env).live || session.metadata?.product_line !== KIND || !isSku(sku)) throw new Error("session");
    if (session.status !== "complete" || session.payment_status !== "paid" || session.currency !== "usd" || session.amount_subtotal !== totalFor(sku) || session.amount_total < totalFor(sku) || !session.customer) throw new Error("payment not verified");
    if (session.mode !== (sku === "OEM-VERIFY" ? "subscription" : "payment") || (sku === "OEM-VERIFY" && !session.subscription)) throw new Error("session mode");
    const items = await stripe(env, `checkout/sessions/${id}/line_items?limit=10`);
    const list = items.data as { quantity: number; price: { id: string } }[];
    const expected = fieldsFor(sku).map(field => env[field]).sort();
    if (items.has_more !== false || !Array.isArray(list) || list.some(item => item.quantity !== 1) || JSON.stringify(list.map(item => item.price?.id).sort()) !== JSON.stringify(expected)) throw new Error("price mismatch");
    return { session, sku };
  }
  async function handle(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/health" && request.method === "GET") return json({ service: "license-checkout", checkout_enabled: env.CHECKOUT_ENABLED === "true", fulfillment_connected: !!env.LICENSE_FULFILLMENT });
    if (url.pathname === "/checkout" && request.method === "POST") {
      if (env.CHECKOUT_ENABLED !== "true") return json({ error: "Checkout is not yet available" }, 503);
      let input: { sku?: unknown; claim?: unknown };
      try { input = JSON.parse(await text(request)); } catch { return json({ error: "Invalid request" }, 400); }
      if (!isSku(input.sku) || typeof input.claim !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(input.claim)) return json({ error: "Valid sku and 256-bit claim token required" }, 400);
      const { origin, live } = configuration(env);
      await ready(env, input.sku);
      for (const field of fieldsFor(input.sku)) {
        if (!/^price_[A-Za-z0-9]+$/.test(env[field] ?? "")) throw new Error("price binding");
        const price = await stripe(env, `prices/${env[field]}`) as unknown as Price;
        if (price.id !== env[field] || !validPrice(price, field, live)) throw new Error("price configuration");
      }
      const claimHash = await hash(input.claim);
      const params = new URLSearchParams({ mode: input.sku === "OEM-VERIFY" ? "subscription" : "payment",
        success_url: `${origin}/success?session_id={CHECKOUT_SESSION_ID}#claim=${input.claim}`, cancel_url: `${origin}/cancel`,
        "metadata[sku]": input.sku, "metadata[product_line]": KIND, "metadata[claim_hash]": claimHash });
      if (input.sku === "PACK-WORKFLOW") params.set("customer_creation", "always");
      if (input.sku === "OEM-VERIFY") {
        params.set("subscription_data[metadata][sku]", input.sku);
        params.set("subscription_data[metadata][product_line]", KIND);
      }
      fieldsFor(input.sku).forEach((field, i) => { params.set(`line_items[${i}][price]`, env[field]!); params.set(`line_items[${i}][quantity]`, "1"); });
      const session = await stripe(env, "checkout/sessions", params, `license-checkout-v1:${input.sku}:${claimHash}`);
      const hosted = new URL(String(session.url));
      if (hosted.origin !== "https://checkout.stripe.com") throw new Error("invalid checkout URL");
      return json({ url: hosted.href, initial_amount_usd: totalFor(input.sku) / 100, monthly_amount_usd: input.sku === "OEM-VERIFY" ? 1500 : 0 });
    }
    if (url.pathname === "/webhook" && request.method === "POST") {
      if (!env.STRIPE_WEBHOOK_SECRET) return json({ error: "Webhook is not configured" }, 503);
      let event: StripeEvent;
      try { event = await verify(await text(request), request.headers.get("stripe-signature") ?? "", env.STRIPE_WEBHOOK_SECRET, now()); }
      catch { return json({ error: "Invalid signature" }, 400); }
      if (!event || !/^evt_[A-Za-z0-9_]+$/.test(event.id) || event.account || event.livemode !== configuration(env).live) return json({ error: "Invalid event" }, 400);
      if (!["checkout.session.completed", "checkout.session.async_payment_succeeded"].includes(event.type)) return json({ received: true });
      const raw = await stripe(env, `checkout/sessions/${event.data.object.id}`) as unknown as Session;
      if (raw.metadata?.product_line !== KIND) return json({ received: true, ignored: true });
      if (raw.payment_status !== "paid") return json({ received: true, awaiting_payment: true });
      const { session, sku } = await checkedSession(env, raw.id);
      await ready(env, sku);
      const fulfilled = await backend(env, "/fulfill", { event_id: event.id, session_id: session.id, customer_id: session.customer, subscription_id: session.subscription, sku, claim_hash: session.metadata.claim_hash, amount_total: session.amount_total, currency: session.currency });
      // The backend must atomically persist the event and exactly one license.
      if (fulfilled.fulfilled !== true || typeof fulfilled.license_id !== "string") throw new Error("License was not durably issued");
      return json({ received: true });
    }
    if (url.pathname === "/claim" && request.method === "POST") {
      let input: { session_id?: unknown; claim?: unknown };
      try { input = JSON.parse(await text(request)); } catch { return json({ error: "Invalid request" }, 400); }
      if (typeof input.session_id !== "string" || typeof input.claim !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(input.claim)) return json({ error: "Invalid claim" }, 400);
      const { session, sku } = await checkedSession(env, input.session_id);
      const claimHash = await hash(input.claim);
      if (claimHash !== session.metadata.claim_hash) return json({ error: "Invalid claim" }, 403);
      const delivery = await backend(env, "/claim", { session_id: session.id, sku, claim_hash: claimHash });
      if (delivery.status !== "ready") return json({ status: "pending" }, 202);
      // Delivery remains private, is checked by the backend, and is never logged.
      return json(delivery);
    }
    if (url.pathname === "/success" && request.method === "GET") {
      const nonce = crypto.randomUUID();
      return new Response(`<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>Your purchase</title><body><main><h1>Your purchase</h1><p id="status">Checking payment and access…</p><pre id="delivery"></pre><button id="retry" hidden>Check again</button></main><script nonce="${nonce}">const session_id=new URLSearchParams(location.search).get('session_id');const storageKey='license-claim:'+session_id;let claim=new URLSearchParams(location.hash.slice(1)).get('claim');try{if(claim)sessionStorage.setItem(storageKey,claim);else claim=sessionStorage.getItem(storageKey);}catch{}history.replaceState(null,'',location.pathname+location.search);async function check(){try{const r=await fetch('/claim',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({claim,session_id})});const d=await r.json();document.getElementById('status').textContent=r.status===202?'Payment received. Access is being prepared.':r.ok?'Your access is ready.':'Unable to verify access.';document.getElementById('retry').hidden=r.status!==202;if(r.ok&&r.status!==202)document.getElementById('delivery').textContent=JSON.stringify(d,null,2);}catch{document.getElementById('status').textContent='Unable to check access. Please retry.';document.getElementById('retry').hidden=false;}}document.getElementById('retry').onclick=check;check();</script></body></html>`, { headers: { ...JSON_HEADERS, "Content-Type": "text/html; charset=utf-8", "Content-Security-Policy": `default-src 'none'; script-src 'nonce-${nonce}'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'` } });
    }
    if (url.pathname === "/cancel") return new Response("Checkout cancelled. No access has been issued.", { headers: JSON_HEADERS });
    return json({ error: "Not found" }, 404);
  }
  return { async fetch(request: Request, env: Env) {
    const origin = request.headers.get("Origin");
    const allowed = (env.ALLOWED_ORIGINS ?? "").split(",").map(value => value.trim()).filter(Boolean);
    let ownOrigin = ""; try { ownOrigin = new URL(env.PUBLIC_ORIGIN ?? "").origin; } catch { /* configured routes fail closed */ }
    if (origin && origin !== ownOrigin && !allowed.includes(origin)) return json({ error: "Origin not allowed" }, 403);
    const cors: Record<string, string> = origin ? { "Access-Control-Allow-Origin": origin, "Vary": "Origin" } : {};
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: { ...cors, "Access-Control-Allow-Methods": "POST, GET, OPTIONS", "Access-Control-Allow-Headers": "Content-Type" } });
    let result: Response;
    try { result = await handle(request, env); } catch { result = json({ error: "Checkout or fulfillment is unavailable" }, 503); }
    const headers = new Headers(result.headers); for (const [key, value] of Object.entries(cors)) headers.set(key, value);
    return new Response(result.body, { status: result.status, headers });
  } };
}
export default createWorker();
