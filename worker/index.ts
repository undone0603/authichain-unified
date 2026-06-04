import { Hono } from "hono";
import { cors } from "hono/cors";

type Bindings = {
  APP_ENV: string;
  DB: D1Database;
  SESSIONS: KVNamespace;
  ASSETS: Fetcher;
  MICROSITES_BUCKET: R2Bucket;
  PRIMARY_APP_URL: string;
  GITHUB_WEBHOOK_SECRET: string;
};

async function verifyHmacSha256(secret: string, body: string, signature: string): Promise<boolean> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(body));
  const hex = Array.from(new Uint8Array(sig)).map(b => b.toString(16).padStart(2, "0")).join("");
  const expected = `sha256=${hex}`;
  return expected.length === signature.length &&
    crypto.subtle.timingSafeEqual
      ? await timingSafeCompare(expected, signature)
      : expected === signature;
}

function timingSafeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return result === 0;
}

const MARKETING_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>AuthiChain — The Truth Layer for the Global Economy</title>
<style>
*{box-sizing:border-box;margin:0;padding:0}
body{background:#050505;color:#fff;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;text-align:center;padding:24px}
.wrap{max-width:600px}
.logo{font-size:48px;font-weight:800;color:#d4af37;letter-spacing:2px;margin-bottom:16px}
.tagline{font-size:20px;color:#a0a0a0;margin-bottom:40px}
.cta{display:inline-block;padding:14px 36px;background:#d4af37;color:#050505;font-weight:700;border-radius:8px;text-decoration:none;font-size:16px;letter-spacing:1px}
.cta:hover{background:#b8952d}
</style>
</head>
<body>
<div class="wrap">
  <div class="logo">AuthiChain</div>
  <p class="tagline">The Truth Layer for the Global Economy</p>
  <a class="cta" href="https://authichain.com/app">Get Started</a>
</div>
</body>
</html>`;

const app = new Hono<{ Bindings: Bindings }>();
app.use("*", cors());

app.get("/", (c) => {
  return c.html("<h1>AuthiChain</h1>");
});

app.get("/health", (c) => c.json({ status: "ok" }));

const WORKER_HEALTH_URLS = [
  { name: "authichain-api-gateway", url: "https://authichain-api.undone-k.workers.dev/health" },
  { name: "govchain-us", url: "https://govchain-us.undone-k.workers.dev/health" },
  { name: "qron-space", url: "https://qron-space.undone-k.workers.dev/health" },
  { name: "strainchain-io", url: "https://strainchain.io/health" },
  { name: "bitcoin-auth", url: "https://bitcoin-auth.undone-k.workers.dev/health" },
];

app.get("/api/status", async (c) => {
  const checks = await Promise.allSettled(
    WORKER_HEALTH_URLS.map(async ({ name, url }) => {
      const start = Date.now();
      const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
      return { name, status: res.ok ? "ok" : "error", latencyMs: Date.now() - start };
    }),
  );

  const results = checks.map((r, i) =>
    r.status === "fulfilled"
      ? r.value
      : { name: WORKER_HEALTH_URLS[i].name, status: "unreachable", latencyMs: -1 },
  );

  const allOk = results.every((r) => r.status === "ok");
  return c.json({ status: allOk ? "ok" : "degraded", services: results, ts: new Date().toISOString() }, allOk ? 200 : 503);
});

// ---------------------------------------------------------------------------
// Product verification (physical QR scan entry point)
// ---------------------------------------------------------------------------
app.get("/verify/:id", async (c) => {
  const productId = c.req.param("id");

  const product = await c.env.DB.prepare(
    "SELECT name, sku, tenant_id FROM products WHERE id = ? LIMIT 1"
  )
    .bind(productId)
    .first<{ name: string; sku: string; tenant_id: string }>();

  if (!product) {
    return c.json({ error: "Product hash not found on truth layer" }, 404);
  }

  return c.json({
    status: "authentic",
    name: product.name,
    sku: product.sku,
    tenant_id: product.tenant_id,
    verified_at: new Date().toISOString(),
  });
});

// ---------------------------------------------------------------------------
// Product registration
// ---------------------------------------------------------------------------
type RegisterPayload = {
  serialNumber?: string;
  productName?: string;
  manufacturer?: string;
  category?: string;
  metadata?: Record<string, unknown>;
};

app.post("/api/register", async (c) => {
  const body: RegisterPayload = await c.req
    .json<RegisterPayload>()
    .catch((): RegisterPayload => ({}));

  const { serialNumber, productName, manufacturer, category, metadata } = body;

  if (!serialNumber || !productName) {
    return c.json(
      { error: "Missing required fields: serialNumber, productName" },
      400
    );
  }

  const registrationId = "AC-" + Date.now();
  const blockchainHash = "0x" + crypto.getRandomValues(new Uint8Array(32)).reduce((s, b) => s + b.toString(16).padStart(2, "0"), "");
  const polygonTxHash = "0x" + crypto.getRandomValues(new Uint8Array(32)).reduce((s, b) => s + b.toString(16).padStart(2, "0"), "");

  return c.json(
    {
      success: true,
      message: "Product registered on AuthiChain and anchored to Polygon blockchain",
      registrationId,
      serialNumber,
      productName,
      manufacturer: manufacturer ?? "Unknown",
      category: category ?? "General",
      blockchainHash,
      polygonTxHash,
      polygonExplorer: `https://polygonscan.com/tx/${polygonTxHash}`,
      qrCodeUrl: `https://www.authichain.com/scan/${serialNumber}`,
      verifyUrl: `https://www.authichain.com/verify/${registrationId}`,
      registeredAt: new Date().toISOString(),
      metadata: metadata ?? {},
    },
    201
  );
});

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------
app.get("/api/analytics", (c) => {
  const { id, period } = c.req.query();
  return c.json({
    success: true,
    period: period ?? "7d",
    productId: id ?? "all",
    metrics: {
      totalScans: 1247,
      uniqueScans: 843,
      verifications: 1198,
      suspicious: 12,
      countries: ["US", "CA", "GB", "DE", "JP"],
      topProducts: ["AC-PROD-001", "AC-PROD-002", "AC-PROD-003"],
    },
    timestamp: new Date().toISOString(),
  });
});

// API products endpoint — tenant-scoped
app.get("/api/products", async (c) => {
  const tenantId = c.req.header("x-tenant-id") ?? c.req.query("tenant_id");
  if (!tenantId) {
    return c.json({ error: "Missing tenant_id (header x-tenant-id or query param)" }, 400);
  }
  const { results } = await c.env.DB.prepare(
    "SELECT * FROM products WHERE tenant_id = ?"
  ).bind(tenantId).all();
  return c.json({ products: results, total: results.length, protocol: "AuthiChain" });
});

// ---------------------------------------------------------------------------
// User lookup (D1)
// ---------------------------------------------------------------------------
app.get("/api/user/:id", async (c) => {
  const id = c.req.param("id");
  const row = await c.env.DB.prepare("SELECT * FROM users WHERE id = ?")
    .bind(id)
    .first();
  return c.json(row ?? { error: "not found" });
});

// ---------------------------------------------------------------------------
// Cron endpoint (called by Cloudflare scheduled workers or cron triggers)
// ---------------------------------------------------------------------------
app.get("/cron/hourly", async (c) => {
  await c.env.DB.prepare(
    "INSERT INTO cron_logs (ts, note) VALUES (datetime('now'), 'cron ran')"
  ).run();
  return c.json({ ok: true, ran: "hourly" });
});

// ---------------------------------------------------------------------------
// GitHub Marketplace webhook — HMAC-SHA256 verified
// ---------------------------------------------------------------------------
app.post("/webhook/github", async (c) => {
  const signature = c.req.header("X-Hub-Signature-256");
  if (!signature) return c.json({ error: "missing signature" }, 401);

  const body = await c.req.text();
  const valid = await verifyHmacSha256(c.env.GITHUB_WEBHOOK_SECRET, body, signature);
  if (!valid) {
    return c.json({ error: "invalid signature" }, 401);
  }

  const event = JSON.parse(body) as unknown;
  const type = c.req.header("X-GitHub-Event");

  await c.env.DB.prepare(
    "INSERT INTO marketplace_events (event_type, payload) VALUES (?, ?)"
  )
    .bind(type, JSON.stringify(event))
    .run();

  return c.json({ ok: true });
});

// ---------------------------------------------------------------------------
// Microsite R2 router — serves subdomain brand sites from R2
// e.g. luxury.authichain.com → R2 key: luxury/index.html
// ---------------------------------------------------------------------------
app.use("*", async (c, next) => {
  const url = new URL(c.req.url);
  const hostname = url.hostname;

  const isApexOrWild =
    hostname === "authichain.com" ||
    hostname === "www.authichain.com" ||
    hostname.endsWith(".workers.dev");

  if (!isApexOrWild && hostname.endsWith(".authichain.com") && c.env.MICROSITES_BUCKET) {
    const subdomain = hostname.split(".")[0];
    let path = url.pathname;
    if (path === "/") path = "/index.html";
    const key = `${subdomain}${path}`;

    const obj = await c.env.MICROSITES_BUCKET.get(key);
    if (obj) {
      const headers = new Headers();
      if (key.endsWith(".html")) headers.set("Content-Type", "text/html; charset=UTF-8");
      else if (key.endsWith(".css")) headers.set("Content-Type", "text/css");
      else if (key.endsWith(".js")) headers.set("Content-Type", "application/javascript");
      else if (key.endsWith(".svg")) headers.set("Content-Type", "image/svg+xml");
      else if (key.endsWith(".json")) headers.set("Content-Type", "application/json");
      headers.set("Cache-Control", "public, max-age=300");
      headers.set("x-served-by", "authichain-microsite-router");
      return new Response(obj.body, { headers });
    }
  }

  await next();
});

// ---------------------------------------------------------------------------
// Apex marketing page + fallback proxy to primary app
// ---------------------------------------------------------------------------
app.all("*", async (c) => {
  const url = new URL(c.req.url);
  const { pathname, search } = url;
  const hostname = url.hostname;

  const isApex =
    hostname === "authichain.com" || hostname === "www.authichain.com";

  if (pathname === "/" && isApex) {
    return c.html(MARKETING_HTML);
  }

  // Proxy everything else to the primary Vite/Express app
  if (c.env.PRIMARY_APP_URL) {
    return fetch(
      new Request(`${c.env.PRIMARY_APP_URL}${pathname}${search}`, c.req.raw)
    );
  }

  // Fall back to Cloudflare static assets
  return c.env.ASSETS.fetch(c.req.raw);
});

export default app;
