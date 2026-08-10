export const dynamic = 'force-dynamic';
// ============================================================
// AuthiChain Automation Worker — v2.0.2
//
// Fix: Removed `instanceof D1Database` checks that crash because
// D1Database is not a global in Workers runtime (ReferenceError → 1101)
// ============================================================

function logger(eventType, data) {
  console.log(`[${eventType}]`, JSON.stringify(data));
}

function corsHeaders(origin = "*") {
  return {
    "Access-Control-Allow-Origin": origin || "*",
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization, Stripe-Signature",
    "Access-Control-Max-Age": "86400"
  };
}

function jsonResponse(data, status = 200, origin) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) }
  });
}

function successResponse(data, message, origin) {
  return jsonResponse({ success: true, data, message }, 200, origin);
}

function errorResponse(error, status = 400, origin) {
  return jsonResponse({ success: false, error }, status, origin);
}

function handleOptions(origin) {
  return new Response(null, { status: 204, headers: corsHeaders(origin) });
}

async function verifyStripeSignature(body, signature, webhookSecret) {
  if (!signature || !webhookSecret) return false;
  try {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey("raw", encoder.encode(webhookSecret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
    const signatureBytes = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
    const expected = `sha256=${Array.from(new Uint8Array(signatureBytes)).map((b) => b.toString(16).padStart(2, "0")).join("")}`;
    return signature === expected;
  } catch (error) {
    logger("stripe_verify", { error: error.message });
    return false;
  }
}

// ── DB operations ─────────────────────────────────────────────
async function getAllManufacturers(db) {
  const result = await db.prepare("SELECT * FROM manufacturers ORDER BY onboarded_at DESC").all();
  return result.results;
}

async function getManufacturerById(db, id) {
  return db.prepare("SELECT * FROM manufacturers WHERE id = ?").bind(id).first();
}

async function getManufacturerByEmail(db, email) {
  return db.prepare("SELECT * FROM manufacturers WHERE contact_email = ?").bind(email).first();
}

async function createManufacturer(db, data) {
  const id = `mfr_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  const tier = data.tier || "free";
  await db.prepare("INSERT INTO manufacturers (id, company_name, contact_email, tier) VALUES (?, ?, ?, ?)")
    .bind(id, data.company_name, data.contact_email, tier).run();
  return getManufacturerById(db, id);
}

async function updateManufacturerTier(db, id, tier) {
  await db.prepare("UPDATE manufacturers SET tier = ? WHERE id = ?").bind(tier, id).run();
  return getManufacturerById(db, id);
}

async function getAllDeals(db) {
  const result = await db.prepare("SELECT * FROM deals ORDER BY created_at DESC").all();
  return result.results;
}

async function getDealsByManufacturer(db, manufacturerId) {
  const result = await db.prepare("SELECT * FROM deals WHERE manufacturer_id = ? ORDER BY created_at DESC").bind(manufacturerId).all();
  return result.results;
}

async function createDeal(db, data) {
  const id = `deal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await db.prepare("INSERT INTO deals (id, manufacturer_id, deal_name, deal_value, stage, owner_email) VALUES (?, ?, ?, ?, ?, ?)")
    .bind(id, data.manufacturer_id, data.deal_name, data.deal_value, data.stage, data.owner_email).run();
  return db.prepare("SELECT * FROM deals WHERE id = ?").bind(id).first();
}

async function updateDealStage(db, id, stage) {
  await db.prepare("UPDATE deals SET stage = ? WHERE id = ?").bind(stage, id).run();
  return db.prepare("SELECT * FROM deals WHERE id = ?").bind(id).first();
}

async function getAllSubscriptions(db) {
  const result = await db.prepare("SELECT * FROM subscriptions ORDER BY created_at DESC").all();
  return result.results;
}

async function getSubscriptionsByManufacturer(db, manufacturerId) {
  const result = await db.prepare("SELECT * FROM subscriptions WHERE manufacturer_id = ? ORDER BY created_at DESC").bind(manufacturerId).all();
  return result.results;
}

async function createSubscription(db, data) {
  const id = `sub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  await db.prepare("INSERT INTO subscriptions (id, manufacturer_id, plan_name, amount, status) VALUES (?, ?, ?, ?, ?)")
    .bind(id, data.manufacturer_id, data.plan_name, data.amount, data.status).run();
  return db.prepare("SELECT * FROM subscriptions WHERE id = ?").bind(id).first();
}

async function updateSubscriptionStatus(db, id, status) {
  await db.prepare("UPDATE subscriptions SET status = ? WHERE id = ?").bind(status, id).run();
  return db.prepare("SELECT * FROM subscriptions WHERE id = ?").bind(id).first();
}

async function getAllNFTMints(db, limit = 100) {
  const result = await db.prepare("SELECT * FROM nft_mints ORDER BY timestamp DESC LIMIT ?").bind(limit).all();
  return result.results;
}

async function getNFTMintByTxHash(db, txHash) {
  return db.prepare("SELECT * FROM nft_mints WHERE tx_hash = ?").bind(txHash).first();
}

async function recordNFTMint(db, data) {
  const existing = await getNFTMintByTxHash(db, data.tx_hash);
  if (existing) return existing;
  await db.prepare("INSERT INTO nft_mints (token_id, to_address, tx_hash, block_number, timestamp) VALUES (?, ?, ?, ?, ?)")
    .bind(data.token_id, data.to_address, data.tx_hash, data.block_number, data.timestamp).run();
  return getNFTMintByTxHash(db, data.tx_hash);
}

async function getAnalytics(db) {
  const [manufacturers, deals, subscriptions, nfts] = await Promise.all([
    db.prepare("SELECT COUNT(*) as count FROM manufacturers").first(),
    db.prepare("SELECT COUNT(*) as count, SUM(deal_value) as total_value FROM deals").first(),
    db.prepare("SELECT COUNT(*) as count, SUM(amount) as mrr FROM subscriptions WHERE status = ?").bind("active").first(),
    db.prepare("SELECT COUNT(*) as count FROM nft_mints").first()
  ]);
  return {
    manufacturers: manufacturers?.count || 0,
    deals: { count: deals?.count || 0, total_value: deals?.total_value || 0 },
    subscriptions: { count: subscriptions?.count || 0, mrr: subscriptions?.mrr || 0 },
    nfts: { count: nfts?.count || 0 }
  };
}

// ── Pricing ─────────────────────────────────────────────────────
async function handlePricing(request, env) {
  const origin = request.headers.get("Origin") || env.ALLOWED_ORIGINS || "*";
  if (!env.DB) return errorResponse("Database not configured", 503, origin);
  try {
    const result = await env.DB.prepare("SELECT * FROM tier_config ORDER BY monthly_price ASC").all();
    const tiers = result.results.map(t => ({
      ...t,
      features: (() => { try { return JSON.parse(t.features || "[]"); } catch { return []; } })()
    }));
    return successResponse(tiers, undefined, origin);
  } catch (error) {
    return errorResponse(error.message, 500, origin);
  }
}

// ── Stripe webhook ────────────────────────────────────────────
const PRICE_TO_TIER = {
  "price_1StuAZGqTruSqV8TcoSJj4kr": "starter",
  "price_1StuAeGqTruSqV8TbERZ2LMU": "growth",
  "price_1StuAiGqTruSqV8ToXJM469E": "scale",
  "price_1StuAmGqTruSqV8Tj6UHDhCm": "enterprise",
  "price_1SxWtmGqTruSqV8T7U95QG9O": "starter",
  "price_1SxWvxGqTruSqV8T7U95QG9O": "growth",
  "price_1Sz7dTGqTruSqV8TnicpSP5w": "starter"
};

async function logAutomation(db, eventType, payload, result, status) {
  try {
    await db.prepare("INSERT INTO automation_logs (event_type, payload, result, status, created_at) VALUES (?, ?, ?, ?, datetime('now'))")
      .bind(eventType, JSON.stringify(payload), JSON.stringify(result), status).run();
  } catch (e) { console.error("Failed to write automation log:", e); }
}

async function handleStripeWebhook(request, env) {
  const origin = request.headers.get("Origin") || env.ALLOWED_ORIGINS || "*";
  if (!env.DB) return errorResponse("Database not configured", 503, origin);

  let event;
  try {
    const body = await request.text();
    const signature = request.headers.get("stripe-signature");
    if (env.STRIPE_WEBHOOK_SECRET && signature) {
      const isValid = await verifyStripeSignature(body, signature, env.STRIPE_WEBHOOK_SECRET);
      if (!isValid) return errorResponse("Invalid webhook signature", 401, origin);
    }
    event = JSON.parse(body);
  } catch (e) {
    return errorResponse("Invalid JSON body", 400, origin);
  }

  const eventType = event.type;
  logger("stripe_webhook", { event_type: eventType });

  try {
    if (eventType === "customer.subscription.created" || eventType === "customer.subscription.updated") {
      const subscription = event.data.object;
      const customerEmail = event.data.object.customer_email || (subscription.customer ? `stripe_${subscription.customer}` : null);
      const priceId = subscription.items?.data?.[0]?.price?.id;
      const tier = PRICE_TO_TIER[priceId] || "starter";
      const stripePriceAmount = subscription.items?.data?.[0]?.price?.unit_amount || 0;

      let manufacturer = customerEmail ? await getManufacturerByEmail(env.DB, customerEmail) : null;
      if (!manufacturer) {
        manufacturer = await createManufacturer(env.DB, {
          company_name: customerEmail ? customerEmail.split("@")[0] : `customer_${subscription.customer}`,
          contact_email: customerEmail || `${subscription.customer}@stripe.auto`,
          tier
        });
      } else {
        manufacturer = await updateManufacturerTier(env.DB, manufacturer.id, tier);
      }

      await createSubscription(env.DB, {
        manufacturer_id: manufacturer.id,
        plan_name: tier,
        amount: stripePriceAmount / 100,
        status: subscription.status === "active" ? "active" : "pending"
      });

      await env.DB.prepare("INSERT OR REPLACE INTO manufacturer_stripe (manufacturer_id, stripe_customer_id, stripe_subscription_id, stripe_price_id, updated_at) VALUES (?, ?, ?, ?, datetime('now'))")
        .bind(manufacturer.id, subscription.customer, subscription.id, priceId || "").run();

      await logAutomation(env.DB, eventType, { subscription_id: subscription.id, tier, email: customerEmail }, { manufacturer_id: manufacturer.id }, "success");
      return successResponse({ manufacturer_id: manufacturer.id, tier, action: "onboarded" }, undefined, origin);
    }

    if (eventType === "customer.subscription.deleted") {
      const subscription = event.data.object;
      const row = await env.DB.prepare("SELECT * FROM manufacturer_stripe WHERE stripe_subscription_id = ?").bind(subscription.id).first();
      if (row) {
        await updateManufacturerTier(env.DB, row.manufacturer_id, "free");
        await env.DB.prepare("UPDATE subscriptions SET status = 'cancelled' WHERE manufacturer_id = ? AND status = 'active'").bind(row.manufacturer_id).run();
        await logAutomation(env.DB, eventType, { subscription_id: subscription.id }, { manufacturer_id: row.manufacturer_id, downgraded_to: "free" }, "success");
      }
      return successResponse({ handled: true, event: eventType }, undefined, origin);
    }

    return successResponse({ handled: false, event: eventType }, undefined, origin);
  } catch (error) {
    await logAutomation(env.DB, eventType, event.data?.object, { error: error.message }, "error").catch(() => {});
    return errorResponse(error.message, 500, origin);
  }
}

// ── Route handlers ──────────────────────────────────────────────
async function handleManufacturers(request, env) {
  const url = new URL(request.url);
  const method = request.method;
  const origin = request.headers.get("Origin") || env.ALLOWED_ORIGINS || "*";
  if (!env.DB) return errorResponse("Database not configured.", 503, origin);
  try {
    if (method === "GET") {
      const id = url.pathname.split("/").pop();
      if (id && id !== "manufacturers") {
        const manufacturer = await getManufacturerById(env.DB, id);
        if (!manufacturer) return errorResponse("Manufacturer not found", 404, origin);
        return successResponse(manufacturer, undefined, origin);
      }
      return successResponse(await getAllManufacturers(env.DB), undefined, origin);
    }
    if (method === "POST") {
      const body = await request.json();
      if (!body.company_name || !body.contact_email) return errorResponse("Missing required fields", 400, origin);
      return successResponse(await createManufacturer(env.DB, body), "Manufacturer created successfully", origin);
    }
    if (method === "PUT") {
      const id = url.pathname.split("/").pop();
      if (!id || id === "manufacturers") return errorResponse("Manufacturer ID required", 400, origin);
      const body = await request.json();
      if (!body.tier) return errorResponse("Missing required field: tier", 400, origin);
      return successResponse(await updateManufacturerTier(env.DB, id, body.tier), "Manufacturer updated successfully", origin);
    }
    return errorResponse("Method not allowed", 405, origin);
  } catch (error) {
    return errorResponse(error.message, 500, origin);
  }
}

async function handleDeals(request, env) {
  const url = new URL(request.url);
  const method = request.method;
  const origin = request.headers.get("Origin") || env.ALLOWED_ORIGINS || "*";
  if (!env.DB) return errorResponse("Database not configured.", 503, origin);
  try {
    if (method === "GET") {
      const manufacturerId = url.searchParams.get("manufacturer_id");
      if (manufacturerId) return successResponse(await getDealsByManufacturer(env.DB, manufacturerId), undefined, origin);
      return successResponse(await getAllDeals(env.DB), undefined, origin);
    }
    if (method === "POST") {
      const body = await request.json();
      if (!body.manufacturer_id || !body.deal_name || !body.deal_value || !body.stage || !body.owner_email)
        return errorResponse("Missing required fields", 400, origin);
      return successResponse(await createDeal(env.DB, body), "Deal created successfully", origin);
    }
    if (method === "PUT") {
      const id = url.pathname.split("/").pop();
      if (!id || id === "deals") return errorResponse("Deal ID required", 400, origin);
      const body = await request.json();
      if (!body.stage) return errorResponse("Missing required field: stage", 400, origin);
      return successResponse(await updateDealStage(env.DB, id, body.stage), "Deal updated successfully", origin);
    }
    return errorResponse("Method not allowed", 405, origin);
  } catch (error) {
    return errorResponse(error.message, 500, origin);
  }
}

async function handleSubscriptions(request, env) {
  const url = new URL(request.url);
  const method = request.method;
  const origin = request.headers.get("Origin") || env.ALLOWED_ORIGINS || "*";
  if (!env.DB) return errorResponse("Database not configured.", 503, origin);
  try {
    if (method === "GET") {
      const manufacturerId = url.searchParams.get("manufacturer_id");
      if (manufacturerId) return successResponse(await getSubscriptionsByManufacturer(env.DB, manufacturerId), undefined, origin);
      return successResponse(await getAllSubscriptions(env.DB), undefined, origin);
    }
    if (method === "POST") {
      const body = await request.json();
      if (!body.manufacturer_id || !body.plan_name || !body.amount || !body.status)
        return errorResponse("Missing required fields", 400, origin);
      return successResponse(await createSubscription(env.DB, body), "Subscription created successfully", origin);
    }
    if (method === "PUT") {
      const id = url.pathname.split("/").pop();
      if (!id || id === "subscriptions") return errorResponse("Subscription ID required", 400, origin);
      const body = await request.json();
      if (!body.status) return errorResponse("Missing required field: status", 400, origin);
      return successResponse(await updateSubscriptionStatus(env.DB, id, body.status), "Subscription updated successfully", origin);
    }
    return errorResponse("Method not allowed", 405, origin);
  } catch (error) {
    return errorResponse(error.message, 500, origin);
  }
}

async function handleNFTs(request, env) {
  const url = new URL(request.url);
  const method = request.method;
  const origin = request.headers.get("Origin") || env.ALLOWED_ORIGINS || "*";
  if (!env.DB) return errorResponse("Database not configured.", 503, origin);
  try {
    if (method === "GET") {
      const limit = parseInt(url.searchParams.get("limit") || "100");
      return successResponse(await getAllNFTMints(env.DB, limit), undefined, origin);
    }
    if (method === "POST") {
      const body = await request.json();
      if (!body.token_id || !body.to_address || !body.tx_hash || !body.block_number || !body.timestamp)
        return errorResponse("Missing required fields", 400, origin);
      return successResponse(await recordNFTMint(env.DB, body), "NFT mint recorded successfully", origin);
    }
    return errorResponse("Method not allowed", 405, origin);
  } catch (error) {
    return errorResponse(error.message, 500, origin);
  }
}

async function handleAnalyticsRoute(request, env) {
  const origin = request.headers.get("Origin") || env.ALLOWED_ORIGINS || "*";
  if (!env.DB) return errorResponse("Database not configured.", 503, origin);
  try {
    if (request.method === "GET") return successResponse(await getAnalytics(env.DB), undefined, origin);
    return errorResponse("Method not allowed", 405, origin);
  } catch (error) {
    return errorResponse(error.message, 500, origin);
  }
}

// ── Rate limiter Durable Object ───────────────────────────────
var RateLimiter = class {
  constructor(state) { this.state = state; }
  async fetch(request) {
    const url = new URL(request.url);
    const clientId = url.searchParams.get("clientId") || "anonymous";
    const limit = parseInt(url.searchParams.get("limit") || "100");
    const windowMs = parseInt(url.searchParams.get("windowMs") || "60000");
    const now = Date.now();
    let state = await this.state.storage.get(clientId);
    if (!state || now > state.resetTime) state = { requests: 0, resetTime: now + windowMs };
    if (state.requests >= limit) {
      const remaining = Math.ceil((state.resetTime - now) / 1e3);
      return new Response(JSON.stringify({ allowed: false, limit, remaining: 0, resetIn: remaining }), {
        status: 429, headers: { "Content-Type": "application/json", "Retry-After": remaining.toString() }
      });
    }
    state.requests++;
    await this.state.storage.put(clientId, state);
    return new Response(JSON.stringify({ allowed: true, limit, remaining: limit - state.requests, resetIn: Math.ceil((state.resetTime - now) / 1e3) }), {
      status: 200, headers: { "Content-Type": "application/json" }
    });
  }
};

async function checkRateLimit(request, env) {
  if (!env.RATE_LIMITER) return null;
  const clientId = request.headers.get("CF-Connecting-IP") || "anonymous";
  const id = env.RATE_LIMITER.idFromName(clientId);
  const stub = env.RATE_LIMITER.get(id);
  const rateLimitUrl = new URL(request.url);
  rateLimitUrl.searchParams.set("clientId", clientId);
  rateLimitUrl.searchParams.set("limit", "100");
  rateLimitUrl.searchParams.set("windowMs", "60000");
  const resp = await stub.fetch(new Request(rateLimitUrl.toString()));
  if (resp.status === 429) return resp;
  return null;
}

// ── Main router ───────────────────────────────────────────────
async function handleRequest(request, env) {
  const url = new URL(request.url);
  const path = url.pathname;
  const origin = request.headers.get("Origin") || env.ALLOWED_ORIGINS || "*";

  if (request.method === "OPTIONS") return handleOptions(origin);
  if (request.method !== "GET") {
    const rateLimitResponse = await checkRateLimit(request, env);
    if (rateLimitResponse) return rateLimitResponse;
  }

  try {
    if (path === "/" || path === "/health") {
      return successResponse({
        status: "healthy",
        environment: env.ENVIRONMENT,
        timestamp: new Date().toISOString(),
        version: "2.0.2",
        endpoints: ["/pricing", "/analytics", "/manufacturers", "/deals", "/subscriptions", "/nfts", "/webhooks/stripe"]
      }, undefined, origin);
    }
    if (path === "/analytics") return handleAnalyticsRoute(request, env);
    if (path === "/pricing") return handlePricing(request, env);
    if (path === "/webhooks/stripe") return handleStripeWebhook(request, env);
    if (path.startsWith("/manufacturers")) return handleManufacturers(request, env);
    if (path.startsWith("/deals")) return handleDeals(request, env);
    if (path.startsWith("/subscriptions")) return handleSubscriptions(request, env);
    if (path.startsWith("/nfts")) return handleNFTs(request, env);
    return errorResponse("Endpoint not found", 404, origin);
  } catch (error) {
    return errorResponse(error.message, 500, origin);
  }
}

export { RateLimiter };
export default {
  async fetch(request, env) { return handleRequest(request, env); },
  async scheduled(event, env) { console.log("Cron trigger fired at:", new Date(event.scheduledTime).toISOString()); }
};
